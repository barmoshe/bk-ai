# AI Agents, Prompts, and Temporal Workflow Improvements

## Summary

This document outlines the improvements made to the AI book creation project from AI agents architecture, prompt engineering, and Temporal workflow perspectives.

## 1. Prompt Engineering Infrastructure

### New Libraries

- **`temporal/src/lib/promptRecorder.ts`**: Centralized artifact recording for all prompt runs
  - Records inputs, outputs, model, temperature, duration
  - Saves to `data/books/{bookId}/prompts/`
  
- **`temporal/src/lib/promptRunner.ts`**: Standardized OpenAI API wrapper
  - JSON schema enforcement (Responses API with fallback to chat.completions)
  - Consistent timeout handling
  - Automatic artifact recording
  - Version tracking

### Versioned Prompt Templates

- **`temporal/src/lib/prompts/pages.prompt.ts`**: Pages generation prompts (v1)
- **`temporal/src/lib/prompts/layout.prompt.ts`**: Layout decision prompts (v1)
- **`temporal/src/lib/prompts/critic.prompt.ts`**: Content critique prompts (v1)

Each template includes:
- Version constant for tracking
- Separate system/user builders
- Type-safe inputs from `types.ts`

### Refactored Activities

- **`generateOutlineAndPagesJSON`**: Now uses `promptRunner` with schema validation
- **`decidePrintAndLayouts`**: Uses `promptRunner` for consistent artifact recording
- **`critiquePageText`**: New optional critic activity for content review

## 2. Temporal Workflow Hardening

### Signal → Update Migration

- Added **Updates** for interactive commands with validation:
  - `setCharacterSpecUpdate`
  - `chooseCharacterUpdate`
  - `setBookPrefsUpdate`
  - `pauseUpdate`
  - `resumeUpdate`
  
- Kept **Signals** as fallback for backward compatibility
- All handlers installed once at workflow start
- State changes via `await condition(() => !!state.field)`

### Activity Retry Policies

Added exponential backoff retries to all activity proxies:
```typescript
{
  retry: {
    maximumAttempts: 3,
    initialInterval: '3s',
    backoffCoefficient: 2
  }
}
```

### Pause/Resume Support

- State includes `paused` flag
- Per-page processing checks `await condition(() => !state.paused)`
- Control via Updates or Signals

### Optional Bounded Concurrency

- Env flag: `WORKFLOW_PAGE_CONCURRENCY=true`
- Configurable limit: `WORKFLOW_PAGE_CONCURRENCY_LIMIT=2`
- Processes N pages in parallel batches
- Falls back to sequential if disabled

### New Queries

- **`getProgress`**: Returns progress summary (existing, unchanged)
- **`getState`**: Returns full typed workflow state including pages, print spec, layouts

## 3. API Routes

### New Endpoints

- **`POST /api/workflows/control`**: Pause/resume workflow
  ```json
  { "bookId": "...", "action": "pause" | "resume" }
  ```

- **`GET /api/workflows/events`**: Server-Sent Events stream for real-time progress
  ```
  data: {"total":13,"completed":5,"step":"page_3_illustration"}
  ```

### Existing Routes (Unchanged)

- `POST /api/workflows/start`
- `POST /api/workflows/signal`
- `GET /api/workflows/progress`

## 4. Optional Features

### Critic Pass

- Env: `CRITIC_ENABLED=true`
- Reviews each page for age/tone appropriateness
- Suggests improvements if content doesn't match criteria
- Runs after pages generation, before refinement

### Text Refinement

- Env: `TEXT_REFINE_ENABLED=true`
- Existing feature, now documented
- Improves readability for target age

### Bounded Concurrency

- Env: `WORKFLOW_PAGE_CONCURRENCY=true`
- Speeds up page generation in dev
- Configurable via `WORKFLOW_PAGE_CONCURRENCY_LIMIT`

## 5. Testing

Added minimal, fast tests:

- **`schemas.test.ts`**: Validates page response coercion
- **`prompts.test.ts`**: Tests template interpolation
- **`layout.test.ts`**: Tests rect math (inches→pixels, bleed)

Run with: `npm test`

## 6. Documentation

### Updated README

