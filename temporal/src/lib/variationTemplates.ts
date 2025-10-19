const POSES = ['standing', 'walking', 'running', 'sitting', 'waving'];
const EXPRESSIONS = ['smiling', 'curious', 'surprised', 'thoughtful', 'excited'];
const CAMERA = ['eye-level', 'slight high angle', 'slight low angle'];

export function getVariationCues(pageIndex: number): string[] {
  const pose = POSES[(pageIndex - 1) % POSES.length];
  const expression = EXPRESSIONS[(pageIndex - 1) % EXPRESSIONS.length];
  const camera = CAMERA[(pageIndex - 1) % CAMERA.length];
  return [
    `Pose: ${pose}.`,
    `Expression: ${expression}.`,
    `Camera hint: ${camera}.`,
  ];
}


