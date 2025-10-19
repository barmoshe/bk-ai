This is a [Next.js](https://nextjs.org/) project that uses [Temporal](https://temporal.io) to implement a one-click order application.

It is the companion repository for the tutorial [Build a one-click order application with TypeScript and Next.js](https://learn.temporal.io/tutorials/typescript/build-one-click-order-app-nextjs/).

## Getting Started

First, download and set up [a Local Temporal development environment](https://learn.temporal.io/getting_started/typescript/dev_environment/)

Then clone this repository run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the working application.

Click to buy an item.

Review the Terminal output to verify that the process completed.

## ✨ AI Book Creator

This project generates AI-powered children's books using Temporal workflows and OpenAI, featuring:

- 🎨 **AI-Generated Illustrations**: Consistent, beautiful artwork for every page
- 📖 **Custom Stories**: Age-appropriate narratives tailored to your preferences
- 🔊 **Read Aloud**: Built-in text-to-speech with customizable voices
- 📊 **Live Progress Tracking**: Real-time workflow updates via Server-Sent Events (SSE)
- ♿ **Accessibility**: Dyslexia-friendly fonts, high contrast, adjustable text size
- 🔄 **Temporal Workflows**: Reliable, pausable, cancellable book generation
- 🖨️ **Professional Print System**: Commercial-grade JPEG output with CMYK support, golden ratio layouts, and professional typography
- 🚀 **Simplified Character Creation**: Single-screen workflow-driven character creation with low-res previews (1 in dev, 3 in prod)

### Quick Start

1. **Set up Temporal**: Follow the [Local Temporal development environment guide](https://learn.temporal.io/getting_started/typescript/dev_environment/)

2. **Configure Environment**: Copy `.env.example` to `.env.local` and add your OpenAI API key:
```bash
OPENAI_API_KEY=your_openai_api_key_here
TEMPORAL_ADDRESS=localhost:7233
TEMPORAL_NAMESPACE=default
```

3. **Install & Run**:
```bash
npm install
npm run dev
```

This will start:
- Next.js dev server on http://localhost:3000
- Temporal worker compiling and watching
- Worker process connecting to Temporal

4. **Create Your First Book**: Navigate to http://localhost:3000 and click "Create New Book"

### Character Creation Flow

The simplified character creation flow is workflow-driven:

1. Fill in character details (name, age, looks, description) on a single screen
2. Click "Generate previews" to start a Temporal workflow
3. The workflow generates character options via `generateLowResCharacterOptions` activity:
   - **Development**: 1 low-res JPEG preview (fast iteration)
   - **Production**: 3 low-res JPEG previews (user choice)
4. Select your favorite option and proceed to story configuration
5. The workflow continues with outline, pages, and rendering

Character options are saved to `data/book/{bookId}/characters/options/` and exposed via SSE for real-time UI updates.

### Environment Configuration

All configuration is managed in `temporal/src/shared.ts`:

- **Models**: `gpt-4o-mini` for text, `dall-e-3` for images
- **Directories**: `./data/books`, `./generated`
- **Timeouts**: 45s for prompts, 60s for images
- **Feature flags**: critic, textRefine, assetPipeline, pageConcurrency
- **Image**: OpenAI provider, HD quality, 1024x1024 size

To change these settings, edit `temporal/src/shared.ts` and modify the `config` object.

### API Routes

#### Start a workflow
```bash
POST /api/workflows/start
{ "bookId": "optional-uuid" }
→ { "ok": true, "bookId": "...", "workflowId": "book-..." }
```

#### Track live progress (SSE)
```bash
GET /api/workflows/progress/[workflowId]
→ Server-Sent Events stream with real-time workflow state
```

#### Cancel a workflow
```bash
POST /api/workflows/cancel
{ "workflowId": "book-..." }
→ { "ok": true, "state": { ...WorkflowState } }
```

#### Send signals/updates
```bash
POST /api/workflows/signal
{
  "bookId": "...",
  "type": "setCharacterSpec",
  "payload": {
    "name": "Luna",
    "ageYears": 5,
    "looks": "curly hair, blue jacket",
    "description": "curious, kind",
    "characterKind": "human",
    "characterKindDetails": "freckles, round glasses, cozy scarf"
  }
}
```

#### Control workflow
```bash
POST /api/workflows/control
{ "bookId": "...", "action": "pause" | "resume" }
```

#### Query progress
```bash
GET /api/workflows/progress?bookId=...
→ { "total": 13, "completed": 5, "step": "page_3_illustration", ... }
```

#### Stream progress (SSE)
```bash
GET /api/workflows/events?bookId=...
→ data: {"total":13,"completed":5,"step":"..."}
```

### Runbook

1. **Start Temporal dev server**:
   ```bash
   temporal server start-dev
   ```

2. **Run the worker** (in a separate terminal):
   ```bash
   npm run start:worker
   ```

3. **Run Next.js dev server**:
   ```bash
   npm run dev:next
   ```

4. **Create a book**:
   - POST to `/api/workflows/start`
   - Send character spec via `/api/workflows/signal`
   - Choose character image
   - Send book preferences
   - Monitor progress via `/api/workflows/progress` or `/api/workflows/events`

5. **Output**: Book artifacts saved to `data/books/{bookId}/`:
   - `characters/selected.png`
   - `pages/{N}/page.json`, `illustration.png`, `page-print.jpg`
   - `prompts/*.json` (prompt artifacts with versions)
   - `style.json` (style profile)
   - `manifest.json` (complete book metadata)

### Testing

Run tests:
```bash
npm test
```

Tests cover:
- Schema validation (`schemas.test.ts`)
- Prompt template interpolation (`prompts.test.ts`)
- Layout rect math (`layout.test.ts`)

### Troubleshooting

- **Workflow not progressing**: Check worker logs; ensure signals are sent with correct `bookId`.
- **OpenAI errors**: Verify `OPENAI_API_KEY` is set; check rate limits; enable `ALLOW_PLACEHOLDER=true` for testing.
- **Missing artifacts**: Check `BOOKS_DATA_DIR` path; ensure worker has write permissions.
- **Temporal connection issues**: Ensure `temporal server start-dev` is running on `localhost:7233`.

## 🖨️ Professional Print System

The project now includes a comprehensive professional-grade printing and layout system suitable for commercial book production.

### Key Features

- **6 Print Profiles**: From web preview (72dpi) to commercial printing (300dpi CMYK)
- **Professional Typography**: Kerning, widow/orphan control, OpenType ligatures
- **Design Grid System**: 8pt baseline grid with golden ratio (1.618) layouts
- **Color Management**: ICC profile support for sRGB, Adobe RGB, and CMYK
- **Advanced Image Processing**: Lanczos3 resampling, unsharp mask sharpening
- **Unified File System**: Organized structure with multiple render targets

### Quick Start

**Simple upgrade:**
```typescript
// Old
const path = await renderPageJPEGPrint(bookId, page, png, print, layout);

// New - just add profile
const path = await renderPageJPEGPrintEnhanced(
  bookId, page, png, print, layout, 
  'printOffice' // or 'printCommercial' for CMYK
);
```

**Generate multiple versions:**
```typescript
const outputs = await renderPageProfessional(
  bookId, page, png, print, layout,
  ['screen', 'proof', 'print']
);
// Get: outputs.screen, outputs.proof, outputs.print
```

### Print Profiles

| Profile | DPI | Color | Quality | Use Case |
|---------|-----|-------|---------|----------|
| `screen` | 144 | sRGB | 86% | High-DPI displays |
| `webPreview` | 72 | sRGB | 80% | Web thumbnails |
| `proof` | 150 | sRGB | 92% | Draft printing |
| `printOffice` | 300 | sRGB | 95% | Home/office printers |
| `printCommercial` | 300 | CMYK | 98% | Print houses |
| `printPremium` | 300 | Adobe RGB | 98% | Art books |

### Documentation

- **[Quick Start Guide](QUICK_START_PROFESSIONAL_PRINT.md)** - Get started in 30 seconds
- **[Professional Print Guide](PROFESSIONAL_PRINT_GUIDE.md)** - Complete documentation
- **[Implementation Summary](PRINT_ENHANCEMENT_SUMMARY.md)** - Technical details
- **[Examples](examples/professional-print-example.ts)** - Code examples

### What's Improved

**Typography:**
- ✅ Optimal font sizing (45-75 characters per line)
- ✅ No widows or orphans
- ✅ Hanging punctuation
- ✅ Professional kerning
- ✅ OpenType ligatures
 - ✅ Dynamic fonts mapped to illustration style packs
 - ✅ Single locked body text size across all pages for consistency
 - ✅ Embedded @font-face in server-side SVG for print consistency

**Layout:**
- ✅ Golden ratio proportions (1.618)
- ✅ 8pt baseline grid
- ✅ Consistent spacing
- ✅ Safe zones (bleed, trim, type-safe)

**Quality:**
- ✅ Lanczos3 resampling
- ✅ Unsharp mask sharpening
- ✅ MozJPEG optimization
- ✅ Color space management
- ✅ Multiple output profiles

### File Organization

New unified structure:
```
data/books/{bookId}/
├── pages/{pageIndex}/
│   ├── illustration.png
│   └── renders/
│       ├── screen.jpg    # 144dpi, display
│       ├── proof.jpg     # 150dpi, draft
│       └── print.jpg     # 300dpi, final
└── assets/
    └── characters/{id}/
        ├── raw.png
        ├── clean.png
        └── meta.json
```

### Environment Variables

Optional ICC profiles for CMYK:
```bash
CMYK_ICC_PROFILE=/path/to/USWebCoatedSWOP.icc
ADOBE_RGB_ICC_PROFILE=/path/to/AdobeRGB1998.icc
```
