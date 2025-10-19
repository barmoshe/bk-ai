import { defineUpdate, defineQuery, defineSignal, setHandler, condition, workflowInfo, startChild, proxyActivities, sleep } from '@temporalio/workflow';
import type { CharacterSpec, BookPrefs, PageJSON, PrintSpec, PageLayoutPlan, Progress, ProgressUpdate, WorkflowStatus, WorkflowState, PageArtifactState, StyleProfile } from '../types';
import { config } from '../shared';
import { CharacterOptionsWorkflow } from './children/characterOptions.workflow';
import { CoverWorkflow } from './children/cover.workflow';
import { OutlineWorkflow } from './children/outline.workflow';
import { LayoutWorkflow } from './children/layout.workflow';
import { PageRenderWorkflow, PageRenderInput, PageRenderResult } from './pageRender.workflow';
import { ManifestWorkflow } from './children/manifest.workflow';
import type * as fileActs from '../activities/files.activities';
import type * as styleActs from '../activities/style.activities';
import { canonicalizeSpec } from '../lib/spec';

const files = proxyActivities<typeof fileActs>({
  startToCloseTimeout: '30 seconds',
  retry: { maximumAttempts: 2, initialInterval: '1s', backoffCoefficient: 2 },
});

const style = proxyActivities<typeof styleActs>({
  startToCloseTimeout: '2 minutes',
  retry: { maximumAttempts: 2, initialInterval: '1s', backoffCoefficient: 2 },
});

// Updates and Queries
export const setCharacterSpecUpdate = defineUpdate<void, [any]>('setCharacterSpec');
export const chooseCharacterUpdate = defineUpdate<void, [string]>('chooseCharacter');
export const setBookPrefsUpdate = defineUpdate<void, [BookPrefs]>('setBookPrefs');
export const chooseCoverUpdate = defineUpdate<void, [string]>('chooseCover');
export const pauseUpdate = defineUpdate<void>('pause');
export const resumeUpdate = defineUpdate<void>('resume');
export const cancelUpdate = defineUpdate<void>('cancel');

export const getProgressQuery = defineQuery<Progress>('getProgress');
export const getStateQuery = defineQuery<State>('getState');
export const getWorkflowStateQuery = defineQuery<WorkflowState>('getWorkflowState');

// New: Signals emitted by child page workflows when artifacts are ready
export const illustrationReadySignal = defineSignal<[pageIndex: number, illustrationPath: string, previewPath?: string]>('illustrationReady');
export const screenReadySignal = defineSignal<[pageIndex: number, screenPath: string]>('screenReady');
export const printReadySignal = defineSignal<[pageIndex: number, target: 'proof' | 'print', path: string]>('printReady');

interface State {
  total: number;
  completed: number;
  step: string;
  errors: string[];
  filePaths: string[];
  spec?: CharacterSpec;
  rawSpec?: any;
  chosenFile?: string;
  prefs?: BookPrefs;
  coverOptions?: Array<{ optionId: string; fileName: string; path: string }>;
  selectedCover?: { optionId: string; fileName: string; path: string };
  pages: PageJSON[];
  print?: PrintSpec;
  pageLayouts?: Record<number, PageLayoutPlan>;
  paused: boolean;
  cancelled: boolean;
  progressUpdates: ProgressUpdate[];
  status: WorkflowStatus;
  startedAt: string;
  failedPages: Set<number>;
  pageArtifacts: Record<number, PageArtifactState>;
  profile?: StyleProfile;
}

