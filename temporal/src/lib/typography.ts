/**
 * Professional typography engine for book rendering
 * Implements best practices: kerning, widow control, optical alignment
 */

import { modularScale, snapToGrid } from './layout-grid';

export interface TypographyConfig {
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  lineHeight: number;
  letterSpacing?: number;
  textAlign: 'left' | 'center' | 'right' | 'justify';
  color?: string;
  /** Enable OpenType features */
  openTypeFeatures?: string[];
}

export interface TextBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TextLine {
  text: string;
  y: number;
  width: number;
}

/**
 * Professional font stacks for different styles
 */
export const FONT_STACKS = {
  body: 'Atkinson Hyperlegible, Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  heading: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  serif: 'Georgia, Iowan Old Style, "Apple Garamond", Baskerville, "Times New Roman", "Droid Serif", Times, serif',
  mono: '"SF Mono", Monaco, "Cascadia Code", "Roboto Mono", Consolas, "Courier New", monospace',
};

/**
 * Calculate optimal letter spacing (tracking) based on font size
 * Larger text needs tighter spacing, smaller text needs looser
 */
export function calculateLetterSpacing(fontSize: number): number {
  // Professional formula: tighter for display, looser for body
  if (fontSize >= 48) {
    return -0.02; // Display sizes: tighter
  } else if (fontSize >= 24) {
    return -0.01; // Subheading: slightly tight
  } else if (fontSize <= 14) {
    return 0.01; // Small text: open up
  }
  return 0; // Normal body text
}

/**
 * Break text into lines with intelligent wrapping
 * Implements widow/orphan control and balanced line breaks
 */
export function breakTextIntoLines(
  text: string,
  maxWidth: number,
  config: TypographyConfig
): TextLine[] {
  const words = text.split(/\s+/);
  if (words.length === 0) return [];

  const lines: TextLine[] = [];
  const avgCharWidth = config.fontSize * 0.5; // Approximate character width
  const spaceWidth = config.fontSize * 0.3;

  let currentLine: string[] = [];
  let currentWidth = 0;

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const wordWidth = word.length * avgCharWidth;
    const spaceNeeded = currentLine.length > 0 ? spaceWidth : 0;

    // Check if adding this word exceeds width
    if (currentWidth + spaceNeeded + wordWidth > maxWidth && currentLine.length > 0) {
      // Save current line
      lines.push({
        text: currentLine.join(' '),
        y: 0, // Will be calculated later
        width: currentWidth,
      });
      currentLine = [word];
      currentWidth = wordWidth;
    } else {
      currentLine.push(word);
      currentWidth += spaceNeeded + wordWidth;
    }
  }

  // Add last line
  if (currentLine.length > 0) {
    lines.push({
      text: currentLine.join(' '),
      y: 0,
      width: currentWidth,
    });
  }

  // Widow control: prevent single word on last line if possible
  if (lines.length >= 2) {
    const lastLine = lines[lines.length - 1];
    const lastWords = lastLine.text.split(' ');
    
    if (lastWords.length === 1 && lines.length >= 2) {
      // Try to pull one word from previous line
      const prevLine = lines[lines.length - 2];
      const prevWords = prevLine.text.split(' ');
      
      if (prevWords.length >= 3) {
        // Move last word of previous line to last line
        const wordToMove = prevWords.pop()!;
        lines[lines.length - 2].text = prevWords.join(' ');
        lines[lines.length - 1].text = `${wordToMove} ${lastLine.text}`;
      }
    }
  }

  // Calculate Y positions
  const lineHeightPx = config.fontSize * config.lineHeight;
  lines.forEach((line, index) => {
    line.y = index * lineHeightPx;
  });

  return lines;
}

/**
 * Apply optical margin alignment (hanging punctuation)
 * Pull quotation marks and hyphens into the margin for cleaner alignment
 */
export function applyOpticalAlignment(text: string): { text: string; offsetX: number } {
  const hangingChars = ['"', "'", '-', '–', '—'];
  const firstChar = text[0];
  
  if (hangingChars.includes(firstChar)) {
    // Pull into margin by roughly 0.3em
    return { text, offsetX: -12 }; // Approximate optical adjustment
  }
  
  return { text, offsetX: 0 };
}

