# Quick Start: Professional Print System

## TL;DR

New professional-grade printing with 6 quality profiles, advanced typography, and golden ratio layouts.

```typescript
// Quick upgrade: Replace old render call
const path = await renderPageJPEGPrintEnhanced(
  bookId, page, illustration, printSpec, layout, 
  'printCommercial' // ← Add this for CMYK commercial printing
);
```

## 30-Second Setup

### 1. Use Enhanced Rendering (Drop-in Replacement)

**Old code:**
```typescript
const printPath = await renderPageJPEGPrint(bookId, page, pngPath, print, layout);
```

**New code (one line change):**
```typescript
const printPath = await renderPageJPEGPrintEnhanced(
  bookId, page, pngPath, print, layout, 
  'printOffice' // Choose profile: screen, proof, printOffice, printCommercial
);
```

### 2. Or Generate Multiple Versions at Once

```typescript
const outputs = await renderPageProfessional(
  bookId, page, pngPath, print, layout,
  ['screen', 'proof', 'print'] // ← Get all three versions
);

// Use different versions
showOnWeb(outputs.screen);    // 144dpi, optimized for display
printDraft(outputs.proof);    // 150dpi, proof quality
sendToPrinter(outputs.print); // 300dpi, print ready
```

### 3. Update Workflow (Optional)

**Old workflow call:**
```typescript
await workflow.execute(PageRenderWorkflow, {
  bookId, page, spec, profile, print, plan
});
```

**New workflow call:**
```typescript
await workflow.execute(PageRenderWorkflow, {
  bookId, page, spec, profile, print, plan,
  useProfessionalRender: true,              // ← Enable professional rendering
  printProfileId: 'printCommercial',        // ← Choose profile
  multipleRenderTargets: ['screen', 'print'] // ← Optional: multiple versions
});
```

## Print Profiles Cheat Sheet

| Profile | DPI | Use For | File Size |
|---------|-----|---------|-----------|
| `screen` | 144 | High-DPI displays (Retina) | Medium |
| `webPreview` | 72 | Web thumbnails | Small |
| `proof` | 150 | Draft proofing | Medium |
| `printOffice` | 300 | Office/home printers | Large |
| `printCommercial` | 300 | Professional print house (CMYK) | Largest |
| `printPremium` | 300 | Art books (Adobe RGB) | Largest |

**Most common:**
- Web app: `screen`
- Email preview: `webPreview`
- Home printing: `printOffice`
- Commercial printing: `printCommercial`

## What You Get

### Before (Old System)
❌ One JPEG quality setting for everything
❌ Magic numbers for layouts (e.g., `0.55 * height`)
❌ Basic typography, no kerning
❌ sRGB only
❌ Simple sharpening

### After (Professional System)
✅ Six optimized quality profiles
✅ Golden ratio layouts (1.618)
✅ Professional typography with kerning, widow control
✅ sRGB, Adobe RGB, or CMYK color spaces
✅ Unsharp mask with optimal parameters
✅ Lanczos3 resampling for best quality

## Common Use Cases

### Case 1: Standard Office Printing

```typescript
import { renderPageJPEGPrintEnhanced } from './activities/render.activities';

const path = await renderPageJPEGPrintEnhanced(
  bookId, page, illustration, printSpec, layout,
  'printOffice' // 300dpi, sRGB, 95% quality
);
```

### Case 2: Commercial Print House

```typescript
const path = await renderPageJPEGPrintEnhanced(
  bookId, page, illustration, printSpec, layout,
  'printCommercial' // 300dpi, CMYK, 98% quality
);
```

Set environment variable for CMYK ICC profile:
```bash
CMYK_ICC_PROFILE=/path/to/USWebCoatedSWOP.icc
```

### Case 3: Web Display + Print

```typescript
import { renderPageProfessional } from './activities/render.activities';

const outputs = await renderPageProfessional(
  bookId, page, illustration, printSpec, layout,
  ['screen', 'print']
);

// Display on website
res.json({ imageUrl: outputs.screen });

// Also available for download/print
res.json({ printUrl: outputs.print });
```

### Case 4: Complete Workflow

```typescript
// In orchestrator or book creation workflow
const results = await Promise.all(
  pages.map(page => 
    workflow.executeChild(PageRenderWorkflow, {
      bookId,
      page,
      spec: characterSpec,
      profile: styleProfile,
      print: printSpec,
      plan: layoutPlans[page.pageIndex],
      useProfessionalRender: true,
      multipleRenderTargets: ['screen', 'print'],
    })
  )
);
```

## File Locations

### New Unified Structure

All renders are organized by type:

```
data/books/{bookId}/pages/{pageIndex}/renders/
├── screen.jpg   # For web/app display
├── proof.jpg    # For draft printing
└── print.jpg    # For final printing
```

Access via helpers:

