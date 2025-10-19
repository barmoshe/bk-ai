# Professional Print Enhancement Guide

## Overview

This system now includes a comprehensive professional-grade rendering pipeline with advanced color management, typography, and layout systems suitable for commercial printing.

## Architecture

### Module Structure

```
temporal/src/
├── config/
│   └── print-profiles.ts       # Professional print profiles (screen, proof, print)
├── lib/
│   ├── layout-grid.ts          # 8pt grid system + golden ratio layouts
│   ├── typography.ts           # Professional typography with kerning, widow control
│   ├── color-management.ts     # ICC profiles, color space conversions
│   ├── image-processing.ts     # Lanczos3 resampling, sharpening, optimization
│   ├── render-pipeline.ts      # Modular rendering: Layout → Typography → Compositor → Encoder
│   └── fileSystem.ts           # Unified file system architecture
└── activities/
    ├── render.activities.ts    # Enhanced with professional pipeline
    └── layout.activities.ts    # Updated to use grid system
```

## Key Features

### 1. Print Profiles

Six professional print profiles optimized for different use cases:

```typescript
import { PRINT_PROFILES, getPrintProfile } from './config/print-profiles';

// Available profiles:
// - screen: 144dpi, sRGB, optimized for high-DPI displays
// - webPreview: 72dpi, sRGB, smaller files for web
// - proof: 150dpi, sRGB, draft quality proofing
// - printOffice: 300dpi, sRGB, standard office printing
// - printCommercial: 300dpi, CMYK, commercial print house
// - printPremium: 300dpi, Adobe RGB, premium art books

const profile = getPrintProfile('printCommercial');
```

### 2. Typography Engine

Professional text rendering with best practices:

- **Kerning & Letter Spacing**: Automatic optical adjustments
- **Widow/Orphan Control**: Prevents single words on last line
- **Optical Margin Alignment**: Hanging punctuation
- **Line Length Optimization**: 45-75 characters per line
- **OpenType Features**: Ligatures, proper number formatting

```typescript
import { generateTextSVG, TypographyConfig, FONT_STACKS } from './lib/typography';

const config: TypographyConfig = {
  fontFamily: FONT_STACKS.body,
  fontSize: 42,
  fontWeight: 400,
  lineHeight: 1.3,
  textAlign: 'left',
  openTypeFeatures: ['liga', 'kern'],
};
```

### 3. Layout Grid System

Replace magic numbers with design principles:

- **8pt Baseline Grid**: All spacing in multiples of 8px
- **Golden Ratio**: 1.618 for harmonious proportions
- **Safe Zones**: Bleed, trim, and type-safe areas
- **Modular Scale**: Consistent typography sizing

```typescript
import { snapToGrid, goldenRatio, calculateSafeZones } from './lib/layout-grid';

// Use golden ratio for splits
const [smaller, larger] = goldenRatio(totalWidth);

// Snap to grid for consistency
const width = snapToGrid(calculatedWidth);
```

### 4. Color Management

Professional color handling for print:

- **ICC Profile Support**: CMYK, Adobe RGB, sRGB
- **Color Space Conversion**: Automatic conversions
- **Gamut Detection**: Warns about out-of-gamut colors
- **Printer Optimization**: Adjustments for inkjet, laser, offset

```typescript
import { applyColorProfile, applySafeColorMapping } from './lib/color-management';

// Apply color profile to pipeline
pipeline = await applyColorProfile(pipeline, 'CMYK', iccProfilePath);

// Ensure colors are printable
pipeline = applySafeColorMapping(pipeline, aggressive: true);
```

### 5. Image Processing

Advanced resampling and enhancement:

- **Lanczos3 Resampling**: Best quality for print
- **Unsharp Mask**: Professional sharpening
- **Noise Reduction**: Clean up AI artifacts
- **Smart Cropping**: Entropy-based focus
- **Bleed Extension**: Mirror edges for full-bleed

```typescript
import { resizeForPrint, applySharpen } from './lib/image-processing';

// High-quality resize
const resized = await resizeForPrint(buffer, width, height, {
  kernel: 'lanczos3',
  fit: 'inside'
});

// Professional sharpening
pipeline = applySharpen(pipeline, {
  radius: 0.8,
  amount: 1.0,
  threshold: 2
});
```

### 6. Rendering Pipeline

Clean separation of concerns:

```typescript
import { createRenderPipeline } from './lib/render-pipeline';

// Create pipeline with profile
const pipeline = createRenderPipeline(
  widthPx, 
  heightPx, 
  bleedPx, 
  marginsPx, 
  printProfile
);

// Render complete page
const jpegBuffer = await pipeline.renderPage({
  text: pageText,
  illustrationBuffer: imageBuffer,
  layoutStyle: 'imageTop',
  typographyConfig: config,
  backgroundColor: '#ffffff'
});
```

### 7. Unified File System

Consistent file organization:

```
data/books/{bookId}/
├── manifest.json
├── print-spec.json
├── assets/
│   ├── characters/{characterId}/
│   │   ├── raw.png
│   │   ├── clean.png
│   │   └── meta.json
│   ├── decorations/
│   └── backgrounds/
├── pages/{pageIndex}/
│   ├── layout.json
│   ├── content.json
│   ├── illustration.png
│   └── renders/
│       ├── screen.jpg    # 144dpi, sRGB, screen optimized
│       ├── proof.jpg     # 150dpi, sRGB, draft proof
│       └── print.jpg     # 300dpi, CMYK/Adobe RGB, print quality
├── prompts/
└── cache/
```

