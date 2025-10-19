import { buildPrompt } from '../lib/promptComposer';

describe('buildPrompt', () => {
  it('builds normalized prompt and hash', () => {
    const { prompt, promptHash } = buildPrompt({ category: 'fox', stylePackId: 'storybook_watercolor', pose: 'sitting', expression: 'smiling' });
    expect(prompt).toMatch(/Create a fox/);
    expect(prompt).toMatch(/transparent PNG/);
    expect(promptHash).toMatch(/^[a-f0-9]{16}$/);
  });
});


