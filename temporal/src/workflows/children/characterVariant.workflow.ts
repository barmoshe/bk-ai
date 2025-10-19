import { proxyActivities } from '@temporalio/workflow';
import type * as charActs from '../../activities/character.activities';

const character = proxyActivities<typeof charActs>({
  startToCloseTimeout: '2 minutes',
  heartbeatTimeout: '45 seconds',
  retry: {
    maximumAttempts: 3,
    initialInterval: '3s',
    backoffCoefficient: 2,
  },
});

export interface CharacterVariantInput {
  bookId: string;
  variantIndex: number; // 1-4
  prompt: string;
  stylePackId: string;
}

export interface CharacterVariantResult {
  variantIndex: number;
  fileName: string;
  rawFileName: string;
  qualityScore: number;
  metadata: {
    hasTransparency: boolean;
    alphaRange: { min: number; max: number };
    dimensions: { width: number; height: number };
    fileSize: number;
  };
  success: boolean;
  error?: string;
  durationMs: number;
}

export async function CharacterVariantWorkflow(
  input: CharacterVariantInput
): Promise<CharacterVariantResult> {
  const startTime = Date.now();
  const { bookId, variantIndex, prompt } = input;

  try {
    // Generate → clean → save in a single activity to avoid large gRPC payloads
    const res = await character.generateAndSaveVariantActivity(bookId, variantIndex, prompt);

    const durationMs = res.durationMs ?? (Date.now() - startTime);
    const fileName = res.fileName;
    const rawFileName = (res.rawPath?.split('/').pop()) || `option-${String(variantIndex).padStart(2, '0')}-raw.png`;

    return {
      variantIndex,
      fileName,
      rawFileName,
      qualityScore: res.score,
      metadata: res.metadata,
      success: true,
      durationMs,
    };
  } catch (error: any) {
    return {
      variantIndex,
      fileName: '',
      rawFileName: '',
      qualityScore: 0,
      metadata: {
        hasTransparency: false,
        alphaRange: { min: 0, max: 0 },
        dimensions: { width: 0, height: 0 },
        fileSize: 0,
      },
      success: false,
      error: error?.message || String(error),
      durationMs: Date.now() - startTime,
    };
  }
}


