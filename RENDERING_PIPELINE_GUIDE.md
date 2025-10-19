# Rendering Pipeline Guide

## Overview

This document explains the three rendering functions available in the codebase and why we've chosen `renderPageProfessional` as the default.

---

## The Three Rendering Functions

### 1. `renderPageJPEGPrint` (Legacy - NOT RECOMMENDED)

**Location:** `temporal/src/activities/render.activities.ts:149-248`

**Status:** ⚠️ Legacy - Kept for backward compatibility only

**Characteristics:**
- ❌ Basic print rendering with no professional profiles
- ❌ Uses fixed DPI from PrintSpec only (no flexibility)
- ❌ Basic ICC profile support
- ❌ Direct Sharp-based SVG text rendering
- ❌ No style advisor integration (colors, backgrounds)
- ❌ Simpler but less sophisticated output

**Use Case:** Only use if you need backward compatibility with old books

---

### 2. `renderPageJPEGPrintEnhanced` (Enhanced Single Output)

**Location:** `temporal/src/activities/render.activities.ts:411-499`

**Status:** ✅ Good - Enhanced quality but limited flexibility

**Characteristics:**
- ✅ Drop-in replacement for `renderPageJPEGPrint`
- ✅ Uses new professional render pipeline (`createRenderPipeline`)
- ✅ Supports multiple print profiles (printOffice, printCommercial, printPremium)
- ✅ Better typography with full `TypographyConfig`
- ✅ Style advisor integration for colors and backgrounds
- ✅ Returns single output path
- ⚠️ Can only generate ONE output at a time

**Default Profile:** `'printOffice'` (300 DPI, sRGB, quality 95)

**Use Case:** When you only need a single high-quality print output

---

### 3. `renderPageProfessional` (Professional Multi-Target) ⭐

**Location:** `temporal/src/activities/render.activities.ts:303-405`

**Status:** 🏆 **BEST - Default and Recommended**

**Characteristics:**
- ✅ Uses same professional render pipeline as Enhanced
- ✅ Supports **MULTIPLE output targets** in one call
- ✅ Returns `Record<string, string>` with multiple output paths
- ✅ Same quality features as Enhanced
- ✅ **More efficient** - generate screen + proof + print in one pass
- ✅ Different profiles optimized for different use cases:
  - `screen`: 144 DPI, sRGB, quality 86 (high-DPI displays)
  - `proof`: 150 DPI, sRGB, quality 92 (draft quality)
  - `print`: 300 DPI, sRGB, quality 95 (professional print)
- ✅ Maintains backward compatibility by writing to legacy paths

**Use Case:** **DEFAULT** - Best for all scenarios, especially when you need multiple outputs

---

## Why `renderPageProfessional` is the Best Choice

### 1. **Most Modern Architecture**
- Uses the latest rendering pipeline with professional profiles
- Same quality as Enhanced but more flexible

### 2. **Flexibility**
```typescript
// Single output
const outputs = await renderPageProfessional(
  bookId, page, pngPath, print, layout, ['print']
);
// outputs = { print: '/path/to/print.jpg' }

// Multiple outputs (more efficient!)
const outputs = await renderPageProfessional(
  bookId, page, pngPath, print, layout, ['screen', 'proof', 'print']
);
// outputs = {
//   screen: '/path/to/screen.jpg',
//   proof: '/path/to/proof.jpg',
//   print: '/path/to/print.jpg'
// }
```

### 3. **Better Performance**
- Generate screen preview + print in **ONE pass** instead of two separate calls
- Reduces processing time and resource usage
- Illustration is read from disk only once

### 4. **Future-Proof**
- Designed for extensibility
- Easy to add new profiles (e.g., 'printCommercial', 'webPreview')
- Already used in modern workflows

### 5. **Backward Compatible**
- Automatically writes to legacy `page-print.jpg` path when `print` profile is used
- Existing code continues to work

---

## Profile Comparison Table

| Profile ID | DPI | Color Space | Quality | Chroma | Sharpening | Use Case |
|-----------|-----|-------------|---------|--------|------------|----------|
| `screen` | 144 | sRGB | 86 | 4:4:4 | 0.3 | High-DPI displays, web preview |
| `webPreview` | 72 | sRGB | 80 | 4:2:0 | 0.2 | Thumbnails, fast loading |
| `proof` | 150 | sRGB | 92 | 4:4:4 | 0.5 | Draft prints, home printer |
| `printOffice` | 300 | sRGB | 95 | 4:4:4 | 0.8 | Office/home quality printing |
| `printCommercial` | 300 | CMYK | 98 | 4:4:4 | 1.0 | Professional print house |
| `printPremium` | 300 | Adobe RGB | 98 | 4:4:4 | 1.2 | High-end art books |

