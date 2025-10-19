import { proxyActivities } from '@temporalio/workflow';
import type * as fileActs from '../../activities/files.activities';
import { CharacterSpec, BookPrefs, PrintSpec, PageLayoutPlan, PageJSON } from '../../types';

const files = proxyActivities<typeof fileActs>({
  startToCloseTimeout: '1 minute',
  retry: { maximumAttempts: 2, initialInterval: '1s', backoffCoefficient: 2 },
});

export interface ManifestInput {
  bookId: string;
  title: string;
  spec: CharacterSpec;
  prefs: BookPrefs;
}

export interface ManifestResult { ok: true }

export async function ManifestWorkflow(input: ManifestInput): Promise<ManifestResult> {
  const { bookId, title, spec, prefs } = input;
  await files.writeManifest(bookId, title, spec, prefs);
  return { ok: true };
}


