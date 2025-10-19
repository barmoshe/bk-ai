/**
 * Professional print profiles for different output targets
 * Following industry standards for digital and commercial printing
 */

export type ColorSpace = 'sRGB' | 'AdobeRGB' | 'CMYK';
export type ChromaSubsampling = '4:4:4' | '4:2:2' | '4:2:0';

export interface PrintProfile {
  /** Profile identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** Dots per inch */
  dpi: number;
  /** Color space for output */
  colorSpace: ColorSpace;
  /** JPEG quality (1-100) */
  quality: number;
  /** Chroma subsampling for JPEG */
  chromaSubsampling: ChromaSubsampling;
  /** Sharpening amount (0-2.0) */
  sharpening: number;
  /** Unsharp mask radius in pixels */
  sharpenRadius: number;
  /** Use mozjpeg for better compression */
  useMozjpeg: boolean;
  /** ICC profile path (optional) */
  iccProfilePath?: string;
  /** Optimize for web delivery */
  progressive?: boolean;
}

/**
 * Standard print profiles following professional printing guidelines
 */
export const PRINT_PROFILES: Record<string, PrintProfile> = {
  // High-resolution screen display (retina/4K)
  screen: {
    id: 'screen',
    name: 'Screen Display (High-DPI)',
    dpi: 144,
    colorSpace: 'sRGB',
    quality: 86,
    chromaSubsampling: '4:4:4',
    sharpening: 0.3,
    sharpenRadius: 0.5,
    useMozjpeg: true,
    progressive: true,
  },

  // Web preview/thumbnail
  webPreview: {
    id: 'webPreview',
    name: 'Web Preview',
    dpi: 72,
    colorSpace: 'sRGB',
    quality: 80,
    chromaSubsampling: '4:2:0', // Smaller file size for web
    sharpening: 0.2,
    sharpenRadius: 0.4,
    useMozjpeg: true,
    progressive: true,
  },

  // Proofing at home/office printer
  proof: {
    id: 'proof',
    name: 'Proof Print (Draft Quality)',
    dpi: 150,
    colorSpace: 'sRGB',
    quality: 92,
    chromaSubsampling: '4:4:4',
    sharpening: 0.5,
    sharpenRadius: 0.6,
    useMozjpeg: true,
  },

  // Office/home printing at standard resolution
  printOffice: {
    id: 'printOffice',
    name: 'Office Print Quality',
    dpi: 300,
    colorSpace: 'sRGB',
    quality: 95,
    chromaSubsampling: '4:4:4',
    sharpening: 0.8,
    sharpenRadius: 0.8,
    useMozjpeg: true,
  },

  // Commercial printing (professional print house)
  printCommercial: {
    id: 'printCommercial',
    name: 'Commercial Print (CMYK)',
    dpi: 300,
    colorSpace: 'CMYK',
    quality: 98,
    chromaSubsampling: '4:4:4',
    sharpening: 1.0,
    sharpenRadius: 1.0,
    useMozjpeg: true,
    iccProfilePath: process.env.CMYK_ICC_PROFILE,
  },

  // High-end art book printing
  printPremium: {
    id: 'printPremium',
    name: 'Premium Print (Adobe RGB)',
    dpi: 300,
    colorSpace: 'AdobeRGB',
    quality: 98,
    chromaSubsampling: '4:4:4',
    sharpening: 1.2,
    sharpenRadius: 1.0,
    useMozjpeg: true,
    iccProfilePath: process.env.ADOBE_RGB_ICC_PROFILE,
  },
};

/**
 * Get a print profile by ID with fallback to default
 */
export function getPrintProfile(profileId: string): PrintProfile {
  return PRINT_PROFILES[profileId] || PRINT_PROFILES.printOffice;
}

/**
 * Get default profile based on use case
 */
export function getDefaultProfile(useCase: 'screen' | 'web' | 'print' = 'print'): PrintProfile {
  switch (useCase) {
    case 'screen':
      return PRINT_PROFILES.screen;
    case 'web':
      return PRINT_PROFILES.webPreview;
    case 'print':
      return PRINT_PROFILES.printOffice;
  }
}

