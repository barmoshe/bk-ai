import type { BookTheme, ThemeAspectRatio } from '@/types/book';

// Simple seeded RNG (LCG)
function createSeededRng(seed: string) {
  let h = 2166136261 >>> 0; // FNV-1a
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let state = h >>> 0;
  return function rng() {
    // LCG constants
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return (state & 0xffffffff) / 0x100000000;
  };
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100; l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (0 <= h && h < 60) { r = c; g = x; b = 0; }
  else if (60 <= h && h < 120) { r = x; g = c; b = 0; }
  else if (120 <= h && h < 180) { r = 0; g = c; b = x; }
  else if (180 <= h && h < 240) { r = 0; g = x; b = c; }
  else if (240 <= h && h < 300) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }
  const toHex = (n: number) => Math.round((n + m) * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function clamp(val: number, min: number, max: number) {
  return Math.max(min, Math.min(max, val));
}

function pick<T>(rng: () => number, arr: ReadonlyArray<T>): T {
  if (!arr || arr.length === 0) throw new Error('pick() called with empty array');
  const idx = Math.floor(rng() * arr.length);
  return arr[idx >= 0 && idx < arr.length ? idx : 0];
}

const FONT_PAIRS: ReadonlyArray<{ id: string; heading: string; body: string; display?: string; hints: string[] }> = [
  { id: 'storybook-bright', heading: "var(--font-fredoka), var(--font-heading-var), system-ui", body: "var(--font-nunito), var(--font-body-var), system-ui", hints: ['bold flat shapes', 'modern storybook'] },
  { id: 'classic-serif', heading: "var(--font-lora), var(--font-heading-var), serif", body: "var(--font-lora), var(--font-body-var), serif", hints: ['classic storybook', 'painterly'] },
  { id: 'rounded-fun', heading: "var(--font-mplus-rounded), var(--font-heading-var), system-ui", body: "var(--font-nunito), var(--font-body-var), system-ui", hints: ['playful', 'rounded forms'] },
  { id: 'modern-clean', heading: "var(--font-heading-var), Inter, system-ui", body: "var(--font-body-var), Atkinson Hyperlegible, system-ui", hints: ['minimal', 'clean lines'] },
];

const ASPECTS: ThemeAspectRatio[] = ['4:3', '3:2', '1:1'];

export function generateThemeFromSeed(seed: string): BookTheme {
  const rng = createSeededRng(seed);
  const baseHue = Math.floor(rng() * 360);
  const primary = hslToHex(baseHue, 65, 55);
  const secondary = hslToHex((baseHue + 40) % 360, 55, 60);
  const accent = hslToHex((baseHue + 300) % 360, 70, 50);
  const bg = hslToHex((baseHue + 20) % 360, 60, 96);
  const muted = hslToHex((baseHue + 20) % 360, 25, 85);
  const text = '#111827';

  let fontPair: (typeof FONT_PAIRS)[number];
  try {
    fontPair = pick(rng, FONT_PAIRS);
  } catch {
    fontPair = FONT_PAIRS[0];
  }
  const imagePlacement = pick(rng, ['imageLeft', 'imageRight', 'imageTop'] as const);
  const aspectRatio = pick(rng, ASPECTS);

  return {
    id: fontPair.id,
    seed,
    palette: { primary, secondary, accent, bg, text, muted },
    font: { heading: fontPair.heading, body: fontPair.body, display: fontPair.display },
    layout: { imagePlacement, gutter: Math.round(clamp(16 + rng() * 16, 16, 28)) },
    image: { aspectRatio, styleHints: fontPair.hints },
  };
}

export function cssVarsForTheme(theme: BookTheme): React.CSSProperties {
  return {
    ['--color-bg' as any]: theme.palette.bg,
    ['--color-text' as any]: theme.palette.text,
    ['--color-primary' as any]: theme.palette.primary,
    ['--color-accent' as any]: theme.palette.accent,
    ['--color-muted' as any]: theme.palette.muted,
    ['--font-body' as any]: theme.font.body,
    ['--font-heading' as any]: theme.font.heading,
  } as React.CSSProperties;
}

export function cssAspect(aspect: ThemeAspectRatio): string {
  // Convert `4:3` -> `4 / 3`
  const [w, h] = aspect.split(':');
  return `${w.trim()} / ${h.trim()}`;
}