```typescript
import { getBookPaths } from './lib/fileSystem';

const paths = getBookPaths(bookId);
const screenPath = paths.pages.page(0).renders.screen;
const printPath = paths.pages.page(0).renders.print;
```

## Typography Improvements

**Automatic enhancements:**

✅ **Optimal font sizes** based on line length (45-75 characters)
✅ **No widows/orphans** (single words on last line removed)
✅ **Hanging punctuation** (quotes pulled into margin)
✅ **Proper kerning** (letter spacing based on size)
✅ **OpenType features** (ligatures like fi, fl)

**No code changes needed** - these are automatic!

## Layout Improvements

**Before:** Random percentages
```typescript
const imgHeight = Math.floor(contentHeight * 0.55); // Why 0.55?
const pad = Math.floor(contentWidth * 0.02);        // Why 0.02?
```

**After:** Design principles
```typescript
const [textHeight, imgHeight] = goldenRatio(contentHeight); // Harmonious 1.618 ratio
const gutter = calculateGutter(contentWidth);               // Consistent spacing
const fontSize = optimalFontSize(textWidth);                // Optimal readability
```

**Benefits:**
- Consistent spacing across all pages
- Visually balanced layouts
- Professional appearance

## Performance Notes

- **Memory**: ~500MB per page during rendering
- **Speed**: 2-5 seconds per page (similar to old system)
- **Caching**: Renders are cached, won't re-render unnecessarily
- **Parallel**: Can render multiple pages simultaneously

## Troubleshooting

### Colors look wrong in print
```typescript
// Ensure you're using the right profile
'printCommercial' // For CMYK
'printOffice'     // For sRGB

// Set ICC profile environment variable
CMYK_ICC_PROFILE=/path/to/profile.icc
```

### Text is blurry
```typescript
// Use higher quality profile
'printPremium'    // 98% quality, Adobe RGB
'printCommercial' // 98% quality, CMYK

// Increase sharpening (advanced)
import { getPrintProfile } from './config/print-profiles';
const profile = getPrintProfile('printOffice');
profile.sharpening = 1.2; // Increase from 0.8 to 1.2
```

### File sizes too large
```typescript
// Use web-optimized profile
'webPreview'  // 72dpi, 80% quality, smaller files

// Or screen profile
'screen'      // 144dpi, 86% quality, progressive
```

## Advanced: Custom Pipeline

For full control:

```typescript
import { createRenderPipeline } from './lib/render-pipeline';
import { getPrintProfile } from './config/print-profiles';
import { FONT_STACKS } from './lib/typography';

// Get or customize profile
const profile = getPrintProfile('printOffice');

// Create pipeline
const pipeline = createRenderPipeline(
  widthPx, heightPx, bleedPx, margins, profile
);

// Custom typography
const typography = {
  fontFamily: FONT_STACKS.serif,
  fontSize: 52,
  fontWeight: 600,
  lineHeight: 1.5,
  textAlign: 'center',
};

// Render
const jpeg = await pipeline.renderPage({
  text: pageText,
  illustrationBuffer: imageBuffer,
  layoutStyle: 'card',
  typographyConfig: typography,
  backgroundColor: '#fdfaf7',
});
```

## Migration Checklist

For existing books:

- [ ] Update render calls to use `renderPageJPEGPrintEnhanced`
- [ ] Choose appropriate print profile for your use case
- [ ] Test with a few pages before bulk migration
- [ ] Compare old vs new renders for quality
- [ ] Update workflow inputs if using Temporal workflows
- [ ] Set ICC profile environment variables if needed
- [ ] Update file serving logic to use new render paths
- [ ] Test actual printing with new system

## Environment Variables

Add to `.env`:

```bash
# Optional: ICC profiles for advanced color management
CMYK_ICC_PROFILE=/path/to/USWebCoatedSWOP.icc
ADOBE_RGB_ICC_PROFILE=/path/to/AdobeRGB1998.icc

# Data directory (if not default)
BOOKS_DATA_DIR=./data/books
```

## Getting Help

1. Check `PROFESSIONAL_PRINT_GUIDE.md` for detailed documentation
2. See `PRINT_ENHANCEMENT_SUMMARY.md` for technical details
3. Review examples in `temporal/src/activities/render.activities.ts`
4. Test with proof profile before committing to print

## Summary

**Simplest upgrade:**
```typescript
// Change this:
renderPageJPEGPrint(bookId, page, png, print, layout)

// To this:
renderPageJPEGPrintEnhanced(bookId, page, png, print, layout, 'printOffice')
```

**Best upgrade:**
```typescript
renderPageProfessional(bookId, page, png, print, layout, ['screen', 'print'])
```

That's it! You now have professional-grade printing with:
- ✅ Better typography
- ✅ Golden ratio layouts  
- ✅ Multiple quality profiles
- ✅ Color management
- ✅ Professional sharpening

Happy printing! 🖨️

