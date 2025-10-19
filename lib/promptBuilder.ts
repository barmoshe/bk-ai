// Professional prompt engineering system for character generation
// Optimized for children's book illustration consistency

import { 
  CharacterInstance, 
  CharacterRoster, 
  CharacterArchetype,
  PropOption,
  StyleNudges,
  StyleLock,
  CHARACTER_ARCHETYPES,
  PROPS_LIBRARY,
  BookCreateSpec
} from '@/app/create/types';

// ========================================
// SAFETY FILTERS & CONTENT MODERATION
// ========================================

const BLOCKED_TERMS = [
  'weapon', 'gun', 'knife', 'sword', 'violent', 'scary', 'blood',
  'war', 'fight', 'kill', 'death', 'hurt', 'pain', 'evil',
  'devil', 'demon', 'ghost', 'zombie', 'monster', 'creepy',
  'brand', 'logo', 'nike', 'adidas', 'coca-cola', 'disney',
  'political', 'religious', 'jesus', 'god', 'allah', 'buddha',
  'trump', 'biden', 'vote', 'election', 'war', 'protest'
];

const SAFE_REPLACEMENTS: Record<string, string> = {
  'sword': 'magic wand',
  'gun': 'toy water squirter',
  'knife': 'butter knife',
  'scary': 'mysterious',
  'evil': 'mischievous',
  'monster': 'friendly creature',
  'ghost': 'friendly spirit',
  'fight': 'play',
  'war': 'adventure',
};

export function sanitizePrompt(prompt: string): string {
  let sanitized = prompt.toLowerCase();
  
  // Check for blocked terms
  for (const blocked of BLOCKED_TERMS) {
    if (sanitized.includes(blocked)) {
      // Try replacement first
      if (SAFE_REPLACEMENTS[blocked]) {
        sanitized = sanitized.replace(new RegExp(blocked, 'gi'), SAFE_REPLACEMENTS[blocked]);
      } else {
        // Remove the term
        sanitized = sanitized.replace(new RegExp(blocked, 'gi'), '');
      }
    }
  }
  
  return sanitized.trim();
}

export function validateAgeSafety(prompt: string, ageBand: string): { safe: boolean; warning?: string } {
  const age = parseInt(ageBand.split('-')[0]);
  const sanitized = prompt.toLowerCase();
  
  // Extra strict for ages 3-5
  if (age <= 5) {
    const youngKidUnsafe = ['complex', 'difficult', 'scary', 'dark', 'shadow'];
    for (const term of youngKidUnsafe) {
      if (sanitized.includes(term)) {
        return {
          safe: false,
          warning: `For ages 3-5, let's keep it simple and bright! Try something more cheerful.`
        };
      }
    }
  }
  
  return { safe: true };
}

// ========================================
// CUSTOM CHARACTER PROMPT BUILDER
// ========================================

export interface CustomCharacterPromptParams {
  userDescription: string;
  ageBand: string;
  styleNudges?: StyleNudges;
}

export function buildCustomCharacterPrompt(params: CustomCharacterPromptParams): string {
  const { userDescription, ageBand, styleNudges } = params;
  const safeDescription = sanitizePrompt(userDescription);
  const audience = parseInt(ageBand.split('-')[0]);
  const cutenessLevel = styleNudges?.cuteness || 'friendly';
  const lineStyle = styleNudges?.lineStyle || 'soft';
  const paletteVibe = styleNudges?.paletteVibe || 'bright';

  return `Create a character: ${safeDescription}.

Audience: suitable for readers around age ${audience}. Keep visuals appropriate for the audience, avoid violence, brands, and embedded text. Do not infantilize the character unless explicitly described.

Style: Professional illustration with ${lineStyle} lines.
Character should be ${cutenessLevel}, expressive, and iconic.

Visual Requirements:
- Clear, distinctive silhouette for recognition
- Expressive features and readable body language
- Consistent across multiple scenes
- Color palette vibe: ${paletteVibe}

Technical Specs:
- Full body, white or transparent background
- PNG-ready output (no watermarks, no text or logos)

Design Notes:
- Distinctive features that remain consistent across poses`;
}

// ========================================
// SIMPLE SINGLE-CHARACTER PROMPT (low-res, no transparency)
// ========================================

