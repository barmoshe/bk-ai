# Configuration Guide

## Quick Start

**Only one environment variable is required:**

Create `.env.local`:
```bash
OPENAI_API_KEY=your_openai_api_key_here
```

That's it! All other settings are hardcoded in the code.

## Hardcoded Configuration

All configuration is centralized in `temporal/src/shared.ts` under the `config` object:

### Models (Lines 14-21)
```typescript
models: {
  pages: 'gpt-4o-mini',      // Pages/outline generation
  layout: 'gpt-4o-mini',     // Layout decisions
  vision: 'gpt-4o-mini',     // Style profiling
  critic: 'gpt-4o-mini',     // Content critique
  refine: 'gpt-4o-mini',     // Text refinement
  image: 'gpt-image-1',      // Image generation
}
```

### Temperatures (Lines 23-28)
```typescript
temperatures: {
  pages: 0.5,    // Balance creativity/structure for stories
  layout: 0.4,   // More deterministic layout decisions
  critic: 0.3,   // Strict critique
  refine: 0.4,   // Gentle text improvements
}
```

### Timeouts (Lines 30-35)
```typescript
timeouts: {
  pages: 45000,   // 45 seconds for page generation
  prompt: 45000,  // 45 seconds default prompt timeout
  image: 60000,   // 60 seconds for image generation
}
```

### Feature Flags (Lines 37-44)
```typescript
features: {
  textRefine: false,      // Refinement pass after pages generation
  critic: false,          // Critique pass for age/tone appropriateness
  assetPipeline: false,   // Advanced asset composition pipeline
  allowPlaceholder: false,// Generate placeholder images on API failure
  moderation: false,      // OpenAI moderation check on prompts
}
```

### Workflow Options (Lines 46-50)
```typescript
workflow: {
  pageConcurrency: false,        // Process pages in parallel
  pageConcurrencyLimit: 2,       // Max pages processed at once
}
```

### Image Generation (Lines 52-63)
```typescript
image: {
  provider: 'openai_simple',                    // Use simple fetch API
  fallbacks: ['gpt-image-1', 'dall-e-3', 'dall-e-2'],  // Model fallbacks
  reduceSizes: ['1024x1024', '768x768', '512x512'],    // Size fallbacks
  quality: 'hd',                                 // HD quality
  size: '1024x1024',                            // Default size
  variants: 3,                                   // Generate N variants
  retries: 4,                                    // Retry attempts
  initialBackoffMs: 800,                        // Backoff start
  jpegQuality: 86,                              // Output JPEG quality
}
```

### Directories (Lines 9-11)
```typescript
booksDataDir: './data/books',
generatedDir: './generated',
```

## How to Change Settings

1. Open `temporal/src/shared.ts`
2. Find the `config` object (starts around line 8)
3. Modify the values you need
4. Restart the worker: `npm run start:worker`

### Example: Enable Critic Feature

```typescript
// In temporal/src/shared.ts
features: {
  textRefine: false,
  critic: true,  // Changed from false to true
  assetPipeline: false,
  allowPlaceholder: false,
  moderation: false,
}
```

### Example: Change Model to GPT-4

```typescript
// In temporal/src/shared.ts
models: {
  pages: 'gpt-4',  // Changed from 'gpt-4o-mini'
  layout: 'gpt-4', // Changed from 'gpt-4o-mini'
  // ...
}
```

### Example: Enable Parallel Page Processing

```typescript
// In temporal/src/shared.ts
workflow: {
  pageConcurrency: true,   // Changed from false
  pageConcurrencyLimit: 2, // Process 2 pages at a time
}
```

## Why Hardcoded?

1. **Simplicity**: Only one env var to set (API key)
2. **Local Development**: Easy to get started without complex .env files
3. **Explicit**: All settings visible in one place
4. **Version Control**: Configuration changes tracked in git
5. **Type Safety**: TypeScript ensures valid configuration values

## Migration from Environment Variables

If you were using environment variables before, here's the mapping:

| Old Env Var | New Location in `config` |
|-------------|-------------------------|
| `OPENAI_PAGES_MODEL` | `models.pages` |
| `OPENAI_LAYOUT_MODEL` | `models.layout` |
| `OPENAI_TEMPERATURE_PAGES` | `temperatures.pages` |
| `OPENAI_PAGES_TIMEOUT_MS` | `timeouts.pages` |
| `TEXT_REFINE_ENABLED` | `features.textRefine` |
| `CRITIC_ENABLED` | `features.critic` |
| `WORKFLOW_PAGE_CONCURRENCY` | `workflow.pageConcurrency` |
| `IMAGE_PROVIDER` | `image.provider` |
| `BOOKS_DATA_DIR` | `booksDataDir` |

## Production Considerations

