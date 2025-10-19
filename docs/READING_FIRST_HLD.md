# Reading‑First Interactive Book Experience — High‑Level Design (Next.js + Temporal)

This document defines the architecture and product design to transform the current builder into a reading‑first, interactive, age‑aware experience using the existing Next.js application and Temporal for orchestration. It establishes a single source of truth, enforces character consistency across the entire book, and specifies resilient UX patterns and performance SLAs.

## 1) Problem, Goals, Non‑Goals

- Goals
  - Deliver a reading‑first, page‑by‑page interactive experience with 2–4 age‑aware choices per page.
  - Maintain strict character look consistency via a Character Bible, with continuity checks on every page.
  - Keep a single source of truth for session state (workflow state), snapshotted to disk for resume.
  - Meet UX performance budgets (Time‑to‑Cover ≤ 12s p95; Time‑to‑Page‑1 ≤ 6s p95; per‑page acknowledgment ≤ 1s).
  - Resilient, progressive UI: show partial results, inline retries, no layout shifts, accessible loading states.
  - Preserve existing stack: Next.js app + API routes; Temporal for orchestration and reliability.

- Non‑Goals
  - No new standalone services or WebSocket gateway; use existing SSE and HTTP APIs.
  - No database migration in this phase; continue file‑based persistence under `data/book/<id>/`.
  - No full visual redesign beyond the necessary screens/states and consistent loading semantics.

## 2) Experience Overview (User Journey)

1. Characters: choose premades and/or create custom; add sub‑characters; set character ages; tweak props; view 4 candidate character‑set options; select one set.
2. Book Info: enter title, age band, tone, themes, length target; generate 4 covers with title lockup & safe‑area adherence; select cover.
3. Page 1: render immediately after cover confirmation (non‑interactive).
4. Interactive Pages: for each page, show 2–4 age‑aware narrative choices; on selection, render page, run continuity checks, update preview; repeat until target length.
5. Reading Mode: full‑screen reader; swipe/arrow navigation; narration toggle; share/export; breadcrumb of visited path.

## 3) Architecture Overview

Components
- Next.js UI (App Router) renders all screens and states.
- Next.js API routes act as the control plane for session lifecycle, signals, and SSE event streams.
- Temporal workflows orchestrate the session, enforce ordering, manage retries/timeouts, and persist progress.
- Activities do the heavy lifting: generation, validation, continuity checks, persistence, telemetry.
- Agents/prompt builders produce age‑aware text and visually consistent imagery.
- File persistence under `data/book/<bookId>/` holds `manifest.json`, page assets, prompts, and metadata.

ASCII overview
```
UI (Next.js App)  <--SSE--  API Routes  -->  Temporal Workflow  -->  Activities/Agents  -->  data/book/<id>
     ^                                         ^         |
     |-------------------------- HTTP (signals/queries) --|
```

## 4) Single Source of Truth (SST)

- Authoritative state: a single Temporal workflow instance per `BookSession` maintains canonical state: characters, bibles, book info, cover, page index, choices, path, assets, progress.
- Durability: periodic snapshots to `data/book/<bookId>/manifest.json` after each material step (e.g., covers ready, page rendered) enable resume and backtrack without loss.
- Read access: UI reads state via queries and SSE streams; file snapshots act as secondary view for debug/export.

## 5) Data Artifacts (Conceptual)

- CharacterSetSpec: chosen premades/custom, sub‑characters, ages, props, style notes.
- Character Bible: per character—age, proportions, silhouette markers, palette, outfit/props, hair/fur/skin notes, expression range, style keywords.
- CharacterSetOptions: 4 candidate sets (images + bios) with draft bibles.
- BookInfo: title, dedication, age band, tone, themes, target length.
- CoverOptions: 4 options with title lockup preview, palette notes, safe‑area metadata.
- StoryContext: characters + prior pages + age/tone/themes.
- PageChoiceSet: per page index, 2–4 option blurbs with age tags and tiny icon hints.
- PageAsset: page index, final image reference, text metadata, derivation (choice), continuity verdict.
- BookBundle: cover + ordered pages + metadata for reading/export.

## 6) Orchestration Model

- Workflows (parent + modular children)
  - CharacterCastingWorkflow → produce 4 `CharacterSetOptions` and corresponding draft `CharacterBible` entries.
  - CoverGenerationWorkflow (implemented in legacy flow) → produce 4 `CoverOptions` with the title rendered by the model; records palette and safe‑area metadata for UI.
  - InteractiveStoryWorkflow → page loop: `generatePageChoices` → wait for `selectChoice` signal → `renderPageAsset` → `continuityCheck` (drift → regenerate if needed) → persist + emit progress → next.

- Signals & Queries
  - Signals/Updates: `chooseCover(optionId)` added; `selectChoice(pageIndex, choiceId)`, `cancelWithinWindow()`, `backtrack(toPageIndex)`, `resume()`.
  - Queries: `getState()`, `getChoices(pageIndex)`, `getProgress()`.