```typescript
import { savePageRender, getBookPaths } from './lib/fileSystem';

// Save multiple render targets
await savePageRender(bookId, pageIndex, 'screen', screenBuffer);
await savePageRender(bookId, pageIndex, 'proof', proofBuffer);
await savePageRender(bookId, pageIndex, 'print', printBuffer);

// Get all paths for a book
const paths = getBookPaths(bookId);
console.log(paths.pages.page(0).renders.print);
```

## Usage Examples

### Basic: Render with Default Settings

```typescript
import { renderPageJPEGPrintEnhanced } from './activities/render.activities';

// Drop-in replacement for old function
const outputPath = await renderPageJPEGPrintEnhanced(
  bookId,
  page,
  illustrationPath,
  printSpec,
  layoutPlan,
  'printOffice' // Use office print profile
);
```

### Advanced: Multiple Output Profiles

```typescript
import { renderPageProfessional } from './activities/render.activities';

// Render for screen, proof, and print simultaneously
const outputs = await renderPageProfessional(
  bookId,
  page,
  illustrationPath,
  printSpec,
  layoutPlan,
  ['screen', 'proof', 'print']
);

console.log(outputs.screen);  // Screen-optimized JPEG
console.log(outputs.proof);   // Proof JPEG
console.log(outputs.print);   // Print-ready JPEG
```

### Custom Pipeline

```typescript
import { createRenderPipeline } from './lib/render-pipeline';
import { getPrintProfile } from './config/print-profiles';
import { FONT_STACKS } from './lib/typography';

// Create custom pipeline
const profile = getPrintProfile('printPremium');
const pipeline = createRenderPipeline(widthPx, heightPx, bleedPx, margins, profile);

// Configure typography
const typography = {
  fontFamily: FONT_STACKS.serif,
  fontSize: 48,
  fontWeight: 500,
  lineHeight: 1.4,
  textAlign: 'center',
};

// Render
const jpeg = await pipeline.renderPage({
  text: content,
  illustrationBuffer: image,
  layoutStyle: 'card',
  typographyConfig: typography,
  backgroundColor: '#fdfaf7'
});
```

## Migration Guide

### Old Code

```typescript
// Old: Magic numbers and hardcoded settings
const width = Math.floor(contentWidth * 0.45);
const pad = Math.floor(Math.min(contentWidth, contentHeight) * 0.02);
const fontSize = Math.max(28, Math.round(textRect.width * 0.03));
```

### New Code

```typescript
// New: Professional grid system
import { goldenRatio, calculateGutter, optimalFontSize } from './lib/layout-grid';

const [textWidth, imgWidth] = goldenRatio(contentWidth);
const gutter = calculateGutter(contentWidth);
const fontSize = optimalFontSize(textRect.width);
```

## Environment Variables

Add these to your `.env` file for full functionality:

```bash
# ICC Profiles (optional, for CMYK and Adobe RGB)
CMYK_ICC_PROFILE=/path/to/cmyk-profile.icc
ADOBE_RGB_ICC_PROFILE=/path/to/adobe-rgb.icc

# Data directory
BOOKS_DATA_DIR=./data/books
```

## Print House Requirements

For commercial printing, provide these specifications:

- **Resolution**: 300 DPI minimum
- **Color Space**: CMYK or Adobe RGB (with profile)
- **Bleed**: 0.125" (standard)
- **Format**: JPEG (98% quality) or TIFF
- **Safe Zone**: 0.25" inside margins for critical text

The `printCommercial` profile meets all these requirements.

## Performance Considerations

- **Caching**: Renders are cached in the unified file system
- **Parallel Rendering**: Generate screen, proof, and print versions in parallel
- **Memory**: High-resolution rendering requires ~500MB per page
- **Speed**: ~2-5 seconds per page depending on profile and size

## Quality Checklist

✅ **Typography**
- Line length 45-75 characters
- No widows or orphans
- Proper kerning and letter-spacing
- OpenType features enabled

✅ **Layout**
- All spacing on 8pt grid
- Golden ratio proportions
- Proper safe zones
- Consistent gutters

✅ **Color**
- ICC profile applied
- No out-of-gamut warnings
- Proper color space for medium

✅ **Image Quality**
- 300 DPI for print
- Lanczos3 resampling
- Proper sharpening applied
- No compression artifacts

✅ **Print Preparation**
- Bleed area included
- Trim marks (if needed)
- Color bars (if needed)
- Proper file naming

## Troubleshooting

### Colors look different in print
- Ensure ICC profile is loaded
- Use `printCommercial` profile for CMYK
- Check for out-of-gamut colors with `detectOutOfGamutColors()`

### Text looks fuzzy
- Increase sharpening: adjust `profile.sharpening`
- Use higher DPI: switch to 600dpi for very small text
- Check font rendering: ensure anti-aliasing is appropriate

### File sizes too large
- Use `webPreview` profile for web delivery
- Reduce JPEG quality for proofs
- Enable progressive JPEG for faster loading

### Layout inconsistencies
- Verify all dimensions snap to grid
- Check safe zone calculations
- Ensure margins are properly applied

## Future Enhancements

Potential additions:

1. **PDF Generation**: Direct PDF output with proper marks
2. **Color Calibration**: Monitor calibration tools
3. **Preflight Checking**: Automated print readiness checks
4. **Spot Colors**: Pantone/spot color support
5. **Variable Data**: Template-based variable printing

## Support

For issues or questions:
- Check linter errors with proper TypeScript
- Review print profile settings
- Validate ICC profiles are accessible
- Test with proof profile before final print

