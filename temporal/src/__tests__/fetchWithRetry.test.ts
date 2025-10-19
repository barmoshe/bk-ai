import { fetchWithRetry } from '../lib/http';

describe('fetchWithRetry', () => {
  it('retries on 429 using Retry-After seconds', async () => {
    let called = 0;
    const originalFetch = (global as any).fetch;
    (global as any).fetch = async () => {
      called += 1;
      if (called === 1) {
        return new Response('rate limited', { status: 429, headers: new Headers({ 'Retry-After': '0' }) });
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: new Headers({ 'Content-Type': 'application/json' }) });
    };
    try {
      const res = await fetchWithRetry({ url: 'http://example.com', timeoutMs: 1000, maxAttempts: 2 });
      expect(res.ok).toBe(true);
    } finally {
      (global as any).fetch = originalFetch;
    }
  });
});


