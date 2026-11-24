import {
  coreApi,
  appsApi,
  autoscalingApi,
  batchApi,
  customObjectsApi,
  APPS_NAMESPACE,
  LOADTEST_NAMESPACE,
} from './k8s.js';
import {
  StateDocument,
  ServiceState,
  PodState,
  ContainerState,
  TrafficSplit,
  CallGraphEdge,
  EventItem,
} from './types.js';

let latestState: StateDocument | null = null;
const listeners = new Set<(state: StateDocument) => void>();

export function getLatestState(): StateDocument | null {
  return latestState;
}

export function subscribeState(listener: (state: StateDocument) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function parseCpuToMilli(cpuStr: string | undefined): number {
  if (!cpuStr) return 0;
  if (cpuStr.endsWith('m')) {
    return parseInt(cpuStr.replace('m', ''), 10);
  }
  if (cpuStr.endsWith('n')) {
    return Math.round(parseInt(cpuStr.replace('n', ''), 10) / 1000000);
  }
  if (cpuStr.endsWith('u')) {
    return Math.round(parseInt(cpuStr.replace('u', ''), 10) / 1000);
  }
  return parseFloat(cpuStr) * 1000;
}

export async function pollCluster(): Promise<StateDocument> {
  const now = new Date().toISOString();

  // 1. Fetch K8s resources concurrently
  const [podsRes, depsRes, hpasRes, eventsRes, jobsRes, metricsRes, vsRes] = await Promise.all([
    coreApi.listNamespacedPod({ namespace: APPS_NAMESPACE }).catch(() => ({ items: [] })),
    appsApi.listNamespacedDeployment({ namespace: APPS_NAMESPACE }).catch(() => ({ items: [] })),
    autoscalingApi.listNamespacedHorizontalPodAutoscaler({ namespace: APPS_NAMESPACE }).catch(() => ({ items: [] })),
    coreApi.listNamespacedEvent({ namespace: APPS_NAMESPACE }).catch(() => ({ items: [] })),
    batchApi.listNamespacedJob({ namespace: LOADTEST_NAMESPACE }).catch(() => ({ items: [] })),
    customObjectsApi
      .listNamespacedCustomObject({
        group: 'metrics.k8s.io',
        version: 'v1beta1',
        namespace: APPS_NAMESPACE,
        plural: 'pods',
      })
      .catch(() => ({ items: [] })),
    customObjectsApi
      .listNamespacedCustomObject({
        group: 'networking.istio.io',
        version: 'v1beta1',
        namespace: APPS_NAMESPACE,
        plural: 'virtualservices',
      })
      .catch(() => ({ items: [] })),
  ]);

  // Map pod metrics by pod name
  const podMetricsMap = new Map<string, { cpuMilli: number; sampledAt: string }>();
  const metricsItems = (metricsRes as any)?.items || [];
  for (const m of metricsItems) {
    const podName = m.metadata?.name;
    const timestamp = m.timestamp || now;
    let cpuMilli = 0;
    if (Array.isArray(m.containers)) {
      for (const c of m.containers) {
        if (c.name === 'app') {
          cpuMilli = parseCpuToMilli(c.usage?.cpu);
        }
      }
    }
    if (podName) {
      podMetricsMap.set(podName, { cpuMilli, sampledAt: timestamp });
    }
  }

  // Map active jobs in loadtest
  const activeJobsMap = new Map<string, any>();
  for (const job of (jobsRes as any)?.items || []) {
    const target = job.metadata?.labels?.target;
    if (target) {
      // Check if job is still active
      const isActive = !job.status?.completionTime && (job.status?.active ?? 0) > 0;
      activeJobsMap.set(target, {
        running: isActive,
        job,
      });
    }
  }

  // 2. Process pods & query admin stats concurrently
  const rawPods = (podsRes as any)?.items || [];
  const podStatsPromises = rawPods.map(async (pod: any): Promise<PodState> => {
    const podName = pod.metadata?.name || '';
    const phase = pod.status?.phase || 'Pending';
    const isDeleting = !!pod.metadata?.deletionTimestamp;

    // Containers and status (including native sidecars like istio-proxy)
    const containerStatuses = pod.status?.containerStatuses || [];
    const proxyStatus = (pod.status?.initContainerStatuses || []).filter(
      (cs: any) => cs.name === 'istio-proxy'
    );
    const allStatuses = [...containerStatuses, ...proxyStatus];
    const containers: ContainerState[] = allStatuses.map((cs: any) => ({
      name: cs.name,
      ready: !!cs.ready,
    }));

    let state: PodState['state'] = 'Pending';
    let restarts = 0;

    for (const cs of containerStatuses) {
      restarts += cs.restartCount || 0;
      if (cs.state?.waiting?.reason === 'CrashLoopBackOff') state = 'CrashLoop';
      if (cs.state?.terminated?.reason === 'OOMKilled') state = 'OOMKilled';
      if (
        cs.state?.waiting?.reason === 'ErrImagePull' ||
        cs.state?.waiting?.reason === 'ImagePullBackOff'
      ) {
        state = 'ImagePullError';
      }
    }

    if (state === 'Pending') {
      if (isDeleting) {
        state = 'Terminating';
      } else if (containers.length > 0 && containers.every((c) => c.ready)) {
        state = 'Ready';
      } else if (phase === 'Running') {
        state = 'Running';
      }
    }

    const track = pod.metadata?.labels?.track || 'default';
    const image = pod.spec?.containers?.[0]?.image || '';
    const release = image.includes(':') ? image.split(':')[1] : (pod.metadata?.labels?.release || 'current');

    const metrics = podMetricsMap.get(podName) || { cpuMilli: 0, sampledAt: now };

    // Query admin stats on 9090
    let rps = 0;
    let inflight = 0;
    let outboundRps: Record<string, number> = {};
    let p95Ms = 0;

    if (pod.status?.podIP && state !== 'Terminating') {
      try {
        const statsRes = await fetch(`http://${pod.status.podIP}:9090/stats`, {
          signal: AbortSignal.timeout(1000),
        });
        if (statsRes.ok) {
          const stats = (await statsRes.json()) as any;
          rps = stats.rps || 0;
          inflight = stats.inflight || 0;
          outboundRps = stats.outboundRps || {};
          p95Ms = stats.p95Ms || 0;
        }
      } catch {
        // Keep 0 on timeout/error, never drop pod
      }
    }

    return {
      name: podName,
      phase,
      state,
      startedAt: pod.status?.startTime || now,
      restarts,
      track,
      release,
      containers,
      cpuMilli: metrics.cpuMilli,
      cpuRequestMilli: 100,
      cpuSampledAt: metrics.sampledAt,
      rps,
      inflight,
      _outboundRps: outboundRps,
      _p95Ms: p95Ms,
    } as any;
  });

  const processedPods: (PodState & { _outboundRps?: Record<string, number>; _p95Ms?: number })[] =
    await Promise.all(podStatsPromises);

  // 3. Assemble Totals
  let totalPods = processedPods.length;
  let totalContainers = 0;
  let readyContainers = 0;

  for (const p of processedPods) {
    totalContainers += p.containers.length;
    readyContainers += p.containers.filter((c) => c.ready).length;
  }

  // Map VirtualService traffic weights by service name ('a', 'b', 'c')
  const trafficWeightsMap = new Map<string, TrafficSplit[]>();
  const vsItems = (vsRes as any)?.items || [];
  for (const vs of vsItems) {
    const vsName = vs.metadata?.name || '';
    const match = vsName.match(/^svc-([abc])(?:-ingress)?$/);
    if (!match) continue;
    const svcKey = match[1];

    const routes = vs.spec?.http?.[0]?.route;
    if (Array.isArray(routes) && routes.length > 0) {
      const splits: TrafficSplit[] = routes.map((r: any) => ({
        release: r.destination?.subset || 'default',
        weight: typeof r.weight === 'number' ? r.weight : 100,
      }));
      if (!trafficWeightsMap.has(svcKey) || vsName === `svc-${svcKey}`) {
        trafficWeightsMap.set(svcKey, splits);
      }
    }
  }

  // 4. Assemble Services (a, b, c)
  const serviceNames: ('a' | 'b' | 'c')[] = ['a', 'b', 'c'];
  const services: ServiceState[] = serviceNames.map((svcName) => {
    const svcAppLabel = `svc-${svcName}`;
    const svcPods = processedPods.filter((p) => {
      const raw = rawPods.find((rp: any) => rp.metadata?.name === p.name);
      return raw?.metadata?.labels?.app === svcAppLabel;
    });

    // Sum RPS, errors, weighted p95
    let totalRps = 0;
    let weightedP95Sum = 0;
    for (const p of svcPods) {
      totalRps += p.rps;
      weightedP95Sum += (p.rps * (p._p95Ms || 0));
    }
    const serviceP95 = totalRps > 0 ? Math.round(weightedP95Sum / totalRps) : 0;

    // HPA info
    const hpa = (hpasRes as any)?.items?.find((h: any) =>
      h.metadata?.name?.startsWith(`svc-${svcName}`)
    );

    const minReplicas = hpa?.spec?.minReplicas ?? 1;
    const maxReplicas = hpa?.spec?.maxReplicas ?? 5;
    const currentReplicas = hpa?.status?.currentReplicas ?? svcPods.length;
    const desiredReplicas = hpa?.status?.desiredReplicas ?? currentReplicas;
    const targetCpuPct = 50;

    let avgCpuPct = 0;
    if (svcPods.length > 0) {
      const totalCpuMilli = svcPods.reduce((acc, p) => acc + p.cpuMilli, 0);
      avgCpuPct = Math.round((totalCpuMilli / (svcPods.length * 100)) * 100);
    }

    // Active load info
    const jobInfo = activeJobsMap.get(svcName);
    const isRunning = !!jobInfo?.running;
    let loadConfig = {
      running: isRunning,
      vus: 0,
      workMs: 50,
      route: 'work' as const,
      targets: [] as string[],
      sleepMs: 100,
    };

    if (isRunning && jobInfo?.job) {
      const envs: any[] = jobInfo.job.spec?.template?.spec?.containers?.[0]?.env || [];
      const envMap = new Map<string, string>();
      for (const e of envs) {
        if (e.name && typeof e.value === 'string') {
          envMap.set(e.name, e.value);
        }
      }
      loadConfig.vus = parseInt(envMap.get('INITIAL_VUS') || '0', 10);
      loadConfig.workMs = parseInt(envMap.get('WORK_MS') || '50', 10);
      loadConfig.route = (envMap.get('ROUTE') || 'work') as any;
      loadConfig.sleepMs = parseInt(envMap.get('SLEEP_MS') || '100', 10);
      const targetsStr = envMap.get('TARGETS') || '';
      loadConfig.targets = targetsStr ? targetsStr.split(',') : [];
    }

    // Clean internal temporary fields from pod representations
    const cleanPods: PodState[] = svcPods.map((p) => {
      const { _outboundRps, _p95Ms, ...rest } = p;
      return rest;
    });

    return {
      name: svcName,
      hpa: {
        min: minReplicas,
        max: maxReplicas,
        current: currentReplicas,
        desired: desiredReplicas,
        targetCpuPct,
        avgCpuPct,
      },
      rps: Number(totalRps.toFixed(1)),
      errorsPerSec: 0.0,
      p95Ms: serviceP95,
      load: loadConfig,
      traffic: trafficWeightsMap.get(svcName) || [{ release: svcPods[0]?.release || 'current', weight: 100 }],
      pods: cleanPods,
    };
  });

  // 5. Assemble Call Graph
  const callGraphMap = new Map<string, number>();
  for (const p of processedPods) {
    const raw = rawPods.find((rp: any) => rp.metadata?.name === p.name);
    const fromSvc = raw?.metadata?.labels?.app?.replace('svc-', '');
    if (fromSvc && p._outboundRps) {
      for (const [toSvc, rps] of Object.entries(p._outboundRps)) {
        if (rps > 0) {
          const key = `${fromSvc}->${toSvc}`;
          callGraphMap.set(key, (callGraphMap.get(key) || 0) + rps);
        }
      }
    }
  }

  const callGraph: CallGraphEdge[] = Array.from(callGraphMap.entries()).map(([key, rps]) => {
    const [from, to] = key.split('->');
    return { from, to, rps: Number(rps.toFixed(1)) };
  });

  // 6. Assemble Events (last 15 events)
  const rawEvents = (eventsRes as any)?.items || [];
  const events: EventItem[] = rawEvents
    .slice(-15)
    .reverse()
    .map((e: any) => ({
      at: e.lastTimestamp || e.eventTime || now,
      reason: e.reason || 'Normal',
      message: e.message || '',
    }));

  const doc: StateDocument = {
    at: now,
    totals: {
      pods: totalPods,
      containers: totalContainers,
      readyContainers,
    },
    services,
    callGraph,
    events,
  };

  latestState = doc;
  for (const listener of listeners) {
    try {
      listener(doc);
    } catch {
      // ignore
    }
  }

  return doc;
}

export function startPoller(intervalMs = 2000): NodeJS.Timeout {
  pollCluster().catch(() => {});
  return setInterval(() => {
    pollCluster().catch((err) => {
      console.error('Poller error:', err);
    });
  }, intervalMs);
}
