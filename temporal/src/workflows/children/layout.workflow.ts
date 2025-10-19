import { proxyActivities } from '@temporalio/workflow';
import type * as layoutActs from '../../activities/layout.activities';
import { CharacterSpec, BookPrefs, PageJSON, PrintSpec, PageLayoutPlan } from '../../types';

const layout = proxyActivities<typeof layoutActs>({
  startToCloseTimeout: '2 minutes',
  retry: { maximumAttempts: 3, initialInterval: '2s', backoffCoefficient: 2 },
});

export interface LayoutInput {
  bookId: string;
  spec: CharacterSpec;
  prefs: BookPrefs;
  pages: PageJSON[];
}

export interface LayoutResult {
  print: PrintSpec;
  perPage: Record<number, PageLayoutPlan>;
}

export async function LayoutWorkflow(input: LayoutInput): Promise<LayoutResult> {
  const { bookId, spec, prefs, pages } = input;
  const { print, perPage } = await layout.decidePrintAndLayouts(bookId, spec, prefs, pages);
  return { print, perPage };
}


