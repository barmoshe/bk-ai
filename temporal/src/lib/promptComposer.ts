import { CharacterSpec, PageJSON, StyleProfile, ReadingLevel, CharacterDescriptor } from '../types';
import { deriveCharacterBibleEntry } from './spec';
import { StylePack, StylePackId, getStylePack } from './stylePacks';
import { policyLine } from './promptPolicy';
import crypto from 'crypto';

export function composeImagePrompt(
  character: CharacterSpec,
  page: Pick<PageJSON, 'imagePrompt'>,
  profile?: StyleProfile,
  opts?: { subjectOverride?: string; subjectDetails?: string },
): string {
  const palette = (profile?.dominantPalette?.length ? profile.dominantPalette : character.palette || []).join(', ') || '#F2E2B0, #D68A6D, #4B8DA8';
  const attire = (profile?.attire?.length ? profile.attire : character.traits || []).join(', ') || 'friendly, cheerful';
  const traits = (profile?.traits?.length ? profile.traits : character.traits || []).join(', ') || 'friendly, cheerful';
  const camera = profile?.artDirection?.camera || 'eye-level';
  const lighting = profile?.artDirection?.lighting || 'soft natural light';
  const composition = profile?.artDirection?.composition || 'balanced, clear subject focus';
  const texture =
    profile?.artDirection?.texture ||
    ((character.style || '').includes('watercolor') ? 'soft edges, paper grain' : 'clean illustration');

  // If page.imagePrompt is weak (too short or generic), enrich it slightly
  const rawScene = String(page.imagePrompt || '').trim();
  const isGeneric = rawScene.length < 8 || /scene\s*\d+$/i.test(rawScene) || /^\w+(\s*and\s*\w+)?$/i.test(rawScene);
  const scene = isGeneric
    ? `${rawScene ? rawScene + ', ' : ''}simple outdoor setting, morning light, calm mood`
    : rawScene;

  const lines = [
    `Children's book illustration, ${character.style}.`,
    `Composition: ${composition}. Camera: ${camera}. Lighting: ${lighting}. Texture: ${texture}.`,
    `Framing: landscape 16:9 aspect ratio, subject clearly visible, avoid extreme close-ups.`,
    `Palette: ${palette}.`,
    `Character cues: ${attire}; traits: ${traits}.`,
    `Scene: ${scene}.`,
    `No text, no watermarks, wholesome, anatomically correct, consistent character.`,
  ];
  // Inject species/physical descriptors derived from spec/profile or override
  try {
    // Pass through profile so traits can help infer species; improved inference in spec.ts will catch species tokens from traits
    const bible = deriveCharacterBibleEntry(character, profile);
    const species = (opts?.subjectOverride || bible.species || 'character').toLowerCase();
    const physical = (bible.physicalDescriptors || []).slice(0, 4).join(', ');
    lines.splice(4, 0, `Subject: ${species}; physical: ${physical || 'kid-friendly proportions, clear silhouette'}.`);
    if (opts?.subjectDetails && opts.subjectDetails.trim()) {
      lines.splice(6, 0, `Character details: ${opts.subjectDetails.trim()}.`);
    }
    const NON_HUMAN = new Set(['dog','cat','fox','rabbit','bear','elephant','giraffe','lion','tiger','bird','dinosaur','dragon']);
    if (NON_HUMAN.has(species)) lines.push('Avoid depicting humans; focus on the named animal.');
  } catch {}
  const policy = policyLine();
  if (policy) lines.push(policy);
  return lines.join(' ');
}


/**
 * Build optimized prompt for transparent PNG object generation
 * Enhanced for characters, props, and decorative elements
 */
export function buildPrompt(input: {
  category: string;
  stylePackId: StylePackId;
  pose?: string; expression?: string; theme?: string;
  palette?: string[];
}): { prompt: string; stylePack: StylePack; promptHash: string } {
  const stylePack = getStylePack(input.stylePackId);
  const lines = [
    `Create a high-quality ${input.category} in ${stylePack.promptTag} children's illustration style.`,
    `Requirements: isolated subject, fully centered, complete view showing whole object.`,
    `Background: completely transparent, no environment, no floor, no props.`,
    `Edges: clean and smooth alpha channel, professional cutout quality.`,
    `Lighting: even, no harsh shadows, soft ambient light only.`,
    `Style: vibrant colors, child-friendly, ${stylePack.paletteTag}.`,
    `Format: PNG with transparency, 1024×1024 pixels.`,
  ];
  const tags = [input.pose, input.expression, input.theme]
    .filter(Boolean)
    .join(', ');
  const prompt = tags ? `${lines.join(' ')} Details: ${tags}.` : lines.join(' ');
  const promptHash = crypto.createHash('sha256').update(prompt).digest('hex').slice(0, 16);
  return { prompt, stylePack, promptHash };
}

// V2: 16:9-aware prompt composer for pages
export function composeImagePromptV2(args: {
  narrative: string;
  ageLevel: ReadingLevel;
  stylePackId: StylePackId;
  characters: CharacterDescriptor[];
  layout: 'fullBleed' | 'imageTop' | 'split' | 'panelGrid';
  sceneTone?: 'calm' | 'adventure' | 'cozy' | 'silly';
  placementHint?: string;
  extras?: string[];
  styleTag?: string;
}): string {
  const stylePack = getStylePack(args.stylePackId);
  const charTags = args.characters
    .map(c => `${c.name}, ${c.traits.join(', ')}, ${c.physical.join(', ')}`)
    .join('; ');
  const tone = args.sceneTone ? `Tone: ${args.sceneTone}.` : '';
  const layoutHint =
    args.layout === 'fullBleed'
      ? 'edge-to-edge composition, text-safe area near bottom'
      : args.layout === 'imageTop'
      ? 'image dominates upper area, text below'
      : args.layout === 'panelGrid'
      ? 'simple 2-3 panel story sequence, clear gutters, single scene continuity'
      : 'balanced split layout, image and text side-by-side';
  const wordBudget = args.ageLevel === 'age2_4' ? 'very short captions' : 'short paragraph';

  const lines = [
    `Children's book illustration in ${stylePack.promptTag}.`,
    `Landscape 16:9 aspect, ${layoutHint}. ${tone}`.trim(),
    `Palette: ${stylePack.paletteTag}.`,
    `Characters: ${charTags}.`,
    `Scene: ${args.narrative}.`,
    `Keep visuals readable for young kids; ${wordBudget}.`,
    `No text, no watermarks, wholesome, anatomically correct, consistent characters.`,
  ];
  if (args.placementHint) lines.push(`Placement: ${args.placementHint}.`);
  if (args.extras?.length) lines.push(args.extras.join(' '));
  if (args.styleTag) lines.push(`Style tag: ${args.styleTag}.`);
  const policy = policyLine();
  if (policy) lines.push(policy);
  return lines.join(' ');
}






