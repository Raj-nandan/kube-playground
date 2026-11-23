import * as k8s from '@kubernetes/client-node';
import { StartLoadParams } from './types.js';

const kc = new k8s.KubeConfig();
kc.loadFromDefault();

export const coreApi = kc.makeApiClient(k8s.CoreV1Api);
export const appsApi = kc.makeApiClient(k8s.AppsV1Api);
export const autoscalingApi = kc.makeApiClient(k8s.AutoscalingV2Api);
export const batchApi = kc.makeApiClient(k8s.BatchV1Api);
export const customObjectsApi = kc.makeApiClient(k8s.CustomObjectsApi);

export const APPS_NAMESPACE = process.env.APPS_NAMESPACE || 'apps';
export const LOADTEST_NAMESPACE = process.env.LOADTEST_NAMESPACE || 'loadtest';
export const BASE_URL = process.env.BASE_URL || 'http://ingress-nginx-controller.ingress-nginx.svc.cluster.local';
export const K6_IMAGE = process.env.K6_IMAGE || 'grafana/k6:0.50.0';

export async function createOrReplaceK6Job(service: string, params: StartLoadParams): Promise<void> {
  const jobName = `k6-${service}`;
  const targetsStr = Array.isArray(params.targets)
    ? params.targets.join(',')
    : (params.targets || '');

  // Delete existing job if any
  try {
    await batchApi.deleteNamespacedJob({
      name: jobName,
      namespace: LOADTEST_NAMESPACE,
      propagationPolicy: 'Background',
    });
    // Wait briefly for deletion
    await new Promise((r) => setTimeout(r, 1000));
  } catch (err: any) {
    // Ignore 404
  }

  const jobSpec: k8s.V1Job = {
    apiVersion: 'batch/v1',
    kind: 'Job',
    metadata: {
      name: jobName,
      namespace: LOADTEST_NAMESPACE,
      labels: {
        app: 'k6',
        target: service,
        'part-of': 'playground',
      },
    },
    spec: {
      backoffLimit: 0,
      activeDeadlineSeconds: 3600,
      ttlSecondsAfterFinished: 60,
      template: {
        metadata: {
          labels: {
            app: 'k6',
            target: service,
          },
        },
        spec: {
          restartPolicy: 'Never',
          containers: [
            {
              name: 'k6',
              image: K6_IMAGE,
              imagePullPolicy: 'IfNotPresent',
              args: ['run', '--address', '0.0.0.0:6565', '/scripts/load.js'],
              env: [
                { name: 'BASE_URL', value: BASE_URL },
                { name: 'TARGET', value: service },
                { name: 'ROUTE', value: params.route },
                { name: 'TARGETS', value: targetsStr },
                { name: 'WORK_MS', value: String(params.workMs) },
                { name: 'SLEEP_MS', value: String(params.sleepMs ?? 100) },
                { name: 'INITIAL_VUS', value: String(params.vus) },
              ],
              ports: [{ name: 'control', containerPort: 6565 }],
              volumeMounts: [{ name: 'script', mountPath: '/scripts' }],
            },
          ],
          volumes: [
            {
              name: 'script',
              configMap: { name: 'k6-script' },
            },
          ],
        },
      },
    },
  };

  await batchApi.createNamespacedJob({
    namespace: LOADTEST_NAMESPACE,
    body: jobSpec,
  });
}

export async function deleteK6Job(service: string): Promise<void> {
  const jobName = `k6-${service}`;
  await batchApi.deleteNamespacedJob({
    name: jobName,
    namespace: LOADTEST_NAMESPACE,
    propagationPolicy: 'Background',
  });
}

export async function findK6PodIp(service: string): Promise<string | null> {
  const res = await coreApi.listNamespacedPod({
    namespace: LOADTEST_NAMESPACE,
    labelSelector: `app=k6,target=${service}`,
  });

  for (const pod of res.items) {
    if (pod.status?.phase === 'Running' && pod.status?.podIP) {
      return pod.status.podIP;
    }
  }
  return null;
}

export async function updateK6VUs(podIp: string, vus: number): Promise<boolean> {
  const url = `http://${podIp}:6565/v1/status`;
  const body = {
    data: {
      type: 'status',
      id: 'default',
      attributes: {
        vus,
      },
    },
  };

  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(2000),
  });

  return res.ok;
}

