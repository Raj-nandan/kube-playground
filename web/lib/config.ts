export const DASHBOARD_CONFIG = {
  // Load generation slider boundaries
  LOAD_DRIVERS: {
    MIN_VUS: 0,
    MAX_VUS: 500,
    DEFAULT_VUS: 40,
    VUS_STEP: 5,
    MIN_WORK_MS: 10,
    MAX_WORK_MS: 500,
    DEFAULT_WORK_MS: 50,
    WORK_MS_STEP: 10,
    DEBOUNCE_PATCH_MS: 300,
  },
  // Telemetry & poll timings
  POLL_INTERVAL_MS: 1500,
  SSE_RETRY_MS: 3000,
  HPA_TARGET_CPU_PCT: 50,
  TREND_HISTORY_POINTS: 36, // 36 points * 5s = 3 minutes history
};
