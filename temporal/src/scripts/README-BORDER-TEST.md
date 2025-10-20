# Border Effects Test Script

This CLI tool lets you test all border effects on any PNG image **without using OpenAI tokens**. Perfect for validating visual designs before implementing the full integration.

## Quick Start

### Test with a URL
```bash
npx tsx temporal/scripts/test-border-effects.ts --url "https://oaidalleapiprodscus.blob.core.windows.net/private/your-image.png"
```

### Test with a local file
```bash
npx tsx temporal/scripts/test-border-effects.ts --file "./data/book/YOUR_BOOK_ID/pages/1/illustration.png"
```

### Custom canvas size (for print resolution testing)
```bash
npx tsx temporal/scripts/test-border-effects.ts \
  --file "./test-image.png" \
  --width 2400 \
  --height 1350 \
  --output ./my-border-tests
```

## What It Does

1. **Loads your PNG** - from URL or local file
2. **Composes 6 different versions** - one for each border style
3. **Creates full page layouts** - with illustration + sample text
4. **Saves as JPEGs** - ready to compare visually

## Output

All results are saved to `./border-test-output/` (or your custom output directory):

```
border-test-output/
├── none.jpg                  ← No border (baseline)
├── professionalFrame.jpg     ← Clean border with subtle shadow
├── paintedEdge.jpg          ← Watercolor brush stroke edges
├── modernCard.jpg           ← Rounded corners with soft shadow
├── vintageFrame.jpg         ← Ornate aged frame
└── storybookCorners.jpg     ← Decorative corner flourishes
```

## Border Styles Explained

### 1. **none**
No border effect - clean baseline for comparison

### 2. **professionalFrame**
- Clean rectangular border
- Subtle drop shadow
- Perfect for: Classic children's book illustrations
- Use when: Professional, timeless look needed

### 3. **paintedEdge**
- Irregular watercolor/brush stroke edges
- Organic, hand-painted feel
- Perfect for: Watercolor-style illustrations
- Use when: Artistic, whimsical mood

### 4. **modernCard**
- Rounded corners
- Soft, contemporary shadow
- Perfect for: Modern, clean designs
- Use when: Contemporary feel, younger audience

### 5. **vintageFrame**
- Thick ornate border
- Aged paper texture
- Perfect for: Classic, timeless stories
- Use when: Traditional fairy tales, vintage aesthetic

### 6. **storybookCorners**
- Decorative corner flourishes only
- Playful, minimal
- Perfect for: Whimsical children's books
- Use when: Fun, light-hearted stories

## Options Reference

```
--url <url>           PNG image URL to download and test
--file <path>         Local PNG file path to test
--width <pixels>      Canvas width in pixels (default: 1600)
--height <pixels>     Canvas height in pixels (default: 900)
--output <dir>        Output directory (default: ./border-test-output)
-o <dir>              Short form of --output
--help, -h            Show help information
```

## Tips for Best Results

### Finding Test Images

Use existing book illustrations:
```bash
# List books
ls -la ./data/book/

# Find an illustration
find ./data/book -name "illustration.png" | head -1

# Test it
npx tsx temporal/scripts/test-border-effects.ts --file $(find ./data/book -name "illustration.png" | head -1)
```

### Testing Different Resolutions

**Screen preview (1600x900):**
```bash
npx tsx temporal/scripts/test-border-effects.ts --file "./test.png"
```

**Print quality (2400x1350 @ 300 DPI):**
```bash
npx tsx temporal/scripts/test-border-effects.ts --file "./test.png" --width 2400 --height 1350
```

**High-res print (3300x1856 @ 300 DPI for 11x6.19" with bleed):**
```bash
npx tsx temporal/scripts/test-border-effects.ts --file "./test.png" --width 3300 --height 1856
```

### Comparing Results

Open all generated JPEGs side-by-side:
```bash
# macOS
open border-test-output/*.jpg

# Linux
xdg-open border-test-output/*.jpg

# Or use any image viewer
```

## Customization

Want to test custom border parameters? Edit the test script or modify the border library at:
- `temporal/src/lib/border-effects.ts` - Border implementations
- `temporal/scripts/test-border-effects.ts` - Test script

## Next Steps

Once you're happy with the visual results:
1. Note which border styles work best for your books
2. Implement the full AI-driven border selection (see `/ai-border.plan.md`)
3. The borders will automatically be chosen by AI and applied during book generation

## Troubleshooting

**Error: Cannot find module**
```bash
# Make sure you're in the project root
cd /path/to/ai-book-poc

# Install dependencies if needed
npm install
```

**Error: Image download failed**
```bash
# Some URLs may need authentication or have expired
# Try using a local file instead with --file
```

**Borders look too thick/thin**
```bash
# Edit default configs in: temporal/src/lib/border-effects.ts
# Look for getDefaultBorderConfig() function
```

