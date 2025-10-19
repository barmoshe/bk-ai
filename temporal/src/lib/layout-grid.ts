/**
 * Professional layout grid system based on design principles
 * - 8pt baseline grid for consistent spacing
 * - Golden ratio (1.618) for harmonious proportions
 * - Modular scale for typography
 * - Safe zones for print (bleed, trim, type-safe)
 */

export const GOLDEN_RATIO = 1.618;
export const BASELINE_GRID = 8;
export const MODULAR_SCALE_RATIO = 1.5;

/**
 * Snap value to baseline grid
 */
export function snapToGrid(value: number, grid: number = BASELINE_GRID): number {
  return Math.round(value / grid) * grid;
}

/**
 * Calculate dimensions using golden ratio
 * Returns [smaller, larger] where larger/smaller ≈ 1.618
 */
export function goldenRatio(total: number): [number, number] {
  const smaller = total / (1 + GOLDEN_RATIO);
  const larger = total - smaller;
  return [snapToGrid(smaller), snapToGrid(larger)];
}

/**
 * Calculate modular scale for typography
 * Base size multiplied by ratio^step
 */
export function modularScale(baseSize: number, step: number, ratio: number = MODULAR_SCALE_RATIO): number {
  return Math.round(baseSize * Math.pow(ratio, step));
}

/**
 * Calculate optimal font size based on content area width
 * Following typographic principles: 45-75 characters per line
 */
export function optimalFontSize(contentWidth: number, targetCharsPerLine: number = 60): number {
  // Average character width is roughly 0.5em for most fonts
  const fontSize = contentWidth / (targetCharsPerLine * 0.5);
  // Clamp to reasonable range and snap to modular scale
  const clamped = Math.max(20, Math.min(72, fontSize));
  // Round to nearest modular scale step
  const baseSteps = [20, 24, 28, 32, 36, 42, 48, 56, 64, 72];
  return baseSteps.reduce((prev, curr) => 
    Math.abs(curr - clamped) < Math.abs(prev - clamped) ? curr : prev
  );
}

/**
 * Safe zones for print design
 */
export interface SafeZones {
  /** Full canvas including bleed */
  full: { x: number; y: number; width: number; height: number };
  /** Trim area (final printed size) */
  trim: { x: number; y: number; width: number; height: number };
  /** Safe area for critical content (inside margins) */
  safe: { x: number; y: number; width: number; height: number };
  /** Type-safe area (optimal for text, 10% inside margins) */
  typeSafe: { x: number; y: number; width: number; height: number };
}

/**
 * Calculate safe zones for print layout
 */
export function calculateSafeZones(
  widthPx: number,
  heightPx: number,
  bleedPx: number,
  marginsPx: { top: number; right: number; bottom: number; left: number }
): SafeZones {
  const trimX = bleedPx;
  const trimY = bleedPx;
  const trimWidth = widthPx - 2 * bleedPx;
  const trimHeight = heightPx - 2 * bleedPx;

  const safeX = trimX + marginsPx.left;
  const safeY = trimY + marginsPx.top;
  const safeWidth = trimWidth - marginsPx.left - marginsPx.right;
  const safeHeight = trimHeight - marginsPx.top - marginsPx.bottom;

  // Type-safe area is 10% further inside safe area
  const typeInsetX = Math.floor(safeWidth * 0.05);
  const typeInsetY = Math.floor(safeHeight * 0.05);

  return {
    full: { x: 0, y: 0, width: widthPx, height: heightPx },
    trim: { x: trimX, y: trimY, width: trimWidth, height: trimHeight },
    safe: { x: safeX, y: safeY, width: safeWidth, height: safeHeight },
    typeSafe: {
      x: safeX + typeInsetX,
      y: safeY + typeInsetY,
      width: safeWidth - 2 * typeInsetX,
      height: safeHeight - 2 * typeInsetY,
    },
  };
}

/**
 * Layout proportions using rule of thirds
 * Returns positions at 1/3 and 2/3 points
 */
export function ruleOfThirds(dimension: number): { first: number; second: number } {
  return {
    first: snapToGrid(dimension / 3),
    second: snapToGrid((dimension * 2) / 3),
  };
}

/**
 * Calculate gutters (spacing between elements)
 * Uses modular scale based on container size
 */
export function calculateGutter(containerSize: number, ratio: number = 0.04): number {
  const gutter = containerSize * ratio;
  return snapToGrid(Math.max(BASELINE_GRID, gutter));
}

/**
 * Optical adjustment for visual balance
 * Asymmetric layouts need slight adjustments for perceived balance
 */
export function opticalBalance(position: number, direction: 'up' | 'down' | 'left' | 'right'): number {
  // Visual weight adjustments (2-4px typically)
  const adjustment = BASELINE_GRID / 2;
  switch (direction) {
    case 'up':
    case 'left':
      return position - adjustment;
    case 'down':
    case 'right':
      return position + adjustment;
  }
}

/**
 * Calculate optimal image size within bounds using golden ratio
 */
export function imageProportions(
  containerWidth: number,
  containerHeight: number,
  fillRatio: number = 0.7
): { width: number; height: number } {
  const targetArea = containerWidth * containerHeight * fillRatio;
  // Use golden ratio for aspect
  const height = Math.sqrt(targetArea / GOLDEN_RATIO);
  const width = height * GOLDEN_RATIO;
  
  // Ensure it fits in container
  const scale = Math.min(
    containerWidth / width,
    containerHeight / height,
    1
  );
  
  return {
    width: snapToGrid(width * scale),
    height: snapToGrid(height * scale),
  };
}

