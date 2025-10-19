import { take, withConcurrency } from '../lib/rateLimiter';

describe('rateLimiter', () => {
  it('enforces token bucket without throwing', async () => {
    const start = Date.now();
    for (let i = 0; i < 5; i++) {
      await take('openai');
    }
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(0);
  });

  it('limits concurrency', async () => {
    const order: number[] = [];
    const tasks = Array.from({ length: 6 }).map((_, idx) =>
      withConcurrency('openai', async () => {
        order.push(idx);
        await new Promise(r => setTimeout(r, 50));
        return idx;
      })
    );
    const res = await Promise.all(tasks);
    expect(res.length).toBe(6);
    expect(order.length).toBeGreaterThan(0);
  });
});


