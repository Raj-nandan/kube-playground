export interface ContainerState {
  name: string;
  ready: boolean;
}

export interface PodState {
  name: string;
  phase: string;
  state: 'Pending' | 'Running' | 'Ready' | 'Terminating' | 'CrashLoop' | 'OOMKilled' | 'ImagePullError';
  startedAt: string;
  restarts: number;
  track: string;
  release: string;
  containers: ContainerState[];
  cpuMilli: number;
  cpuRequestMilli: number;
  cpuSampledAt: string;
  rps: number;
  inflight: number;
}

export interface HpaState {
  min: number;
  max: number;
  current: number;
  desired: number;
  targetCpuPct: number;
  avgCpuPct: number;
}

export interface LoadConfig {
  running: boolean;
  vus: number;
  workMs: number;
  route: 'work' | 'chain' | 'fanout';
  targets: string[];
  sleepMs: number;
}

export interface TrafficSplit {
  release: string;
  weight: number;
}

export interface ServiceState {
  name: 'a' | 'b' | 'c';
  hpa: HpaState;
  rps: number;
  errorsPerSec: number;
  p95Ms: number;
  load: LoadConfig;
  traffic: TrafficSplit[];
  pods: PodState[];
}

export interface CallGraphEdge {
  from: string;
  to: string;
  rps: number;
}

export interface EventItem {
  at: string;
  reason: string;
  message: string;
}

export interface Totals {
  pods: number;
  containers: number;
  readyContainers: number;
}

export interface StateDocument {
  at: string;
  totals: Totals;
  services: ServiceState[];
  callGraph: CallGraphEdge[];
  events: EventItem[];
}