export function buildSimpleCharacterPrompt(input: {
  name: string;
  ageYears: number;
  looks: string;
  description: string;
}): string {
  const safeLooks = sanitizePrompt(input.looks || '');
  const safeDesc = sanitizePrompt(input.description || '');
  const age = Number.isFinite(input.ageYears) ? input.ageYears : 6;

  return [
    `Design a children's book character named "${input.name}" (age ${age}).`,
    `Looks: ${safeLooks}. Personality/role: ${safeDesc}.`,
    `Style: friendly shapes, clean lines, clear silhouette, vibrant but balanced colors.`,
    `Safety: kid-appropriate, no weapons, no brands/logos, no embedded text.`,
    `Output: full-body on white background, low resolution.`
  ].join(' ');
}

// ========================================
// SINGLE-HERO — TUNED PROMPTS (V2)
// ========================================

export function buildSingleHeroDesignPrompt(input: {
  name: string;
  speciesOrType: string;
  ageYears: number;
  personality: string[];
  props: string[];
  styleLock: StyleLock;
  ageBand: string; // audience only
  maturity?: 'unspecified' | 'kid' | 'teen' | 'adult';
}): string {
  const { name, speciesOrType, ageYears, personality, props, styleLock, ageBand, maturity } = input;
  const styleLockHeader = `Style: ${styleLock.styleFamily}; Material: ${styleLock.material}; Lines: ${styleLock.lineWeight}; Palette: ${styleLock.palette.join(', ')}`;
  const safety = 'Appropriate for target readers, non-violent, no brands/logos/text';
  const output = 'Full-body, clear silhouette, transparent/white background, high-res PNG';

  const audience = parseInt(ageBand.split('-')[0]);
  const maturityLine = maturity && maturity !== 'unspecified' ? `maturity: ${maturity}; ` : '';
  const ageLine = Number.isFinite(ageYears) ? `age ${ageYears}; ` : '';

  return `Design a story character.
${styleLockHeader}
Reader audience ~${audience}. Safety: ${safety}
Identity: ${speciesOrType} named "${name}"; ${maturityLine}${ageLine}personality: ${personality.join(', ')}
Props: ${props.join(', ')}. Keep features iconic and easy to replicate.
Species/Physical lock: clearly depict the species with distinctive markers (ears, tail, markings) to ensure consistent identification across pages.
Output: ${output}. No embedded text/logos.`;
}

export function buildHeroVariantsPrompt(input: {
  name: string;
  styleLock: StyleLock;
  effectivePalette: string[];
}): string {
  const { name, styleLock } = input;
  const styleLockHeader = `Style: ${styleLock.styleFamily}; Material: ${styleLock.material}; Lines: ${styleLock.lineWeight}; Palette: ${styleLock.palette.join(', ')}`;
  const output = 'Full-body, clear silhouette, transparent/white background, high-res PNG';
  return `Create 4 variations of the same hero.
${styleLockHeader}
Keep: outfit, colors, proportions, props, face, hairstyle.
Vary subtly: pose and expression only (friendly, kid-appropriate).
Output: ${output}. No embedded text/logos.`;
}

export function buildCanonicalPortraitPrompt(input: { name: string; styleLock: StyleLock }): string {
  const { name, styleLock } = input;
  const styleLockHeader = `Style: ${styleLock.styleFamily}; Material: ${styleLock.material}; Lines: ${styleLock.lineWeight}; Palette: ${styleLock.palette.join(', ')}`;
  const output = 'Full-body, clear silhouette, transparent background, high-res PNG';
  return `Full-body portrait of "${name}" for reference.
${styleLockHeader}
Keep: exact colors, outfit, props. Friendly expression.
Output: ${output}. No embedded text/logos.`;
}

export function buildStoryPagePrompt(input: {
  name: string;
  styleLock: StyleLock;
  effectivePalette: string[];
  location: string;
  action: string;
  tone: string;
  theme?: {
    aspectRatio?: '4:3'|'3:2'|'1:1';
    styleHints?: string[];
    palette?: { primary: string; accent: string; muted: string };
  };
}): string {
  const { name, styleLock, effectivePalette, location, action, tone, theme } = input;
  const styleLockHeader = `Style: ${styleLock.styleFamily}; Material: ${styleLock.material}; Lines: ${styleLock.lineWeight}; Palette: ${effectivePalette.join(', ')}`;
  const safety = 'Kid-safe, friendly, non-violent, no brands/logos/text';
  const hints = theme?.styleHints?.length ? `, ${theme.styleHints.join(', ')}` : '';
  const aspect = theme?.aspectRatio ? `aspect ${theme.aspectRatio}, ` : '';
  const paletteHint = theme?.palette ? ` Emphasize colors: ${theme.palette.primary}, ${theme.palette.accent}, ${theme.palette.muted}.` : '';
  return `Children's book page illustration.
${styleLockHeader}
Palette: ${effectivePalette.join(', ')}. Safety: ${safety}
Scene: ${location}; Action: ${action}; Mood: ${tone}
Characters: only the hero "${name}" visible (use provided reference image).
Continuity: match hero from reference exactly.
Output: ${aspect}${'high-res PNG, no embedded text/logos'}${paletteHint}${hints}.`;
}