---

## Implementation Changes

### ✅ Updated Files

#### 1. `pageRender.workflow.ts`
**Changes:**
- Changed default `useProfessionalRender` from `false` → `true`
- Changed default `multipleRenderTargets` to `['print']`
- Simplified rendering logic to prefer `renderPageProfessional`
- Removed `renderPageJPEGPrintEnhanced` from main path
- Added clear documentation about recommended approach

**Before:**
```typescript
useProfessionalRender = false,  // Legacy default
printProfileId = 'printOffice',
multipleRenderTargets,  // undefined by default
```

**After:**
```typescript
useProfessionalRender = true,  // Professional is now default
printProfileId = 'printOffice',
multipleRenderTargets = ['print'],  // Default to print profile
```

#### 2. `orchestrator.workflow.ts`
**Changes:**
- Updated page rendering to use `multipleRenderTargets: ['screen', 'print']`
- Generates both screen preview and print output in one pass
- Better performance and user experience

**Before:**
```typescript
args: [{ ..., useProfessionalRender: true }]
```

**After:**
```typescript
args: [{
  ...,
  multipleRenderTargets: ['screen', 'print']  // More efficient!
}]
```

---

## Usage Examples

### Basic Print Only
```typescript
import { renderPageProfessional } from './activities/render.activities';

const outputs = await renderPageProfessional(
  bookId,
  page,
  illustrationPath,
  printSpec,
  layoutPlan,
  ['print']  // Just print output
);

console.log(outputs.print); // '/path/to/page-print.jpg'
```

### Screen + Print (Recommended for Workflows)
```typescript
const outputs = await renderPageProfessional(
  bookId,
  page,
  illustrationPath,
  printSpec,
  layoutPlan,
  ['screen', 'print']  // Both screen and print
);

console.log(outputs.screen); // '/path/to/page-screen.jpg'
console.log(outputs.print);  // '/path/to/page-print.jpg'
```

### All Targets (Screen + Proof + Print)
```typescript
const outputs = await renderPageProfessional(
  bookId,
  page,
  illustrationPath,
  printSpec,
  layoutPlan,
  ['screen', 'proof', 'print']  // All three!
);

console.log(outputs.screen); // High-DPI display
console.log(outputs.proof);  // Draft print
console.log(outputs.print);  // Professional print
```

---

## Migration Guide

### If You're Using `renderPageJPEGPrint`

**Old Code:**
```typescript
const printPath = await renderPageJPEGPrint(
  bookId, page, pngPath, print, layout
);
```

**New Code:**
```typescript
const outputs = await renderPageProfessional(
  bookId, page, pngPath, print, layout, ['print']
);
const printPath = outputs.print;
```

### If You're Using `renderPageJPEGPrintEnhanced`

**Old Code:**
```typescript
const printPath = await renderPageJPEGPrintEnhanced(
  bookId, page, pngPath, print, layout, 'printOffice'
);
```

**New Code:**
```typescript
const outputs = await renderPageProfessional(
  bookId, page, pngPath, print, layout, ['print']
);
const printPath = outputs.print;
```

---

## Benefits Summary

| Benefit | Description |
|---------|-------------|
| ✅ **Better Quality** | Professional rendering pipeline with optimized profiles |
| ✅ **More Efficient** | Generate multiple outputs in one pass |
| ✅ **Flexible** | Easy to add/remove output targets |
| ✅ **Future-Proof** | Modern architecture, easy to extend |
| ✅ **Backward Compatible** | Legacy paths still work |
| ✅ **Better UX** | Screen previews ready alongside print outputs |
| ✅ **Cost Effective** | Fewer API calls, less processing time |

---

## Conclusion

**Use `renderPageProfessional` as your default choice.** It provides the best quality, flexibility, and performance while maintaining backward compatibility with existing code.

The legacy functions (`renderPageJPEGPrint` and `renderPageJPEGPrintEnhanced`) are kept for backward compatibility but should not be used in new code.

---

**Last Updated:** October 19, 2025  
**Author:** AI Book POC Team

