import { validatePagesResponse } from '../lib/schemas';

describe('validatePagesResponse', () => {
  it('coerces and fills missing pages', () => {
    const prefs: any = { pages: 3, topic: 'fox adventure' };
    const obj = { pages: [{ pageIndex: 2, text: 'hi', imagePrompt: 'forest', layout: 'imageLeft', imageUrl: '' }] };
    const pages = validatePagesResponse(obj, prefs);
    expect(pages.length).toBe(3);
    expect(pages[1].pageIndex).toBe(2);
    expect(pages[0].pageIndex).toBe(1);
  });
});