// New: Age-aware page text prompt (LLM instruction), keeps full-book context
export type AgeGroup = 'T2' | 'F2T3' | 'F3T5' | 'F5T7' | 'F7';

export const TEXT_RULES: Record<AgeGroup, { minSentences: number; maxSentences: number; maxWordsPerSentence: number; notes: string[] }> = {
  T2:   { minSentences: 1, maxSentences: 1, maxWordsPerSentence: 4,  notes: ['present tense', 'onomatopoeia ok', 'no commas'] },
  F2T3: { minSentences: 1, maxSentences: 2, maxWordsPerSentence: 5,  notes: ['present tense', 'repetition ok', 'no commas'] },
  F3T5: { minSentences: 2, maxSentences: 2, maxWordsPerSentence: 7,  notes: ['simple adjectives', 'minimal punctuation'] },
  F5T7: { minSentences: 2, maxSentences: 2, maxWordsPerSentence: 9,  notes: ['simple dialogue ok', 'clear cause/effect'] },
  F7:   { minSentences: 3, maxSentences: 3, maxWordsPerSentence: 12, notes: ['one new word by context', 'avoid subordinate clauses'] },
};

export function buildPageTextPrompt(args: {
  ageGroup: AgeGroup;
  synopsis: string;
  outlineBeat: string;
  characters: string[];
  previousPages: string[];
}): string {
  const r = TEXT_RULES[args.ageGroup];
  const sentenceRule = r.minSentences === r.maxSentences ? `exactly ${r.minSentences}` : `${r.minSentences}-${r.maxSentences}`;
  return [
    `You are writing a children's book page.`,
    `Use the story context:`,
    `Synopsis: ${args.synopsis}`,
    `Current page beat: ${args.outlineBeat}`,
    `Main characters: ${args.characters.join(', ')}`,
    `Earlier pages: ${args.previousPages.join(' | ')}`,
    `Rules: Write ${sentenceRule} sentences.`,
    `Max ${r.maxWordsPerSentence} words per sentence. ${r.notes.join('; ')}.`,
    `Do not mention age or reading level.`,
    `Output JSON only: {"sentences":["..."]}.`,
    `Self-check: If any sentence breaks a rule, rewrite shorter.`,
  ].join('\n');
}

export function buildCoverPrompt(input: { name: string; styleLock: StyleLock; effectivePalette: string[]; tone: string }): string {
  const { name, styleLock, effectivePalette, tone } = input;
  const styleLockHeader = `Style: ${styleLock.styleFamily}; Material: ${styleLock.material}; Lines: ${styleLock.lineWeight}; Palette: ${effectivePalette.join(', ')}`;
  const safety = 'Kid-safe, friendly, non-violent, no brands/logos/text';
  return `Children's book cover art (no embedded text).
${styleLockHeader}
Palette: ${effectivePalette.join(', ')}. Safety: ${safety}
Focus on hero "${name}"; leave clean negative space in top third for title overlay.
Output: aspect 3:4, high-res PNG, no watermarks or logos.`;
}

// ========================================
// CHARACTER SET GENERATION PROMPTS (legacy, kept for compatibility)
// ========================================

interface CharacterSetPromptParams {
  roster: CharacterRoster;
  archetypes: CharacterArchetype[];
  props: PropOption[];
}

function formatCharacterList(roster: CharacterRoster, archetypes: CharacterArchetype[], props: PropOption[]): string {
  const allChars = [roster.main, ...roster.sidekicks];
  
  return allChars.map((char, idx) => {
    const role = char.role === 'main' ? 'MAIN CHARACTER (larger)' : `Sidekick ${idx}`;
    const archetype = archetypes.find(a => a.id === char.archetypeId);
    const charProps = char.props.map(propId => {
      const prop = props.find(p => p.id === propId);
      return prop?.name || propId;
    }).join(', ');
    
    if (char.customPrompt) {
      return `${role}: "${char.name}" - ${char.customPrompt}. Props: ${charProps || 'none'}`;
    } else {
      return `${role}: "${char.name}" - ${archetype?.description || 'character'}. ${archetype?.type || ''}. Props: ${charProps || 'none'}`;
    }
  }).join('\n');
}

