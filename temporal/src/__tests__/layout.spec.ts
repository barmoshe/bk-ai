import { buildLayoutMetadata } from '../lib/layout';

describe('buildLayoutMetadata', () => {
  it('produces positions and textArea with margins and grid snap', () => {
    const meta = buildLayoutMetadata({ text: 'hello world', stylePackId: 'storybook_watercolor', seed: 'seed' });
    expect(meta.canvas.width).toBeGreaterThan(0);
    expect(meta.positions.character.w).toBeGreaterThan(0);
    expect(meta.textArea.x % 8).toBe(0);
  });
});


