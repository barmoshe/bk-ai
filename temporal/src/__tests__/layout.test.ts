// Basic layout rect math tests
describe('Layout rect calculations', () => {
  function inchesToPixels(inches: number, dpi: number): number {
    return Math.round(inches * dpi);
  }

  it('should convert inches to pixels correctly', () => {
    expect(inchesToPixels(1, 300)).toBe(300);
    expect(inchesToPixels(8.5, 300)).toBe(2550);
    expect(inchesToPixels(0.5, 144)).toBe(72);
  });

  it('should calculate bleed correctly', () => {
    const bleedIn = 0.125;
    const dpi = 300;
    const bleedPx = inchesToPixels(bleedIn, dpi);
    expect(bleedPx).toBe(38);
  });

  it('should calculate page dimensions with bleed', () => {
    const widthIn = 8.5;
    const heightIn = 11;
    const bleedIn = 0.125;
    const dpi = 300;
    const totalWidth = inchesToPixels(widthIn + 2 * bleedIn, dpi);
    const totalHeight = inchesToPixels(heightIn + 2 * bleedIn, dpi);
    expect(totalWidth).toBe(2625);
    expect(totalHeight).toBe(3375);
  });
});