- Policies
  - Retries: exponential backoff for activities; bounded retries for generation; fallback to “still cooking” progressive UI.
  - Timeouts: per‑activity deadlines set to meet p95 budgets; circuit‑break regenerate after continuity drift.
  - Idempotency: per step idempotency keys derived from `(bookId, stepType, pageIndex, choiceId)` ensure safe retries.
  - Concurrency: one page in‑flight per session; prefetch next choices opportunistically if budget allows.

### Cover Stage (implemented)

- Step placement: occurs immediately after `book_prefs_set`.
- Generation: child `CoverWorkflow` produces 4 options using OpenAI (`gpt-image-1`) with the title rendered in the image. Prompts enforce legible title, high contrast, and safe‑area margins.
- Selection: the orchestrator exposes `chooseCover(optionId)`; it waits briefly for a user selection and otherwise auto‑selects the best‑ranked option.
- Persistence: selected cover saved to `data/book/<id>/cover/cover.jpg` with metadata in `cover/cover.json`; options under `cover/options/`.
- SSE: progress includes `covers_generating` → `covers_ready`; UI presents a 4‑up grid with skeletons, then images with visible titles.
- Telemetry: `rf.timeToCover`, `rf.coverSelected`, `rf.coverAutoSelected`, and cover error events.

## 7) Prompts, Agents, and Consistency

- Character Creation Prompt: explicitly encodes character age and all Character Bible fields; outputs JSON + image guidance; seeds style keywords for consistency.
- LanguageAgent (age‑aware): generates 2–4 concise narrative options per page tuned to age band; constrained vocabulary for younger bands.
- VisualConsistencyAgent: enforces same‑look continuity across pages; checks palette, proportions, silhouette markers, signature props; returns drift score and fix suggestions.
- CoverLayoutAgent: generates covers honoring typographic safe areas and title lockups; exposes safe‑area metadata for UI overlay.
- Continuity loop: If `continuityCheck` returns drift above threshold, re‑render with stronger constraints; hard cap on retry count; expose inline retry in UI.

## 8) UX System (Reading‑First)

- Reserve space to avoid layout shift; skeleton cards with fixed ratios and shimmer for 4‑up grids (characters, covers) with labels like “Generating 2/4”.
- Page placeholder: full‑page skeleton with subtle animated vignette and caption “Composing page…”; blur‑up preview then full‑res.
- Progress semantics: deterministic for known counts (1/4, 2/4); milestone labels when unknown (Planning → Rendering → Finalizing).
- Optimistic UI: lock selected card instantly on choice confirm; allow cancel for ~1–2s.
- Graceful partials: show ready options immediately; keep remaining as “still cooking…” and retry gently.
- Inline retries: per card, non‑blocking; avoid modal blockers.
- Accessibility: ARIA‑live statuses for skeletons; reduced‑motion respected; keyboard discoverability.
- Session resume: restore last step and placeholders first, then swap in results.

## 9) Performance, SLAs, and Budgets

- Time‑to‑Cover ≤ 12s p95 from Book Info submit.
- Time‑to‑Page‑1 ≤ 6s p95 after cover confirm.
- Per‑page acknowledgment ≤ 1s to show locked choice and placeholder; rendering may complete later.
- No layout shift during loading states (reserve space + skeletons).
- Retries never block navigation; partial results stream progressively.

## 10) Error & Recovery Strategy

- Characters: if <2 options ready → show “Still generating options…” with background retry; offer “Regenerate set”.
- Covers: if all fail → keep Book Info visible; suggest “Try again with adjusted style.”
- Page render: long stall → keep last completed page; toast “Still rendering… retrying shortly”; allow “Pick a different option.”
- Offline: soft banner; queue actions; auto‑continue online.
- Backtrack: “Change last choice” on every interactive page without losing prior pages.

## 11) Accessibility & Inclusivity

- Full keyboard and screen‑reader flow; meaningful alt text on images; high‑contrast placeholders; reduced‑motion respected.
- Microcopy tuned for clarity and calm feedback; age‑appropriate language generation with filters.

## 12) Telemetry (Experience KPIs)

- Time‑to‑Cover, Time‑to‑Page‑1, per‑page acknowledgment latency, choice selection rate, backtrack frequency, completion to Reading Mode, reading dwell time.
- Emit from activities and UI; correlate by `bookId`, `sessionId`, `pageIndex`.

## 13) Acceptance Criteria Mapping

- Meets all hard metrics (p95 budgets), continuity enforcement, backtrack availability, accessibility compliance, stability under retries with progressive rendering.

## 14) Rollout & Backward Compatibility

- Feature flag the new flow; allow fallback to existing builder.
- Keep route compatibility; gradually migrate screens/components.
- No schema migration required; extend `manifest.json` conservatively with additive fields.

## 15) Assumptions

- Temporal remains the orchestrator; SSE is sufficient for real‑time UI updates.
- Local file persistence is acceptable for this phase; remote storage can be introduced later without changing orchestration semantics.


