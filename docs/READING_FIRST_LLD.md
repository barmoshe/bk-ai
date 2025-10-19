# Reading‑First Interactive Book Experience — Low‑Level Design (Next.js + Temporal)

This LLD specifies concrete types, routes, workflows, signals/queries, activities, agents/prompts, persistence, UI contracts, telemetry, and testing strategy to implement the reading‑first interactive experience without introducing new services.

## 1) Types & Schemas (TypeScript — reference)

```ts
// Domain identifiers
type BookId = string;
type SessionId = string;

// Characters
interface CharacterSpec {
  id: string;                 // stable per character across book
  name: string;
  speciesOrType: string;      // e.g., fox, robot, child, dragon
  role: 'protagonist' | 'sidekick' | 'supporting';
  ageYears: number;           // explicit age for age-aware generation
  personalityTraits: string[];
  coreOutfitProps: string[];  // e.g., scarf, backpack, goggles
  colorPalette: string[];     // canonical primary palette
  silhouetteCues: string[];   // body proportions & markers for recognition
  expressionRange: string[];  // e.g., cheerful, curious, thoughtful
}

interface CharacterBibleEntry {
  characterId: string;
  lockedPalette: string[];
  lockedProportions: string[];
  signatureProps: string[];
  hairFurSkinNotes: string;
  styleKeywords: string[];
}

interface CharacterSetSpec {
  primaryCharacters: CharacterSpec[]; // 1–3
  subCharacters: CharacterSpec[];     // simplified rules
  styleNotes?: string;
}

interface CharacterSetOption {
  optionId: string;
  images: string[];               // preview image URLs/paths
  shortBio: string;               // concise combined description
  bibles: CharacterBibleEntry[];  // draft bibles for this option
}

// Book Info & Covers
interface BookInfo {
  title: string;
  dedication?: string;
  ageBand: '3-5' | '6-8' | '9-12';
  tone: string;
  themes: string[];
  targetLength: number; // pages (including Page 1)
}

interface SafeAreaMeta {
  top: number; left: number; right: number; bottom: number; // percentages
  gutter: number;                                          // percentage
}

interface CoverOption {
  optionId: string;
  image: string;            // path to cover image
  palette: string[];
  titleLockupPreview: string; // rendered preview with title
  safeAreas: SafeAreaMeta;
}

// Interactive Pages
interface PageChoice {
  id: string;
  pageIndex: number;
  blurb: string;            // one-line, age-aware
  icon?: string;            // tiny icon hint
  forAgeBand: BookInfo['ageBand'];
}

interface PageChoiceSet {
  pageIndex: number;
  choices: PageChoice[]; // 2–4
}

interface ContinuityVerdict {
  driftScore: number; // 0..1
  issues: string[];
  passed: boolean;
}

interface PageAsset {
  pageIndex: number;
  image: string;         // path to final image
  text?: string;         // optional accompanying text/caption
  derivedFromChoiceId: string;
  continuity: ContinuityVerdict;
  meta?: Record<string, unknown>;
}

interface BookBundle {
  bookId: BookId;
  cover: CoverOption;
  pages: PageAsset[];    // ordered
  meta: { createdAt: string; ageBand: BookInfo['ageBand']; };
}

// Session state (authoritative in workflow)
interface BookSessionState {
  sessionId: SessionId;
  bookId: BookId;
  characterSet?: CharacterSetSpec;
  characterBibles?: CharacterBibleEntry[];
  characterOptions?: CharacterSetOption[];
  bookInfo?: BookInfo;
  coverOptions?: CoverOption[];
  selectedCover?: CoverOption;
  currentPageIndex: number;     // starts at 1 after Page 1 render
  choiceSet?: PageChoiceSet;
  assets: PageAsset[];
  path: string[];               // choice ids in order
  progress: { stage: string; step?: number; total?: number; milestone?: string };
}
```

## 2) API Endpoints (Next.js `app/api/**`)

- POST `app/api/workflows/start` → Start a `BookSession` (returns `{ sessionId, bookId }`).
- GET `app/api/workflows/events` → Server‑Sent Events stream of `{ sessionId, event, payload }` (progress, options, page ready).
- POST `app/api/workflows/signal/choice` → Body `{ sessionId, pageIndex, choiceId }` to select a choice.
- POST `app/api/workflows/signal` with `{ bookId, type: 'chooseCover', payload: optionId }` → choose a cover.
- POST `app/api/workflows/signal/cancel` → Body `{ sessionId }` within cancel window.
- POST `app/api/workflows/signal/backtrack` → Body `{ sessionId, toPageIndex }`.
- GET `app/api/workflows/state` → Query `{ sessionId }` returns `BookSessionState` snapshot.

