import path from 'path';

// Lightweight mapping from illustration style packs to print-safe font stacks
// Families here should correspond to WOFF2 assets placed under public/fonts
// If assets are missing at runtime, callers must fall back to system stacks

export type FontStack = {
  bodyFamily: string; // CSS font-family stack
  displayFamily: string; // CSS font-family stack for headings if needed
  // Optional local asset filenames (woff2) keyed by weight
  assets?: {
    familyName: string; // canonical name used in @font-face
    files: Record<string, string>; // e.g., { '400': 'Nunito-Regular.woff2', '700': 'Nunito-Bold.woff2' }
  };
};

// Known style pack IDs come from ./stylePacks
export type StylePackId =
  | 'storybook_watercolor'
  | 'flat_vector'
  | 'soft_clay'
  | 'soft_watercolor'
  | 'bold_flat_shapes'
  | 'crayon_paper_cut';

const SYSTEM_SANS = "Atkinson Hyperlegible, Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
const SYSTEM_SERIF = "Lora, Georgia, 'Iowan Old Style', 'Apple Garamond', Baskerville, 'Times New Roman', 'Droid Serif', Times, serif";

const FONT_MAP: Record<StylePackId, FontStack> = {
  storybook_watercolor: {
    bodyFamily: `Lora, ${SYSTEM_SERIF}`,
    displayFamily: `Lora, ${SYSTEM_SERIF}`,
    assets: {
      familyName: 'Lora',
      files: { '400': 'Lora-Regular.woff2', '700': 'Lora-Bold.woff2' },
    },
  },
  soft_watercolor: {
    bodyFamily: `Lora, ${SYSTEM_SERIF}`,
    displayFamily: `Lora, ${SYSTEM_SERIF}`,
    assets: {
      familyName: 'Lora',
      files: { '400': 'Lora-Regular.woff2', '700': 'Lora-Bold.woff2' },
    },
  },
  flat_vector: {
    bodyFamily: `Nunito, ${SYSTEM_SANS}`,
    displayFamily: `M PLUS Rounded 1c, Nunito, ${SYSTEM_SANS}`,
    assets: {
      familyName: 'Nunito',
      files: { '400': 'Nunito-Regular.woff2', '700': 'Nunito-Bold.woff2' },
    },
  },
  bold_flat_shapes: {
    bodyFamily: `Nunito, ${SYSTEM_SANS}`,
    displayFamily: `Fredoka, Nunito, ${SYSTEM_SANS}`,
    assets: {
      familyName: 'Nunito',
      files: { '400': 'Nunito-Regular.woff2', '700': 'Nunito-Bold.woff2' },
    },
  },
  soft_clay: {
    bodyFamily: `Nunito, ${SYSTEM_SANS}`,
    displayFamily: `Nunito, ${SYSTEM_SANS}`,
    assets: {
      familyName: 'Nunito',
      files: { '400': 'Nunito-Regular.woff2', '700': 'Nunito-Bold.woff2' },
    },
  },
  crayon_paper_cut: {
    bodyFamily: `M PLUS Rounded 1c, Nunito, ${SYSTEM_SANS}`,
    displayFamily: `Baloo 2, M PLUS Rounded 1c, Nunito, ${SYSTEM_SANS}`,
    assets: {
      familyName: 'M PLUS Rounded 1c',
      files: { '400': 'MPLUSRounded1c-Regular.woff2', '700': 'MPLUSRounded1c-Bold.woff2' },
    },
  },
};

export function getFontStackForStylePack(stylePackId?: string): FontStack {
  if (!stylePackId) {
    return { bodyFamily: SYSTEM_SANS, displayFamily: SYSTEM_SANS };
  }
  const id = stylePackId as StylePackId;
  return FONT_MAP[id] ?? { bodyFamily: SYSTEM_SANS, displayFamily: SYSTEM_SANS };
}

export function getPublicFontPath(fileName: string): string {
  // Fonts are expected under public/fonts
  return path.join(process.cwd(), 'public', 'fonts', fileName);
}

/**
 * Try to find a FontStack based on the preferred family name at the start of a CSS font-family string.
 * Example: "Lora, Georgia, ..." → returns the Lora stack if configured.
 */
export function findStackByPreferredFamily(fontFamily: string | undefined): FontStack | null {
  if (!fontFamily) return null;
  const preferred = fontFamily.split(',')[0].trim().replace(/^['"]|['"]$/g, '');
  const entries = Object.values(FONT_MAP);
  for (const stack of entries) {
    if (stack.assets && stack.assets.familyName === preferred) {
      return stack;
    }
  }
  return null;
}