export function buildCharacterSetPrompts(params: CharacterSetPromptParams): Record<string, string> {
  const { roster, archetypes, props } = params;
  const characterList = formatCharacterList(roster, archetypes, props);
  const proportions = 'Maintain coherent proportions and clear silhouettes across characters.';
  
  return {
    // Option 1: Soft Watercolor + Pastel
    option1: `Professional children's book illustration, watercolor style.

Characters in this scene:
${characterList}

Artistic Style:
- Soft, flowing watercolor technique
- Gentle edges and dreamy atmosphere
- Pastel color palette: soft pink, lavender, mint green, cream, baby blue
- Delicate color blending and light washes
- ${proportions}

Composition:
- All characters together in a friendly group arrangement
- Main character in center or slight foreground
- Characters interacting positively (looking at each other, friendly poses)
- Balanced, harmonious layout

Technical Requirements:
- Consistent art style across ALL characters
- Each character maintains their distinctive features and props
- White background
- PNG with transparency preferred
- Professional children's book quality
- NO text, logos, or brand elements

Character Consistency:
- Each character should be easily recognizable
- Maintain archetype features and selected props
- Expressive, friendly faces
- Clear silhouettes`,

    // Option 2: Bold Digital + Bright Rainbow
    option2: `Professional children's book illustration, modern digital art style.

Characters in this scene:
${characterList}

Artistic Style:
- Bold, crisp digital coloring
- Strong outlines and clean edges
- Bright rainbow palette: vibrant red, sunny yellow, electric blue, grass green, royal purple
- High contrast, energetic feel
- Modern, contemporary aesthetic
- ${proportions}

Composition:
- All characters together in a dynamic, playful arrangement
- Main character prominently positioned
- Energetic poses and expressions
- Vibrant, eye-catching layout

Technical Requirements:
- Consistent digital art style across ALL characters
- Each character maintains their distinctive features and props
- White background
- PNG format, crisp edges
- Professional children's book quality
- NO text, logos, or brand elements

Character Consistency:
- Crystal clear character recognition
- Bold, expressive features
- Props rendered with clear detail
- Playful, engaging personalities`,

    // Option 3: Cozy Sketch + Natural Earth Tones
    option3: `Professional children's book illustration, hand-drawn pencil sketch style.

Characters in this scene:
${characterList}

Artistic Style:
- Warm, hand-drawn pencil sketch technique
- Soft shading and organic lines
- Natural earth tone palette: warm brown, forest green, soft yellow, sky blue, cream
- Cozy, approachable feel
- Traditional, hand-crafted aesthetic
- ${proportions}

Composition:
- All characters together in a warm, inviting arrangement
- Main character as the focal point
- Natural, relaxed poses
- Friendly, intimate grouping

Technical Requirements:
- Consistent sketch style across ALL characters
- Each character maintains their distinctive features and props
- White background
- PNG format with sketch texture
- Professional children's book quality
- NO text, logos, or brand elements

Character Consistency:
- Recognizable sketched features
- Soft, gentle expressions
- Props sketched with warmth
- Cozy, safe feeling`,

    // Option 4: Classic Painted + Warm Sunset
    option4: `Professional children's book illustration, classic storybook painting.

Characters in this scene:
${characterList}

Artistic Style:
- Rich oil painting style with visible brushstrokes
- Classic, timeless storybook aesthetic
- Warm sunset palette: coral, peach, golden yellow, soft purple, warm pink
- Painterly texture and depth
- Traditional, nostalgic feel
- ${proportions}

Composition:
- All characters together in a classic storybook arrangement
- Main character as the hero/protagonist focus
- Traditional, balanced composition
- Warm, golden-hour lighting feel

Technical Requirements:
- Consistent painted style across ALL characters
- Each character maintains their distinctive features and props
- White background
- PNG format with painted texture
- Professional children's book quality
- NO text, logos, or brand elements

Character Consistency:
- Classic, timeless character design
- Expressive painted features
- Props rendered with painterly detail
- Warm, comforting atmosphere`
  };
}

// ========================================
// INDIVIDUAL CHARACTER SOLO PROMPTS
// ========================================

