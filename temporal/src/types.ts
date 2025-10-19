export type LayoutOption = 'imageRight' | 'imageLeft' | 'imageTop';

// Extended print layout styles
export type LayoutStyle = 'imageRight' | 'imageLeft' | 'imageTop' | 'card' | 'overlay' | 'fullBleed' | 'panelGrid';

export interface CharacterSpec {
  name: string;
  /** Optional physical age; omit unless explicitly set by user */
  age?: number;
  /** Optional maturity for human characters */
  maturity?: 'unspecified' | 'kid' | 'teen' | 'adult';
  traits: string[];
  style: string;
  palette: string[];
  /** Optional explicit character type chosen by the user (e.g., "human", "dog", "robot") */
  characterKind?: string;
  /** Optional free-text details describing nuances of the chosen type */
  characterKindDetails?: string;
}

export interface BookPrefs {
  title: string;
  topic: string;
  targetAge: number;
  pages: number;
  tone: string;
  // Accessibility prefs (optional)
  dyslexiaMode?: boolean;
  fontScale?: number; // 0.8–1.6
  highContrast?: boolean;
  /** Optional stricter age band for per-page text rules. */
  ageGroup?: 'T2' | 'F2T3' | 'F3T5' | 'F5T7' | 'F7';
}

export interface PageJSON {
  pageIndex: number;
  text: string;
  imagePrompt: string;
  layout: LayoutOption;
  imageUrl: string;
  /** Optional pre-split display lines for UI/print formatting */
  formatted?: { lines: string[] };
}

// Print specification chosen by the layout agent
export interface PrintSpec {
  widthIn: number;
  heightIn: number;
  bleedIn: number;
  marginsIn: { top: number; right: number; bottom: number; left: number };
  dpi: number;
  colorProfile?: 'sRGB' | 'CMYK';
  iccProfilePath?: string;
  jpegQuality?: number;
  chromaSubsampling?: '4:4:4' | '4:2:0';
}

// Rectangle in pixels at the target DPI
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Per-page layout plan
export interface PageLayoutPlan {
  style: LayoutStyle;
  illustrationRect: Rect;
  textRect: Rect;
  fontFamily?: string;
  fontSizePx?: number;
  lineHeight?: number;
  textAlign?: 'left' | 'center';
  backgroundCard?: { radiusPx: number; paddingPx: number; shadow?: boolean };
}

export interface ManifestPageEntry {
  pageIndex: number;
  textPath: string;
  pngPath: string;
  jpegPath: string;
  jpegPrintPath?: string;
  layout?: PageLayoutPlan;
}

export interface Manifest {
  bookId: string;
  title: string;
  character: CharacterSpec;
  prefs: BookPrefs;
  pages: ManifestPageEntry[];
  print?: PrintSpec;
  /** Optional path to the persisted character bible JSON */
  characterBiblePath?: string;
  // Page aspect metadata
  pageAspect?: '16:9';
  pageSizePx?: { width: number; height: number };
  // Extended metadata
  readingLevel?: ReadingLevel;
  stylePackId?: import('./lib/stylePacks').StylePackId;
  characterSet?: CharacterDescriptor[];
  voiceId?: string;
  cover?: {
    imagePath: string;
    metaPath?: string;
  };
}

export interface Progress {
  total: number;
  completed: number;
  step: string;
  errors?: string[];
  filePaths?: string[];
}

export interface StyleProfile {
  dominantPalette: string[]; // hex colors
  attire: string[]; // clothing/accessories that should remain consistent
  traits: string[]; // visual traits like freckles, curly hair
  artDirection: {
    camera: string;
    lighting: string;
    composition: string;
    texture: string; // brushwork / medium cues
  };
}

// New: Types for character descriptors and layout kinds for future extensions
export type ReadingLevel = 'age2_4' | 'age5_7';
export type PageLayoutKind = 'fullBleed' | 'imageTop' | 'split' | 'panelGrid';

export interface CharacterDescriptor {
  id: string;
  name: string;
  age: number;
  traits: string[];
  physical: string[];
  colorTokens: string[];
}

/**
 * Canonical Character Bible entry for enforcing visual persistence across pages
 */
export interface CharacterBibleEntry {
  /** Species or type, e.g., "dog", "cat", "human" */
  species: string;
  /** Concrete physical descriptors and markings (e.g., "small brown", "floppy ears") */
  physicalDescriptors: string[];
  /** High-signal silhouette markers that aid recognition (e.g., "round ears", "short tail") */
  silhouetteMarkers: string[];
  /** Preferred palette tokens (hex) for the character */
  palette: string[];
  /** Signature props or attire that should persist (e.g., "red collar") */
  signatureProps: string[];
  /** Optional friendly name */
  name?: string;
  /** Optional notes for prompt composition */
  notes?: string;
}

// Live progress tracking for SSE
export type ProgressUpdate = {
  step: string;
  percent: number;
  message?: string;
  pageId?: string;
};

export type WorkflowStatus = 'running' | 'completed' | 'failed' | 'cancelled';

export interface WorkflowState {
  workflowId: string;
  startedAt: string;
  updates: ProgressUpdate[];
  status: WorkflowStatus;
  error?: string;
  total?: number;
  completed?: number;
  /** Character option files */
  filePaths?: string[];
  /** Cover selection phase */
  coverOptions?: Array<{ optionId: string; fileName: string; path: string }>;
  selectedCover?: { optionId: string; fileName: string; path: string };
  /** Optional per-page artifact/status details for streaming UI */
  pages?: PageArtifactState[];
}

// ===============================
// Rendering Style Advice (New)
// ===============================

export type BackgroundSpec =
  | { kind: 'solid'; color: string }
  | { kind: 'gradient'; from: string; to: string; angle?: number }
  | { kind: 'paper'; color?: string; texture: 'light' | 'medium' | 'heavy' }
  | {
      kind: 'textured';
      baseColor: string;
      texture: 'paper' | 'canvas' | 'watercolor' | 'grain' | 'halftone' | 'crayon' | 'linen';
      blend?: 'multiply' | 'overlay' | 'softLight';
      intensity?: number; // 0..1
    };

export interface DecorationPackChoice {
  id: 'stars' | 'clouds' | 'confetti' | 'leaves' | 'sparkles';
  density: 'low' | 'medium' | 'high';
  palette?: string[];
}

export interface PageStyleAdvice {
  palette: string[]; // 3–6 hex colors
  layoutStyle: 'imageTop' | 'imageLeft' | 'imageRight' | 'overlay' | 'card' | 'fullBleed' | 'panelGrid';
  background: BackgroundSpec;
  decoration?: DecorationPackChoice;
  saturationBoost?: number; // 0..0.4 typical for screen
}

export interface BookStyleAdvice {
  defaultPalette: string[];
  defaultLayout: PageStyleAdvice['layoutStyle'];
  background: BackgroundSpec;
  decoration?: DecorationPackChoice;
}

/**
 * Per-page artifact/status details surfaced over SSE for perceived streaming
 */
export interface PageArtifactState {
  pageIndex: number;
  status: 'queued' | 'generating' | 'illustrationReady' | 'rendering' | 'screenReady' | 'done' | 'failed';
  message?: string;
  /** Small progressive JPEG written early for quick preview */
  previewPath?: string;
  /** Full PNG illustration path */
  illustrationPath?: string;
  /** Render targets written as they become available */
  renderPaths?: { screen?: string; proof?: string; print?: string };
  error?: string;
}
