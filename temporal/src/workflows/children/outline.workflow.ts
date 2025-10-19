import { proxyActivities } from '@temporalio/workflow';
import type * as openaiActs from '../../activities/openai.activities';
import { CharacterSpec, BookPrefs, PageJSON } from '../../types';
import { canonicalizeSpec } from '../../lib/spec';

const openai = proxyActivities<typeof openaiActs>({
  startToCloseTimeout: '7 minutes',
  heartbeatTimeout: '3 minutes',
  retry: {
    maximumAttempts: 5,
    initialInterval: '3s',
    backoffCoefficient: 2,
    nonRetryableErrorTypes: ['ApplicationFailure'],
  },
});

export interface OutlineInput {
  bookId: string;
  spec: CharacterSpec;
  prefs: BookPrefs;
  profile?: any;
}

export interface OutlineResult {
  pages: PageJSON[];
}

export async function OutlineWorkflow(input: OutlineInput): Promise<OutlineResult> {
  const { bookId, spec, prefs, profile } = input;
  const canon = canonicalizeSpec(spec, profile);
  const pages = await openai.generateOutlineAndPagesJSON(bookId, canon, prefs, profile);
  return { pages };
}


