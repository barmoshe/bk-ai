import { proxyActivities } from '@temporalio/workflow';
import type * as coverActs from '../../activities/cover.activities';
import { config } from '../../shared';

export interface CoverWorkflowInput {
  bookId: string;
  title: string;
  tone?: string;
  themes?: string[];
  ageBand?: '3-5' | '6-8' | '9-12' | number;
}

export interface CoverWorkflowResult {
  options: coverActs.CoverOptionMeta[];
  best: coverActs.CoverOptionMeta;
}

const cover = proxyActivities<typeof coverActs>({
  startToCloseTimeout: '6 minutes',
  heartbeatTimeout: '2 minutes',
  retry: { maximumAttempts: 4, initialInterval: '2s', backoffCoefficient: 2, nonRetryableErrorTypes: ['ApplicationFailure'] },
});

export async function CoverWorkflow(input: CoverWorkflowInput): Promise<CoverWorkflowResult> {
  const { bookId, title, tone, themes, ageBand } = input;

  const generated = await cover.generateCoverOptionsWithText({ bookId, title, tone, themes, ageBand, count: config.cover.count, size: '1024x1024' });
  const ranked = await cover.rankCoversByReadabilityAndBranding(generated.options);
  const best = ranked[0] || generated.options[0];
  return { options: generated.options, best };
}


