import { PageLayoutPlan } from '../types';

export function policyLine(): string {
  const enabled = String(process.env.PROMPT_POLICY_VER || '').toLowerCase() === 'v1';
  if (!enabled) return '';
  return [
    'No text, no watermarks, wholesome, age-appropriate, modest attire,',
    'avoid tiny faces, avoid heavy shadows, avoid cluttered backgrounds.',
  ].join(' ');
}

export function buildPlacementHint(plan: PageLayoutPlan): string {
  // Heuristic hint from layout rectangles
  const textCenterX = plan.textRect.x + plan.textRect.width / 2;
  const illusCenterX = plan.illustrationRect.x + plan.illustrationRect.width / 2;
  const textOnRight = textCenterX > illusCenterX;
  if (plan.style === 'imageTop') {
    return 'leave lower area clear for text; keep subject in upper half';
  }
  return textOnRight
    ? 'keep main subject on left side; leave right side clear for text'
    : 'keep main subject on right side; leave left side clear for text';
}


