import { composeImagePromptV2 } from '../lib/promptComposer';

describe('composeImagePromptV2', () => {
  it('includes layout and policy lines', () => {
    process.env.PROMPT_POLICY_VER = 'v1';
    const prompt = composeImagePromptV2({
      narrative: 'a fox explores a forest',
      ageLevel: 'age5_7',
      stylePackId: 'storybook_watercolor',
      characters: [{ id: 'main', name: 'Foxy', age: 6, traits: ['brave'], physical: [], colorTokens: [] }],
      layout: 'imageTop',
      placementHint: 'leave lower area clear for text',
      extras: ['Pose: standing.'],
    });
    expect(prompt).toMatch(/imageTop/);
    expect(prompt).toMatch(/No text, no watermarks/);
    expect(prompt).toMatch(/leave lower area clear/);
  });
});


