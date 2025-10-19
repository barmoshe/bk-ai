import sharp from 'sharp';

export interface AlphaMetadata {
  hasTransparency: boolean;
  alphaRange: { min: number; max: number };
  dimensions: { width: number; height: number };
  fileSize: number;
}

export async function scoreCharacterQuality(
  pngBuffer: Buffer,
  metadata: AlphaMetadata
): Promise<number> {
  let score = 0;

  // 1. Transparency Quality (30 pts)
  const alphaRange = metadata.alphaRange.max - metadata.alphaRange.min;
  const transparencyScore = Math.min(30, (alphaRange / 255) * 30);
  score += transparencyScore;

  // 2. Edge Quality (25 pts) - analyze alpha channel smoothness
  const image = sharp(pngBuffer);
  const alphaChannel = await image.extractChannel('alpha').toBuffer();
  const alphaStats = await sharp(alphaChannel).stats();
  const edgeQuality = 25 - Math.min(25, (alphaStats.channels?.[0]?.stdev ?? 0) / 10);
  score += edgeQuality;

  // 3. Centering (20 pts) - placeholder until full center-of-mass algorithm
  const centeringScore = 15;
  score += Math.min(20, centeringScore);

  // 4. Style Consistency (15 pts) - color variance analysis
  const colorStats = await image.removeAlpha().stats();
  const colorConsistency = 15 - Math.min(15, (colorStats.channels?.[0]?.stdev ?? 0) / 100);
  score += colorConsistency;

  // 5. Technical Quality (10 pts) - resolution and file size
  const technicalScore = scoreTechnicalQuality(metadata);
  score += technicalScore;

  return Math.round(Math.max(0, Math.min(100, score)));
}

function scoreTechnicalQuality(metadata: AlphaMetadata): number {
  const { dimensions, fileSize } = metadata;
  let score = 0;

  // Resolution scoring (5 pts)
  if ((dimensions.width ?? 0) >= 1024 && (dimensions.height ?? 0) >= 1024) score += 5;
  else if ((dimensions.width ?? 0) >= 768) score += 3;

  // File size scoring (5 pts) - optimal range 400KB-900KB
  if (fileSize >= 400000 && fileSize <= 900000) score += 5;
  else if (fileSize < 1200000) score += 3;

  return score;
}


