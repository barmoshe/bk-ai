import { validatePagesResponse } from '../lib/schemas';
import { BookPrefs, PageJSON } from '../types';

describe('validatePagesResponse', () => {
  const mockPrefs: BookPrefs = {
    title: 'Test Book',
    topic: 'Adventure',
    targetAge: 5,
    pages: 3,
    tone: 'cheerful',
  };

  it('should validate and coerce valid pages', () => {
    const input = {
      pages: [
        { pageIndex: 1, text: 'Page 1 text', imagePrompt: 'scene 1', layout: 'imageTop', imageUrl: '' },
        { pageIndex: 2, text: 'Page 2 text', imagePrompt: 'scene 2', layout: 'imageLeft', imageUrl: '' },
        { pageIndex: 3, text: 'Page 3 text', imagePrompt: 'scene 3', layout: 'imageRight', imageUrl: '' },
      ],
    };
    const result = validatePagesResponse(input, mockPrefs);
    expect(result).toHaveLength(3);
    expect(result[0].pageIndex).toBe(1);
    expect(result[0].text).toBe('Page 1 text');
  });

  it('should fill missing pages with fallback', () => {
    const input = {
      pages: [
        { pageIndex: 1, text: 'Page 1', imagePrompt: 'scene 1', layout: 'imageTop', imageUrl: '' },
      ],
    };
    const result = validatePagesResponse(input, mockPrefs);
    expect(result).toHaveLength(3);
    expect(result[1].pageIndex).toBe(2);
    expect(result[1].imagePrompt).toContain('Adventure');
  });

  it('should handle empty input gracefully', () => {
    const result = validatePagesResponse({}, mockPrefs);
    expect(result).toHaveLength(3);
    expect(result[0].pageIndex).toBe(1);
  });
});

