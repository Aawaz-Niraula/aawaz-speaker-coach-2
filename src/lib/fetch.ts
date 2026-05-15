type TrafficClass = 'transcription' | 'chat' | 'tts' | 'voice';

type TrafficPool = {
  active: number;
  queue: Array<() => void>;
};

const trafficPools = new Map<TrafficClass, TrafficPool>();

const DEFAULT_TRAFFIC_LIMITS: Record<TrafficClass, number> = {
  transcription: 4,
  chat: 8,
  tts: 4,
  voice: 2,
};

function getTrafficLimit(kind: TrafficClass) {
  const value = Number(process.env[`AAWAZ_${kind.toUpperCase()}_CONCURRENCY`]);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : DEFAULT_TRAFFIC_LIMITS[kind];
}

async function acquireTrafficSlot(kind: TrafficClass, waitMs = 10000) {
  const pool = trafficPools.get(kind) ?? { active: 0, queue: [] };
  trafficPools.set(kind, pool);

  if (pool.active < getTrafficLimit(kind)) {
    pool.active += 1;
    return;
  }

  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      const index = pool.queue.indexOf(allow);
      if (index >= 0) pool.queue.splice(index, 1);
      reject(new Error('Server is busy. Please try again in a moment.'));
    }, waitMs);

    const allow = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      pool.active += 1;
      resolve();
    };

    pool.queue.push(allow);
  });
}

function releaseTrafficSlot(kind: TrafficClass) {
  const pool = trafficPools.get(kind);
  if (!pool) return;

  pool.active = Math.max(0, pool.active - 1);
  const next = pool.queue.shift();
  if (next) next();
}

export async function fetchWithRetry(url: string, options: RequestInit, retries = 1, delayMs = 1000, timeoutMs?: number): Promise<Response> {
  let lastError: Error | unknown;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const currentOptions = { ...options };
      if (timeoutMs) {
        currentOptions.signal = AbortSignal.timeout(timeoutMs);
      }
      
      const res = await fetch(url, currentOptions);
      // Wait and retry if we hit server errors or model overload/rate-limiting (429)
      if (res.ok || (res.status < 500 && res.status !== 429)) {
        return res;
      }
      
      // If it's a 5xx error or 429, it is transient, so we retry
      if (attempt === retries) {
        return res;
      }
    } catch (error) {
      lastError = error;
      if (attempt === retries) {
        break;
      }
    }
    
    // Wait before retrying with exponential backoff and jitter to prevent thundering herd during heavy traffic
    const jitter = Math.random() * 300;
    const currentDelay = delayMs * Math.pow(1.5, attempt) + jitter;
    await new Promise((resolve) => setTimeout(resolve, currentDelay));
  }
  
  throw lastError || new Error('Fetch failed after retries');
}

export async function fetchWithRetryLimited(
  kind: TrafficClass,
  url: string,
  options: RequestInit,
  retries = 1,
  delayMs = 1000,
  timeoutMs?: number,
): Promise<Response> {
  await acquireTrafficSlot(kind);

  try {
    return await fetchWithRetry(url, options, retries, delayMs, timeoutMs);
  } finally {
    releaseTrafficSlot(kind);
  }
}