Notes
- Prefer SSE for real‑time updates; state endpoint for late joins/resume.
- Reuse existing `app/api/workflows/*` route family; add handlers as needed.
  - Cover selection: UI posts `{ bookId, type: 'chooseCover', payload: 'option-01' }` to `app/api/workflows/signal`.

## 3) Temporal Workflows

Module layout (no implementation in this phase):
- `temporal/src/workflows/children/characterOptions.workflow.ts`
- `temporal/src/workflows/children/cover.workflow.ts` (implemented)
- `temporal/src/workflows/interactiveStory.workflow.ts`
- `temporal/src/workflows.ts` (exports and orchestrator composition)

Signatures (illustrative)
```ts
// Character casting
export async function CharacterCastingWorkflow(input: {
  sessionId: SessionId;
  bookId: BookId;
  requestedSet: CharacterSetSpec;
}): Promise<{ options: CharacterSetOption[]; bibles: CharacterBibleEntry[] }>; 

// Cover generation
export async function CoverWorkflow(input: {
  bookId: BookId; title: string; tone?: string; themes?: string[]; ageBand?: number | '3-5' | '6-8' | '9-12';
}): Promise<{ options: CoverOption[]; best: CoverOption }>;

// Interactive story loop
export async function InteractiveStoryWorkflow(input: {
  sessionId: SessionId;
  bookId: BookId;
  bookInfo: BookInfo;
  characterBibles: CharacterBibleEntry[];
  selectedCover: CoverOption;
}): Promise<BookBundle>;
```

Signals & Queries
```ts
// Signals
type SelectChoiceSignal = { pageIndex: number; choiceId: string };
type ChooseCoverSignal = { optionId: string };
type CancelWindowSignal = {};
type BacktrackSignal = { toPageIndex: number };
type ResumeSignal = {};

// Queries
type GetStateQuery = {};
type GetChoicesQuery = { pageIndex?: number };
type GetProgressQuery = {};
```

Policies
- Retry: exponential backoff (initial 250ms, factor 2, max 5 attempts) for generation; continuity check max 2 regenerations per page.
- Timeouts: per activity set to meet p95 budgets; hard deadline guards to keep UI responsive.
- Idempotency: keys `(bookId, step, pageIndex, choiceId)` passed to activities for safe re‑execution.
- Concurrency: single page render in flight; prefetch next `PageChoiceSet` if last render < SLA budget.

## 4) Activities (Temporal `temporal/src/activities/**`)

Functions (no implementation here):
```ts
export async function generateCharacterSetOptions(input: {
  sessionId: SessionId; bookId: BookId; requestedSet: CharacterSetSpec;
}): Promise<CharacterSetOption[]>;

export async function buildCharacterBibles(input: {
  bookId: BookId; selected: CharacterSetSpec;
}): Promise<CharacterBibleEntry[]>;

export async function generateCoverOptions(input: {
  bookId: BookId; bookInfo: BookInfo; bibles: CharacterBibleEntry[];
}): Promise<CoverOption[]>;

// Implemented cover activities (AI renders title text on the image)
export async function generateCoverOptionsWithText(input: {
  bookId: BookId; title: string; tone?: string; themes?: string[]; ageBand?: number | '3-5' | '6-8' | '9-12'; count?: number;
}): Promise<{ options: CoverOption[] }>;

export async function rankCoversByReadabilityAndBranding(options: CoverOption[]): Promise<CoverOption[]>;

export async function persistSelectedCover(input: { bookId: BookId; selected: CoverOption; title: string; safeAreaPct?: number }): Promise<string>;

export async function generatePageChoices(input: {
  bookId: BookId; pageIndex: number; context: StoryContext;
}): Promise<PageChoiceSet>;

export async function renderPageAsset(input: {
  bookId: BookId; pageIndex: number; choice: PageChoice; bibles: CharacterBibleEntry[];
}): Promise<PageAsset>;

export async function continuityCheck(input: {
  asset: PageAsset; bibles: CharacterBibleEntry[];
}): Promise<ContinuityVerdict>;

export async function persistBundle(input: {
  bookId: BookId; state: BookSessionState;
}): Promise<void>;

export async function emitProgressEvent(input: {
  sessionId: SessionId; event: string; payload: unknown;
}): Promise<void>;

export async function recordTelemetry(input: {
  sessionId: SessionId; event: string; payload: Record<string, unknown>;
}): Promise<void>;
```

