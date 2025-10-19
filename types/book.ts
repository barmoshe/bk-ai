export type LayoutOption = 'imageRight' | 'imageLeft' | 'imageTop';

export interface CharacterSpec {
  name: string;
  age: number;
  traits: string[];
  style: string;
  palette: string[];
}

export interface BookPrefs {
  title: string;
  topic: string;
  targetAge: number;
  pages: number;
  tone: string;
}

export interface PageJSON {
  pageIndex: number;
  text: string; // <= 100 words
  imagePrompt: string; // concise visual brief
  layout: LayoutOption;
  imageUrl: string;
}

export interface ManifestPageEntry {
  pageIndex: number;
  textPath: string;
  pngPath: string;
  jpegPath: string;
}

export interface Manifest {
  bookId: string;
  title: string;
  character: CharacterSpec;
  prefs: BookPrefs;
  pages: ManifestPageEntry[];
  // Optional visual theme for this book (generated if absent)
  theme?: BookTheme;
}

export interface Progress {
  total: number;
  completed: number;
  step: string;
  errors?: string[];
  filePaths?: string[];
}

// ========================================
// BOOK THEME
// ========================================

export type ThemeAspectRatio = '4:3' | '3:2' | '1:1';

export interface BookTheme {
  id: string; // e.g., 'storybook-bright', 'classic-serif'
  seed: string; // typically the bookId
  palette: {
    primary: string;
    secondary: string;
    accent: string;
    bg: string;
    text: string;
    muted: string;
  };
  font: {
    heading: string; // CSS var or stack
    body: string; // CSS var or stack
    display?: string;
  };
  layout: {
    imagePlacement: LayoutOption; // reuse existing layout options
    gutter: number; // px space between image and text
  };
  image: {
    aspectRatio: ThemeAspectRatio;
    styleHints: string[]; // for prompt guidance
  };
}

