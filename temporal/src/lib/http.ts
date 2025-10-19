import { respectRetryAfter, computeBackoffMs } from './retry';

type FetchArgs = {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: any;
  timeoutMs: number;
  idempotencyKey?: string;
  maxAttempts?: number;
  onRetry?: (info: { attempt: number; delayMs: number; status?: number }) => void | Promise<void>;
};

export async function fetchWithRetry<T = any>({ url, method = 'GET', headers = {}, body, timeoutMs, idempotencyKey, maxAttempts = 3, onRetry }: FetchArgs): Promise<Response> {
  const attempts = Math.max(1, maxAttempts);
  let attempt = 0;
  while (true) {
    attempt += 1;
    const controller = new AbortController();
    const to = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method,
        headers: idempotencyKey ? { ...headers, 'Idempotency-Key': idempotencyKey } : headers,
        body,
        signal: controller.signal as any,
      } as any);
      if (res.ok) return res;
      // Retry on 429/5xx only
      if ((res.status === 429 || res.status >= 500) && attempt < attempts) {
        const retryAfterHeader = res.headers.get('retry-after');
        const backoff = respectRetryAfter(retryAfterHeader, computeBackoffMs({ attempt, baseMs: 1000 }));
        if (onRetry) await onRetry({ attempt, delayMs: backoff, status: res.status });
        await new Promise(r => setTimeout(r, backoff));
        continue;
      }
      return res;
    } catch (e: any) {
      if (attempt >= attempts) throw e;
      const backoff = computeBackoffMs({ attempt, baseMs: 800 });
      if (onRetry) await onRetry({ attempt, delayMs: backoff });
      await new Promise(r => setTimeout(r, backoff));
      continue;
    } finally {
      clearTimeout(to);
    }
  }
}


