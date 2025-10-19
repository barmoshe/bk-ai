export type RetryPolicy = {
  retries: number;
  initialBackoffMs: number;
  maxBackoffMs?: number;
};

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function retry<T>(fn: () => Promise<T>, policy: RetryPolicy): Promise<T> {
  let attempt = 0;
  let backoff = policy.initialBackoffMs;
  const maxBackoff = policy.maxBackoffMs ?? policy.initialBackoffMs * 8;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      return await fn();
    } catch (e: any) {
      attempt += 1;
      if (attempt > policy.retries) throw e;
      const delay = computeBackoffMs({ attempt, baseMs: backoff, jitter: true, maxBackoffMs: maxBackoff });
      await sleep(delay);
      backoff = Math.min(maxBackoff, Math.floor(backoff * 1.8));
    }
  }
}

export function computeBackoffMs(args: { attempt: number; baseMs: number; jitter?: boolean; maxBackoffMs?: number }): number {
  const { attempt, baseMs, jitter = true, maxBackoffMs } = args;
  const exp = Math.max(1, Math.min(6, attempt));
  let ms = Math.floor(baseMs * Math.pow(1.8, exp - 1));
  if (typeof maxBackoffMs === 'number') ms = Math.min(ms, maxBackoffMs);
  if (jitter) {
    const spread = Math.min(ms, 1000);
    ms += Math.floor(Math.random() * spread);
  }
  return ms;
}

export function respectRetryAfter(headerValue: string | null | undefined, fallbackMs: number): number {
  if (!headerValue) return fallbackMs;
  const asInt = parseInt(headerValue, 10);
  if (!Number.isNaN(asInt) && asInt >= 0 && asInt < 3600) return asInt * 1000;
  const asDate = Date.parse(headerValue);
  if (!Number.isNaN(asDate)) {
    const delta = asDate - Date.now();
    if (delta > 0 && delta < 10 * 60 * 1000) return delta;
  }
  return fallbackMs;
}