interface SoloCharacterPromptParams {
  character: CharacterInstance;
  styleLock: StyleLock;
  archetype?: CharacterArchetype;
  props: PropOption[];
}

export function buildSoloCharacterPrompt(params: SoloCharacterPromptParams): string {
  const { character, styleLock, archetype, props } = params;
  
  const charProps = character.props.map(propId => {
    const prop = props.find(p => p.id === propId);
    return prop?.name || propId;
  }).join(', ');
  
  const description = character.customPrompt || archetype?.description || 'character';
  const paletteColors = styleLock.palette.join(', ');
  
  return `Full body portrait of "${character.name}", a ${description}.

Locked Style Requirements:
- Style: ${styleLock.styleFamily} with ${styleLock.lineWeight} lines
- Material: ${styleLock.material}
- Color Palette: ${paletteColors}
- Consistent with previous character set

Character Details:
- Props: ${charProps || 'none'}
- Expression: Happy, friendly, welcoming (age-appropriate)
- Pose: Standing, full body visible, front-facing or slight 3/4 view

Technical Requirements:
- Clear silhouette for easy recognition
- Distinctive features matching group shot
- White background, PNG format
- Professional children's book quality
- NO text, logos, or brand elements

Consistency Notes:
${styleLock.coherenceNotes}

This character must be immediately recognizable as the same character from the group shot.
Maintain exact same color scheme, proportions, and visual style.`;
}

// ========================================
// REFINEMENT & VARIATION PROMPTS
// ========================================

interface VariationPromptParams {
  previousPrompt: string;
  styleLock: StyleLock;
  variationType: 'shuffle' | 'prop-swap' | 'expression';
  changes?: {
    characterId?: string;
    oldProps?: string[];
    newProps?: string[];
    newExpression?: string;
  };
}

export function buildVariationPrompt(params: VariationPromptParams): string {
  const { previousPrompt, styleLock, variationType, changes } = params;
  
  if (variationType === 'shuffle') {
    return `Generate a variation of the previous character set.

MAINTAIN (do not change):
- Style family: ${styleLock.styleFamily}
- Color palette: ${styleLock.palette.join(', ')}
- Line weight: ${styleLock.lineWeight}
- All character archetypes and props
- Character names and roles

VARY (subtle changes only):
- Slight pose adjustments (different stances, arm positions)
- Subtle expression variations (still friendly and positive)
- Composition angle (slight rotation or arrangement)
- Minor background elements positioning

Keep all characters immediately recognizable.
Same style family as previous generation.
Subtle variation, not a complete redesign.

${previousPrompt}`;
  }
  
  if (variationType === 'prop-swap' && changes) {
    return `Update character "${changes.characterId}" in current character set.

CHANGE:
- Remove props: ${changes.oldProps?.join(', ') || 'none'}
- Add props: ${changes.newProps?.join(', ') || 'none'}

MAINTAIN (exact same):
- Style lock: ${styleLock.styleFamily}, ${styleLock.lineWeight} lines
- Color palette: ${styleLock.palette.join(', ')}
- Character features, face, body proportions
- Expression and personality
- All other characters unchanged

Seamlessly integrate new props into existing design.
Character must remain immediately recognizable.
Props should match the established art style.

${previousPrompt}`;
  }
  
  if (variationType === 'expression' && changes) {
    return `Update character "${changes.characterId}" expression.

CHANGE:
- New expression: ${changes.newExpression}

MAINTAIN (exact same):
- All other features: style, palette, props, pose, proportions
- All other characters unchanged
- Style lock: ${styleLock.styleFamily}
- Color palette: ${styleLock.palette.join(', ')}

Natural, age-appropriate expression.
Consistent with character's personality.
Seamless integration with existing art style.

${previousPrompt}`;
  }
  
  return previousPrompt;
}

// ========================================
// HELPER FUNCTIONS
// ========================================

export function getAgeBandFromAge(age: number): string {
  if (age <= 5) return '3-5';
  if (age <= 8) return '6-8';
  return '9-12';
}

export function filterPropsByAge(allProps: PropOption[], ageBand: string): PropOption[] {
  const age = parseInt(ageBand.split('-')[0]);
  return allProps.filter(prop => prop.minAge <= age);
}

export function getArchetypeById(id: string): CharacterArchetype | undefined {
  return CHARACTER_ARCHETYPES.find(arch => arch.id === id);
}

export function getPropById(id: string): PropOption | undefined {
  return PROPS_LIBRARY.find(prop => prop.id === id);
}