Notes
- `StoryContext` is derived from `BookInfo`, `characterBibles`, and prior `PageAsset`s.
- Activities must be idempotent and side‑effect safe on retries.

## 5) Agents & Prompt Builders (`temporal/src/agents/**`)

Modules (no implementation here):
- `language.agent.ts` — age‑aware narrative options (2–4) with constrained vocabulary for younger bands; JSON schema output.
- `visualConsistency.agent.ts` — detect drift and propose corrective constraints.
- `coverLayout.agent.ts` — produce cover prompts honoring safe‑area metadata and title lockups.
- `promptTemplates.ts` — templated prompts with placeholders for age, palette, silhouette cues, props.

Example prompt contract
```ts
interface PageChoiceSchema {
  pageIndex: number;
  options: Array<{ id: string; blurb: string; icon?: string; forAgeBand: BookInfo['ageBand'] }>;
}
```

## 6) Persistence Layout (`data/book/<bookId>/`)

- `manifest.json` — serialized `BookSessionState` snapshot
- `characters/` — character previews and bible artifacts
- `pages/<index>.png` — rendered page images
- `pages/<index>.json` — `PageAsset` metadata
- `cover/cover.jpg` — selected cover; `cover/options/*.jpg` for candidates
- `prompts/` — prompt and response artifacts for debug (optional, behind a flag)

Persistence rules
- Atomic writes: write temp file then rename; ensure idempotency by path.
- Backups: keep last N snapshots to aid resume/backtrack.

## 7) UI Screens & Contracts (`app/**`)

Screens
- Character Select: gallery (premades), custom builder, props panel, selected cast strip.
- Book Info: compact form (title/age band/tone/themes/length) and submit.
- Cover Picker ×4: cover cards with title lockup preview & safe‑areas overlay.
- First Page: instant viewer after cover selection.
- Choice View: 2–4 options (blurb + small icon, “good for age X” tag).
- Rendering View (per page): determinate or milestone progress; brief cancel window.
- Preview View (per page): shows newly rendered page; next step CTA.
- Reading Mode: full‑screen reader; swipe/arrow; page index; narration toggle; share/export.

Loading & Accessibility
- Skeleton components with fixed aspect ratios; ARIA‑live polite announcements.
- Reduced motion: disable shimmer/animations; provide textual status.
- Keyboard focus order verified; Enter confirms selected choice, Esc backs out.

## 8) Streaming & State (SSE + Optimistic UI)

- SSE channel `app/api/workflows/events` emits:
  - `characters/optionsReady` `{ options: CharacterSetOption[] }`
  - `covers/optionsReady` `{ options: CoverOption[] }`
  - `page/choicesReady` `{ pageIndex, choices }`
  - `page/rendering` `{ pageIndex, phase: 'planning'|'rendering'|'finalizing' }`
  - `page/ready` `{ pageIndex, asset }`
  - `progress/update` `{ stage, step, total, milestone }`
- Optimistic lock: upon POST choice, UI locks the card immediately, shows placeholder, and allows cancel within ~1–2s.

## 9) Error Handling & Retries

- Inline retry buttons on failed cards (characters/covers/pages); background retries continue.
- Do not block navigation; always keep at least last stable page visible.
- Telemetry on all failures with reason codes.

## 10) Telemetry (Event Names & Payloads)

- `rf.timeToCover` `{ ms }`
- `rf.timeToPage1` `{ ms }`
- `rf.pageAck` `{ pageIndex, ms }`
- `rf.choiceSelected` `{ pageIndex, choiceId }`
- `rf.backtrack` `{ from, to }`
- `rf.readingDwell` `{ ms }`
- `rf.error` `{ stage, code, message }`

## 11) Feature Flags & Config

- `NEXT_PUBLIC_READING_FIRST_ENABLED=true` — enable new flow in UI.
- `TEMPORAL_TASK_QUEUE=rf-main` — dedicated task queue for RF workflows.
- `RF_PERSIST_PROMPTS=false` — persist prompts for debug.

## 12) Testing Strategy

- Unit: prompt validators, schema parsers, continuity scoring utility.
- Integration (Temporal test env): happy path from characters → reading mode; retries & drift re‑render cases.
- UX snapshot: skeleton states, progressive reveal, cancel window.
- A11y: screen reader labels, focus order, reduced‑motion flows.

## 13) Acceptance Alignment

- Budgets enforced via activity timeouts and progress events; continuity checks gate page acceptance; backtrack signal supported at every step; SSE + optimistic UI meet per‑page acknowledgment ≤ 1s.