- Complete environment variable reference
- API route documentation with examples
- Step-by-step runbook
- Troubleshooting guide

### New Files

- **`.env.example`**: Template with all supported env vars
- **`IMPROVEMENTS.md`**: This document

## 7. Configuration Simplification

### Hardcoded Configuration

**All configuration is now hardcoded in `temporal/src/shared.ts`**, with only the API key read from environment:

```typescript
export const config = {
  models: { pages: 'gpt-4o-mini', layout: 'gpt-4o-mini', ... },
  temperatures: { pages: 0.5, layout: 0.4, ... },
  timeouts: { pages: 45000, prompt: 45000, image: 60000 },
  features: { textRefine: false, critic: false, ... },
  workflow: { pageConcurrency: false, pageConcurrencyLimit: 2 },
  image: { provider: 'openai_simple', quality: 'hd', ... },
  getApiKey: () => env.OPENAI_API_KEY || '',
}
```

### Environment Variables

**Only one environment variable is required:**

```bash
OPENAI_API_KEY=your_openai_api_key_here
```

All other settings (models, temperatures, timeouts, feature flags, etc.) are hardcoded for simplicity.

To change settings, edit `temporal/src/shared.ts` directly.

## 8. Architecture Principles

### Minimal Surface Changes

- Existing API routes unchanged
- Data layout unchanged
- Activity signatures unchanged (new activities added, not modified)
- Backward compatible (Signals still work alongside Updates)

### Incremental Adoption

All new features are opt-in via environment flags:
- Critic: `CRITIC_ENABLED`
- Concurrency: `WORKFLOW_PAGE_CONCURRENCY`
- Refinement: `TEXT_REFINE_ENABLED`

### Observability

- All prompts recorded with versions
- Artifacts saved per book
- Progress queryable and streamable
- Full state accessible via `getState` query

## 9. Future Enhancements (Not Implemented)

The plan included these items for future consideration:

- **Activity heartbeats**: For long-running activities (image gen loops)
- **Continue-as-new**: For very long books (>8 pages)
- **Search Attributes**: For Temporal UI observability
- **Worker-level rate limiting**: Via `maxConcurrentActivityTaskExecutions`
- **Agent abstraction layer**: Thin wrappers around activities with pluggable interface

These can be added incrementally as needed.

## 10. Acceptance Criteria ✅

- ✅ Pages JSON step always yields valid schema or logged failure
- ✅ Workflow survives worker restarts without losing signals (via condition-based waiting)
- ✅ Artifacts recorded for pages/layout prompts under each book directory
- ✅ Optional features (concurrency, critic) are togglable and safe to disable
- ✅ All changes are backward compatible

## Files Changed/Added

### New Files
- `temporal/src/lib/promptRecorder.ts`
- `temporal/src/lib/promptRunner.ts`
- `temporal/src/lib/prompts/pages.prompt.ts`
- `temporal/src/lib/prompts/layout.prompt.ts`
- `temporal/src/lib/prompts/critic.prompt.ts`
- `temporal/src/__tests__/schemas.test.ts`
- `temporal/src/__tests__/prompts.test.ts`
- `temporal/src/__tests__/layout.test.ts`
- `app/api/workflows/control/route.ts`
- `app/api/workflows/events/route.ts`
- `.env.example`
- `IMPROVEMENTS.md`

### Modified Files
- `temporal/src/activities/openai.activities.ts` (refactored to use promptRunner, added critic)
- `temporal/src/activities/layout.activities.ts` (refactored to use promptRunner)
- `temporal/src/workflows/bookCreation.workflow.ts` (Updates, retries, condition, concurrency, pause/resume)
- `README.md` (comprehensive documentation)

## Conclusion

The project now has:
1. **Robust prompt engineering** with versioned templates, schema enforcement, and artifact recording
2. **Hardened Temporal workflows** with Updates, retries, pause/resume, and optional concurrency
3. **Better observability** via SSE streaming, full state queries, and prompt artifacts
4. **Developer-friendly** documentation, tests, and environment configuration
5. **Production-ready** patterns for local development with OpenAI-only setup

All improvements are backward compatible and opt-in, allowing incremental adoption.

