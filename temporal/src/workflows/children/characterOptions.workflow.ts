import { proxyActivities, startChild } from '@temporalio/workflow';
import type * as openaiActs from '../../activities/openai.activities';
import type * as fileActs from '../../activities/files.activities';
import type * as charActs from '../../activities/character.activities';
import { CharacterSpec, StyleProfile } from '../../types';
import { deriveLowResSpec } from '../../lib/spec';
import { CharacterVariantWorkflow } from './characterVariant.workflow';

// Character image generation - increased timeouts for reliability
const openai = proxyActivities<typeof openaiActs>({
  startToCloseTimeout: '7 minutes', // Increased from 5 to 7 minutes
  heartbeatTimeout: '3 minutes', // Increased from 30s to 3 minutes
  retry: {
    maximumAttempts: 5, // Increased from 3 to 5 attempts
    initialInterval: '3s',
    backoffCoefficient: 2,
    nonRetryableErrorTypes: ['ApplicationFailure'],
  },
});

const files = proxyActivities<typeof fileActs>({
  startToCloseTimeout: '30 seconds',
  retry: { maximumAttempts: 2, initialInterval: '1s', backoffCoefficient: 2 },
});

const character = proxyActivities<typeof charActs>({
  startToCloseTimeout: '30 seconds',
  retry: { maximumAttempts: 2, initialInterval: '1s', backoffCoefficient: 2 },
});

export interface CharacterOptionsInput {
  bookId: string;
  spec: CharacterSpec;
  profile?: StyleProfile;
  enableParallel?: boolean;
  raw?: { name?: string; ageYears?: number; looks?: string; description?: string };
}

export interface CharacterOptionsResult {
  optionFiles?: string[]; // legacy
  variants?: Array<{ fileName: string; score: number; rank: number; durationMs: number }>;
  bestVariant?: string;
  averageQuality?: number;
  generationTimeMs?: number;
  failedCount?: number;
}

export async function CharacterOptionsWorkflow(input: CharacterOptionsInput): Promise<CharacterOptionsResult> {
  const { bookId, spec, profile, enableParallel = false, raw } = input;
  const startedAt = Date.now();

  // Always use the current low-res generation path (migrated flow)
  const lowRes = deriveLowResSpec(spec, raw);
  const result = await openai.generateLowResCharacterOptions(bookId, lowRes);
  return { optionFiles: result.files };
}