export async function BookOrchestratorWorkflow(bookId: string): Promise<void> {
  const info = workflowInfo();
  const state: State = {
    total: 5, // will be updated after pages known
    completed: 0,
    step: 'init',
    errors: [],
    filePaths: [],
    pages: [],
    paused: false,
    cancelled: false,
    progressUpdates: [],
    status: 'running',
    startedAt: new Date().toISOString(),
    failedPages: new Set<number>(),
    pageArtifacts: {},
  };

  // Handle for character options child to allow cancellation upon selection
  let charOptionsHandle: any = null;

  const addProgress = (step: string, percent: number, message?: string, pageId?: string) => {
    state.progressUpdates.push({ step, percent, message, pageId });
    state.step = step;
  };

  // Handlers
  setHandler(setCharacterSpecUpdate, (incoming: any) => {
    state.rawSpec = incoming;
    try {
      state.spec = canonicalizeSpec(incoming);
    } catch {
      // Fallback: trust incoming as-is
      state.spec = incoming as CharacterSpec;
    }
    state.step = 'character_spec_set';
    addProgress('character_spec_set', 5, 'Character spec received');
  });
  setHandler(chooseCharacterUpdate, (filename: string) => {
    state.chosenFile = filename;
    // If character options generation is still running, cancel it
    try {
      if (charOptionsHandle) {
        charOptionsHandle.cancel();
        addProgress('character_options_cancelled', 10, 'Character variant generation cancelled');
      }
    } catch {}
    addProgress('character_selected', 20, 'Character selected');
  });
  setHandler(setBookPrefsUpdate, (prefs: BookPrefs) => {
    state.prefs = prefs;
    state.step = 'prefs_set';
    addProgress('book_prefs_set', 30, 'Preferences set');
  });
  setHandler(chooseCoverUpdate, (optionId: string) => {
    const found = state.coverOptions?.find(o => o.optionId === optionId);
    if (found) {
      state.selectedCover = found;
      addProgress('cover_selected', 35, `Cover selected: ${optionId}`);
    }
  });
  setHandler(pauseUpdate, () => { state.paused = true; });
  setHandler(resumeUpdate, () => { state.paused = false; });
  setHandler(cancelUpdate, () => {
    state.cancelled = true;
    state.status = 'cancelled';
    addProgress('cancelled', state.total > 0 ? (state.completed / state.total) * 100 : 0, 'Workflow cancelled by user');
  });

  // Artifact signals from children for perceived streaming
  setHandler(illustrationReadySignal, (pageIndex: number, illustrationPath: string, previewPath?: string) => {
    const current: PageArtifactState = state.pageArtifacts[pageIndex] || { pageIndex, status: 'generating' } as PageArtifactState;
    current.status = 'illustrationReady';
    current.illustrationPath = illustrationPath;
    if (previewPath) current.previewPath = previewPath;
    current.message = `Illustration ready for page ${pageIndex}`;
    state.pageArtifacts[pageIndex] = current;
    addProgress(`page_${pageIndex}_illustration_ready`, 0, `Illustration ready`, String(pageIndex));
  });
  setHandler(screenReadySignal, (pageIndex: number, screenPath: string) => {
    const current: PageArtifactState = state.pageArtifacts[pageIndex] || { pageIndex, status: 'rendering' } as PageArtifactState;
    current.status = 'screenReady';
    current.renderPaths = { ...(current.renderPaths || {}), screen: screenPath };
    current.message = `Screen render ready for page ${pageIndex}`;
    state.pageArtifacts[pageIndex] = current;
    addProgress(`page_${pageIndex}_screen_ready`, 0, `Screen render ready`, String(pageIndex));
  });
  setHandler(printReadySignal, (pageIndex: number, target: 'proof' | 'print', path: string) => {
    const current: PageArtifactState = state.pageArtifacts[pageIndex] || { pageIndex, status: 'rendering' } as PageArtifactState;
    current.status = target === 'print' ? 'done' : 'rendering';
    current.renderPaths = { ...(current.renderPaths || {}), [target]: path } as any;
    current.message = `${target} render ready for page ${pageIndex}`;
    state.pageArtifacts[pageIndex] = current;
    addProgress(`page_${pageIndex}_${target}_ready`, 0, `${target} render ready`, String(pageIndex));
  });

  setHandler(getProgressQuery, () => ({
    total: state.total,
    completed: state.completed,
    step: state.step,
    errors: state.errors,
    filePaths: state.filePaths,
  }));
  setHandler(getStateQuery, () => state);
  setHandler(getWorkflowStateQuery, (): WorkflowState => ({
    workflowId: info.workflowId,
    startedAt: state.startedAt,
    updates: state.progressUpdates,
    status: state.status,
    error: state.errors.at(-1),
    total: state.total,
    completed: state.completed,
    filePaths: state.filePaths,
    coverOptions: state.coverOptions,
    selectedCover: state.selectedCover,
    pages: Object.values(state.pageArtifacts).sort((a, b) => a.pageIndex - b.pageIndex),
  }));

  // Orchestration
  // 1. Wait for character spec
  addProgress('waiting_for_character_spec', 0, 'Waiting for character specification');
  await condition(() => !!state.spec || state.cancelled);
  if (state.cancelled) return;

  // 2. Character options (child)
  addProgress('character_options_generating', 8, 'Generating character image options');
  charOptionsHandle = await startChild(CharacterOptionsWorkflow, {
    workflowId: `${info.workflowId}:charOptions`,
    args: [{ bookId, spec: state.spec!, enableParallel: false, raw: state.rawSpec }],
  });
  
  // Await result to get option files and expose them via state
  const charOptionsResult = await charOptionsHandle.result();
  if (charOptionsResult.optionFiles && charOptionsResult.optionFiles.length > 0) {
    state.filePaths = charOptionsResult.optionFiles;
    addProgress('character_options_ready', 12, `${charOptionsResult.optionFiles.length} character options ready`);
  }

  // 3. Wait for selection and prefs
  addProgress('waiting_for_character_selection', 15, 'Waiting for character selection');
  await condition(() => !!state.chosenFile || state.cancelled);
  if (state.cancelled) return;
  // Copy chosen character asset
  addProgress('character_selected', 20, 'Character selected and copied');
  await files.copyChosenCharacter(bookId, state.chosenFile!);
  // Analyze selected character PNG for style cues
  try {
    addProgress('style_profile', 22, 'Analyzing character style');
    state.profile = await style.analyzeStyleProfile(bookId);
    addProgress('style_profile_complete', 23, 'Style profile created');
  } catch {}
  // Mark both the options phase and selection as completed now that user chose
  state.completed += 2;
  addProgress('waiting_for_book_prefs', 21, 'Waiting for book preferences');
  await condition(() => !!state.prefs || state.cancelled);
  if (state.cancelled) return;
  state.completed += 1;
  addProgress('book_prefs_set', 25, `Book preferences set`);

  // 4. Cover (child) - optional based on config
  if (config.cover.enabled) {
    addProgress('covers_generating', 32, 'Generating cover options (with title)');
    const coverHandle = await startChild(CoverWorkflow, {
      workflowId: `${info.workflowId}:covers`,
      args: [{ bookId, title: state.prefs!.title, tone: state.prefs!.tone, themes: state.prefs!.topic ? [state.prefs!.topic] : [], ageBand: state.prefs!.targetAge }],
    });
    const coverRes = await coverHandle.result();
    state.coverOptions = coverRes.options;
    addProgress('covers_ready', 34, `Cover options ready`);

    // Wait briefly for user selection; otherwise auto-select best
    const waitMs = 8000; // 8s; UI can extend later
    const deadline = Date.now() + waitMs;
    while (!state.selectedCover && Date.now() < deadline && !state.cancelled) {
      await sleep('1s');
    }
    if (!state.selectedCover) {
      const best = coverRes.best;
      state.selectedCover = { optionId: best.optionId, fileName: best.fileName, path: best.path };
      addProgress('cover_autoselected', 35, `Auto-selected best cover`);
    }

    // Persist selected cover
    const coverActs = proxyActivities<any>({ startToCloseTimeout: '30 seconds', retry: { maximumAttempts: 2, initialInterval: '1s', backoffCoefficient: 2 } });
    try {
      await coverActs.persistSelectedCover({ bookId, selected: state.selectedCover, title: state.prefs!.title, safeAreaPct: 0.12 });
    } catch {}
    state.completed += 1;
  } else {
    addProgress('covers_skipped', 35, 'Cover generation disabled');
    state.completed += 1;
  }

  // 5. Outline/pages (child)
  addProgress('pages_json_generating', 30, 'Generating story outline and pages');
  const outlineHandle = await startChild(OutlineWorkflow, {
    workflowId: `${info.workflowId}:outline`,
    args: [{ bookId, spec: state.spec!, prefs: state.prefs!, profile: state.profile }],
  });
  const outlineRes = await outlineHandle.result();
  state.pages = outlineRes.pages;
  state.completed += 1;
  addProgress('pages_json_complete', 40, `Generated ${state.pages.length} pages`);

  // 5. Layout (child)
  addProgress('layout_agent_deciding', 45, 'Deciding print specifications and layouts');
  const layoutHandle = await startChild(LayoutWorkflow, {
    workflowId: `${info.workflowId}:layout`,
    args: [{ bookId, spec: state.spec!, prefs: state.prefs!, pages: state.pages }],
  });
  const layoutRes = await layoutHandle.result();
  state.print = layoutRes.print;
  state.pageLayouts = layoutRes.perPage;
  addProgress('layout_complete', 55, 'Layout decisions complete');

  // Update total based on pages: base 5 + (pages * 2) + 1
  state.total = 5 + state.pages.length * 2 + 1;

  // 6. Per-page children with bounded concurrency
  const concurrency = config.workflow.pageConcurrencyLimit;
  let pending: Promise<PageRenderResult>[] = [];
  const handleResult = (res: PageRenderResult | undefined, reason?: any) => {
    if (!res) {
      state.errors.push(String(reason));
      return;
    }
    if (res.success) {
      state.completed += 2;
    } else {
      state.errors.push(res.error || `Page ${res.pageIndex} failed`);
    }
  };
  for (const page of state.pages) {
    await condition(() => !state.paused || state.cancelled);
    if (state.cancelled) break;
    const plan = state.pageLayouts?.[page.pageIndex]!;
    const baseProgress = 60 + (page.pageIndex / state.pages.length) * 35;
    addProgress(`page_${page.pageIndex}_illustration`, baseProgress, `Rendering page ${page.pageIndex}`);

    const handleP = startChild(PageRenderWorkflow, {
      workflowId: `${info.workflowId}:page:${page.pageIndex}`,
      args: [{
        bookId,
        page,
        spec: state.spec!,
        print: state.print!,
        plan,
        profile: state.profile,
        prefs: state.prefs,
        // Use professional rendering with multiple targets for best results
        multipleRenderTargets: ['screen', 'print']
      } as PageRenderInput],
    }).then(h => h.result());
    pending.push(handleP);
    if (pending.length >= concurrency) {
      try {
        const res = await pending[0];
        handleResult(res);
      } catch (e: any) {
        handleResult(undefined, e);
      } finally {
        pending.shift();
      }
    }
  }
  while (pending.length) {
    try {
      const res = await pending[0];
      handleResult(res);
    } catch (e: any) {
      handleResult(undefined, e);
    } finally {
      pending.shift();
    }
  }

  // 7. Manifest (child)
  addProgress('manifest_writing', 95, 'Writing manifest file');
  const manifestHandle = await startChild(ManifestWorkflow, {
    workflowId: `${info.workflowId}:manifest`,
    args: [{ bookId, title: state.prefs!.title, spec: state.spec!, prefs: state.prefs! }],
  });
  await manifestHandle.result();
  state.completed += 1;
  state.step = 'done';
  state.status = 'completed';
  addProgress('done', 100, 'Book creation complete!');
}