For production deployment, you may want to:

1. **Read from environment**: Modify `config` object to read from `env` object
2. **Add validation**: Use libraries like `zod` to validate configuration
3. **External config**: Use config files (JSON/YAML) loaded at startup
4. **Secrets management**: Use proper secrets management for API keys

Example production-ready pattern:
```typescript
export const config = {
  models: {
    pages: env.OPENAI_PAGES_MODEL || 'gpt-4o-mini',
    // ...
  },
  getApiKey: () => {
    const key = env.OPENAI_API_KEY;
    if (!key) throw new Error('OPENAI_API_KEY is required');
    return key;
  },
}
```

## Age-aware Generation

The app supports per-page, age-targeted text and image generation. The selected age group is stored in the book preferences and used to constrain sentence count, word count, vocabulary simplicity, and illustration style cues. The age itself is never mentioned in the story.

### Age Groups

These are the age groups available in the Create flow:

```ts
// app/create/types.ts
export type AgeGroup = 'T2' | 'F2T3' | 'F3T5' | 'F5T7' | 'F7';
export const AGE_GROUPS = [
  { value: 'T2', label: '2 years' },
  { value: 'F2T3', label: '2-3 years' },
  { value: 'F3T5', label: '3-5 years' },
  { value: 'F5T7', label: '5-7 years' },
  { value: 'F7', label: '7+ years' },
] as const;
```

### Text Rules (per page)

Each age group maps to strict sentence/word limits with simple style notes. The pages system prompt now injects dynamic age-targeted constraints and familiar content cues based on `BookPrefs.ageGroup` or a derived group from `targetAge`.

Enforcement flow:
- Generate pages with age-targeted constraints in the system prompt.
- Validate each page against age rules (sentence count, words per sentence, plus punctuation constraints for youngest groups).
- If violations are found and `features.textRefine` is enabled, perform a single rewrite via `refineToAgeRules()`; no hard truncation and no extra engagement pass when text already looks fine.

```ts
// temporal/src/lib/ageRules.ts
export const TEXT_RULES = {
  T2:   { minSentences: 1, maxSentences: 1, maxWordsPerSentence: 4,  notes: ['present tense', 'onomatopoeia ok', 'no commas'] },
  F2T3: { minSentences: 1, maxSentences: 2, maxWordsPerSentence: 5,  notes: ['present tense', 'repetition ok', 'no commas'] },
  F3T5: { minSentences: 2, maxSentences: 2, maxWordsPerSentence: 7,  notes: ['simple adjectives', 'minimal punctuation'] },
  F5T7: { minSentences: 2, maxSentences: 2, maxWordsPerSentence: 9,  notes: ['simple dialogue ok', 'clear cause/effect'] },
  F7:   { minSentences: 3, maxSentences: 3, maxWordsPerSentence: 12, notes: ['one new word by context', 'avoid subordinate clauses'] },
};
```

- Enforcement/Retry: `temporal/src/activities/openai.activities.ts` (refine step uses `validateAgainstRules` and `refineToAgeRules`).
- Prompt helper: `lib/promptBuilder.ts` includes `buildPageTextPrompt` which embeds the rules when needed.

### Image Style Cues (by age)

Age also nudges image prompts for legibility:
- Younger: big simple shapes, chunky outlines, one focal point, simple background, saturated colors
- Mid: simple composition, 1–2 small details, gentle shading, mid saturation
- Older: richer scenes with 2–3 details, perspective hints, balanced palette, subtle lighting

Implementation: appended to the composed prompt in `generatePageIllustrationPNG` (see `temporal/src/activities/openai.activities.ts`).

### Where to Change Behavior

- UI list and types: `app/create/types.ts` (`AGE_GROUPS`, `AgeGroup`)
- Workflow prefs: `temporal/src/types.ts` (`BookPrefs.ageGroup`)
- Text rules, validator, and cues: `temporal/src/lib/ageRules.ts`
- Pages/system prompt: `temporal/src/lib/prompts/pages.prompt.ts`
- Per-page text prompt helper: `lib/promptBuilder.ts`

Note: If you change rule thresholds, keep them consistent across `ageRules.ts` and any helper prompt builders. The validator will clamp outputs in one retry; it won’t loop indefinitely.

## Troubleshooting

**Q: Changes to `shared.ts` not taking effect?**
- Restart the worker: Stop and run `npm run start:worker` again
- Check TypeScript compilation: `npm run build:temporal`

**Q: Want to temporarily test different settings?**
- You can still read from env by modifying the config object:
  ```typescript
  models: {
    pages: env.OVERRIDE_MODEL || 'gpt-4o-mini',
  }
  ```

**Q: Need different settings per environment?**
- Create multiple config objects and export based on `NODE_ENV`
- Or read from external JSON config files

