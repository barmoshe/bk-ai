import { proxyActivities, getExternalWorkflowHandle, workflowInfo } from '@temporalio/workflow';
import type * as openaiActs from '../activities/openai.activities';
import type * as renderActs from '../activities/render.activities';
import { CharacterSpec, PageJSON, PrintSpec, PageLayoutPlan, BookPrefs } from '../types';

// Increased timeouts for image generation with periodic heartbeats
const openai = proxyActivities<typeof openaiActs>({
  startToCloseTimeout: '7 minutes', // Increased from 5 to 7 minutes
  // Heartbeat timeout increased to accommodate 30s intervals with buffer
  heartbeatTimeout: '3 minutes', // Increased from 2 to 3 minutes
  retry: {
    maximumAttempts: 5, // Increased from 3 to 5 attempts
    initialInterval: '3s',
    backoffCoefficient: 2,
    nonRetryableErrorTypes: ['ApplicationFailure'],
  },
});

const render = proxyActivities<typeof renderActs>({
  startToCloseTimeout: '2 minutes', // Increased from 1 to 2 minutes for large renders
  retry: { maximumAttempts: 3, initialInterval: '2s', backoffCoefficient: 2 },
});

export interface PageRenderInput {
  bookId: string;
  page: PageJSON;
  spec: CharacterSpec;
  profile?: any;
  print: PrintSpec;
  plan: PageLayoutPlan;
  prefs?: BookPrefs;
  /** Use professional rendering pipeline (optional, defaults to false for backward compatibility) */
  useProfessionalRender?: boolean;
  /** Print profile ID for professional rendering (e.g., 'printOffice', 'printCommercial') */
  printProfileId?: string;
  /** Generate multiple render targets (screen, proof, print) */
  multipleRenderTargets?: Array<'screen' | 'proof' | 'print'>;
}

export interface PageRenderResult {
  pageIndex: number;
  illustrationPath: string;
  printPath: string;
  /** Additional render paths if multiple targets requested */
  renderPaths?: Record<string, string>;
  success: boolean;
  error?: string;
}

/**
 * Child workflow for rendering a single page.
 * Benefits:
 * - Isolated retries and timeouts per page
 * - Can restart/retry individual pages without affecting others
 * - Better observability in Temporal UI
 * - History stays bounded per page
 * 
 * Supports both legacy and professional rendering pipelines:
 * - Legacy: renderPageJPEGPrint (backward compatible)
 * - Professional: renderPageJPEGPrintEnhanced or renderPageProfessional
 */
export async function PageRenderWorkflow(input: PageRenderInput): Promise<PageRenderResult> {
  const { 
    bookId, 
    page, 
    spec, 
    profile, 
    print, 
    plan,
    prefs,
    useProfessionalRender = false,
    printProfileId = 'printOffice',
    multipleRenderTargets,
  } = input;
  
  try {
    // Parent handle for emitting artifact-ready signals
    // Derive parent workflow id from our own id convention: `${parentId}:page:${index}`
    const info = workflowInfo();
    let parent: any = null;
    try {
      const parts = info.workflowId.split(':page:');
      if (parts.length > 1) {
        const parentId = parts[0];
        parent = getExternalWorkflowHandle(parentId);
      }
    } catch {}
    // Generate illustration
    const illustrationPath = await openai.generatePageIllustrationPNG(
      bookId,
      page,
      spec,
      profile,
      plan,
      prefs,
    );
    // Try emitting illustrationReady to parent (previewPath emitted by activity as side effect if available later)
    try {
      if (parent) {
        // We don't have preview path here; only illustration. Parent will update when screen render arrives
        await parent.signal('illustrationReady', page.pageIndex, illustrationPath);
      }
    } catch {}
    
    let printPath: string;
    let renderPaths: Record<string, string> | undefined;
    
    // Choose rendering pipeline
    if (multipleRenderTargets && multipleRenderTargets.length > 0) {
      // Professional rendering with multiple targets
      renderPaths = await render.renderPageProfessional(
        bookId,
        page,
        illustrationPath,
        print,
        plan,
        multipleRenderTargets,
      );
      try {
        if (parent) {
          if (renderPaths.screen) {
            await parent.signal('screenReady', page.pageIndex, renderPaths.screen);
          }
          if (renderPaths.proof) {
            await parent.signal('printReady', page.pageIndex, 'proof', renderPaths.proof);
          }
          if (renderPaths.print) {
            await parent.signal('printReady', page.pageIndex, 'print', renderPaths.print);
          }
        }
      } catch {}
      // Use print target as main path for backward compatibility
      printPath = renderPaths.print || renderPaths[multipleRenderTargets[0]];
    } else if (useProfessionalRender) {
      // Professional rendering with single target
      printPath = await render.renderPageJPEGPrintEnhanced(
        bookId,
        page,
        illustrationPath,
        print,
        plan,
        printProfileId,
      );
      try { if (parent) await parent.signal('printReady', page.pageIndex, 'print', printPath); } catch {}
    } else {
      // Legacy rendering (backward compatible)
      printPath = await render.renderPageJPEGPrint(
        bookId,
        page,
        illustrationPath,
        print,
        plan,
      );
      try { if (parent) await parent.signal('printReady', page.pageIndex, 'print', printPath); } catch {}
    }
    
    return {
      pageIndex: page.pageIndex,
      illustrationPath,
      printPath,
      renderPaths,
      success: true,
    };
  } catch (e: any) {
    return {
      pageIndex: page.pageIndex,
      illustrationPath: '',
      printPath: '',
      success: false,
      error: String(e?.message || e),
    };
  }
}

