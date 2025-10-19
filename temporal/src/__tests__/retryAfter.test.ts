import { respectRetryAfter } from '../lib/retry';

describe('respectRetryAfter', () => {
  it('parses seconds', () => {
    const ms = respectRetryAfter('2', 1000);
    expect(ms).toBe(2000);
  });

  it('parses http-date', () => {
    const future = new Date(Date.now() + 1500).toUTCString();
    const ms = respectRetryAfter(future, 1000);
    expect(ms).toBeGreaterThan(500);
  });

  it('falls back on bad header', () => {
    const ms = respectRetryAfter('blah', 1200);
    expect(ms).toBe(1200);
  });
});