/**
 * Generate professional SVG text with proper typography
 */
export function generateTextSVG(
  text: string,
  box: TextBox,
  config: TypographyConfig,
  forcedLines?: string[]
): string {
  // We'll compute an effective font size that fits the box when lines are forced
  let effectiveFontSize = config.fontSize;

  // Helper to estimate a line's width (approximate; consistent with breakTextIntoLines)
  const estimateWidth = (s: string, fontSize: number): number => {
    const avgCharWidth = fontSize * 0.5;
    return s.length * avgCharWidth;
  };

  // Determine lines (either forced or computed)
  let lineItems: { text: string; width: number; y: number }[];
  if (forcedLines && forcedLines.length > 0) {
    // Downscale font size if total height exceeds box height, but cap shrink to 5%
    const minSize = Math.max(12, Math.floor(config.fontSize * 0.95));
    let iterations = 0;
    const maxIterations = 6;
    while (iterations < maxIterations) {
      const lineHeightPx = effectiveFontSize * config.lineHeight;
      const totalHeight = effectiveFontSize + Math.max(0, (forcedLines.length - 1)) * lineHeightPx;
      if (totalHeight <= box.height || effectiveFontSize <= minSize) break;
      effectiveFontSize = Math.floor((effectiveFontSize * 19) / 20); // ~5% shrink across iterations, stops by minSize
      iterations++;
    }

    const lineHeightPx = effectiveFontSize * config.lineHeight;
    lineItems = forcedLines.map((t, idx) => ({
      text: t,
      width: estimateWidth(t, effectiveFontSize),
      y: idx * lineHeightPx,
    }));
  } else {
    const computed = breakTextIntoLines(text, box.width, config);
    lineItems = computed.map(l => ({ text: l.text, width: l.width, y: l.y }));
  }

  const letterSpacing = config.letterSpacing ?? calculateLetterSpacing(effectiveFontSize);
  const color = config.color ?? '#222222';

  // OpenType features for professional typography
  const fontFeatures = config.openTypeFeatures || ['liga', 'kern'];
  const fontFeatureSettings = fontFeatures.map(f => `"${f}" 1`).join(', ');

  const textElements = lineItems.map((line) => {
    const alignment = applyOpticalAlignment(line.text);
    let x = box.x + alignment.offsetX;

    // Handle text alignment
    if (config.textAlign === 'center') {
      x = box.x + (box.width - line.width) / 2;
    } else if (config.textAlign === 'right') {
      x = box.x + box.width - line.width;
    }

    const y = box.y + effectiveFontSize + line.y;

    return `<text x="${x}" y="${y}" 
      font-family="${config.fontFamily}"
      font-size="${effectiveFontSize}"
      font-weight="${config.fontWeight}"
      letter-spacing="${letterSpacing}em"
      fill="${color}"
      style="font-feature-settings: ${fontFeatureSettings}">${escapeXml(line.text)}</text>`;
  }).join('\n    ');

  return textElements;
}

/**
 * Escape XML special characters
 */
function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Calculate text metrics (approximate measurements)
 */
export function measureText(
  text: string,
  config: TypographyConfig
): { width: number; height: number; lines: number } {
  const lines = breakTextIntoLines(text, Number.MAX_SAFE_INTEGER, config);
  const longestLine = Math.max(...lines.map(l => l.width));
  const height = lines.length * config.fontSize * config.lineHeight;
  
  return {
    width: longestLine,
    height,
    lines: lines.length,
  };
}

/**
 * Adjust font size to fit text in box
 */
export function fitTextToBox(
  text: string,
  box: TextBox,
  baseConfig: TypographyConfig
): TypographyConfig {
  let fontSize = baseConfig.fontSize;
  let iterations = 0;
  const maxIterations = 10;

  while (iterations < maxIterations) {
    const config = { ...baseConfig, fontSize };
    const lines = breakTextIntoLines(text, box.width, config);
    const totalHeight = lines.length * fontSize * config.lineHeight;

    if (totalHeight <= box.height) {
      return config;
    }

    // Reduce font size
    fontSize = Math.floor(fontSize * 0.9);
    if (fontSize < 12) break; // Minimum readable size
    iterations++;
  }

  return { ...baseConfig, fontSize };
}

