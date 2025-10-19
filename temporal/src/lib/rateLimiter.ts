import { config } from '../shared';

type Bucket = {
  capacity: number;
  tokens: number;
  refillPerMs: number;
  lastRefill: number;
};

const buckets: Record<string, Bucket> = {};
const semaphores: Record<string, { current: number; limit: number; queue: Array<() => void> }> = {};

function getBucket(name: string): Bucket {
  let b = buckets[name];
  if (!b) {
    const rl = (config.rateLimits as any)?.[name] || { maxRps: 5, burst: 10 };
    b = buckets[name] = {
      capacity: rl.burst ?? 10,
      tokens: rl.burst ?? 10,
      refillPerMs: (rl.maxRps ?? 5) / 1000,
      lastRefill: Date.now(),
    };
  }
  return b;
}

export async function take(name: 'openai' | string): Promise<void> {
  const rl = (config.rateLimits as any)?.[name];
  const devDisabled = rl?.devDisabled && process.env.NODE_ENV !== 'production';
  if (devDisabled) return;

  const b = getBucket(name);
  while (true) {
    const now = Date.now();
    const delta = now - b.lastRefill;
    if (delta > 0) {
      b.tokens = Math.min(b.capacity, b.tokens + delta * b.refillPerMs);
      b.lastRefill = now;
    }
    if (b.tokens >= 1) {
      b.tokens -= 1;
      return;
    }
    const waitMs = Math.max(5, Math.ceil((1 - b.tokens) / b.refillPerMs));
    await new Promise(resolve => setTimeout(resolve, waitMs));
  }
}

export async function withConcurrency<T>(name: 'openai' | string, fn: () => Promise<T>): Promise<T> {
  const cfg = (config.rateLimits as any)?.[name] || { concurrency: 4 };
  const key = `sem:${name}`;
  let sem = semaphores[key];
  if (!sem) sem = semaphores[key] = { current: 0, limit: cfg.concurrency ?? 4, queue: [] };
  if (cfg.devDisabled && process.env.NODE_ENV !== 'production') {
    return fn();
  }
  if (sem.current < sem.limit) {
    sem.current += 1;
    try { return await fn(); } finally { sem.current -= 1; const next = sem.queue.shift(); if (next) next(); }
  }
  await new Promise<void>(resolve => sem!.queue.push(resolve));
  sem.current += 1;
  try { return await fn(); } finally { sem.current -= 1; const next = sem.queue.shift(); if (next) next(); }
}


