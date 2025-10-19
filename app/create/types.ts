// Types for the book creation wizard

// ========================================
// NEW MULTI-CHARACTER SYSTEM TYPES
// ========================================

export type CharacterType = 'animal' | 'human' | 'creature' | 'object';
export type CharacterRole = 'main' | 'sidekick';

export interface CharacterArchetype {
  id: string;
  name: string;
  type: CharacterType;
  emoji: string;
  description: string;
  ageRange: [number, number];
  defaultProps: string[]; // IDs of default props
  personality: string[]; // Personality traits
}

export interface CharacterInstance {
  id: string; // Unique instance ID
  name: string; // User-provided name
  archetypeId?: string; // Reference to archetype (if premade)
  customPrompt?: string; // AI custom prompt (if custom)
  props: string[]; // Selected prop IDs
  role: CharacterRole;
  ageBand?: string; // e.g., "3-5", "6-8", "9-12"
}

export interface CharacterRoster {
  main: CharacterInstance;
  sidekicks: CharacterInstance[]; // Max 2
  ageBand: string; // Overall age band for the book
}

export interface PropOption {
  id: string;
  name: string;
  emoji: string;
  category: 'headwear' | 'accessories' | 'tools' | 'magical' | 'bags' | 'clothing';
  ageSafe: boolean; // If false, only show for ages 9+
  minAge: number; // Minimum age for this prop
}

export interface StyleLock {
  styleFamily: string; // e.g., "watercolor", "digital", "sketch", "painted"
  palette: string[]; // Hex colors
  lineWeight: 'soft' | 'bold' | 'medium';
  material: string; // e.g., "watercolor", "digital", "pencil"
  coherenceNotes: string; // Technical notes for consistency
}

export interface CharacterSetOption {
  id: string;
  groupPreview?: string; // URL to group shot image
  individualPreviews: { characterId: string; imageUrl?: string }[]; // Solo shots
  styleMeta: {
    name: string; // e.g., "Soft Watercolor"
    description: string;
  };
  styleLock: StyleLock;
  paletteColors: string[]; // Visual color chips
}

// Unified contract for kicking off/continuing book creation across steps
export interface BookCreateSpec {
  bookId: string;
  ageBand: string; // e.g., "3-5" | "6-8" | "9-12"
  // Single-hero mode uses primaryCharacter; roster kept for backward-compat
  primaryCharacter?: {
    id: string;
    name: string;
    type: CharacterType;
    props: string[];
    ageYears: number;
    personality: string[];
  };
  characterRoster?: CharacterRoster;
  styleLock: StyleLock; // selected lock, possibly with paletteOverride applied
  characterRef?: {
    characterId: string;
    dataUri: string; // data:image/png;base64,
    width?: number;
    height?: number;
    versionHash?: string;
    notes?: string;
  };
  storyConfig?: StoryConfig;
  coverConfig?: {
    title: string;
    subtitle?: string;
    includeAllCharacters: boolean;
  };
}

// Style nudges for AI custom character
export interface StyleNudges {
  cuteness: 'adorable' | 'friendly' | 'cool';
  lineStyle: 'soft' | 'bold' | 'sketchy';
  paletteVibe: 'bright' | 'pastel' | 'natural';
}

// ========================================
// AGE GROUPS (UI constants)
// ========================================
export type AgeGroup = 'T2' | 'F2T3' | 'F3T5' | 'F5T7' | 'F7';

export const AGE_GROUPS: ReadonlyArray<{ value: AgeGroup; label: string }> = [
  { value: 'T2', label: '2 years' },
  { value: 'F2T3', label: '2-3 years' },
  { value: 'F3T5', label: '3-5 years' },
  { value: 'F5T7', label: '5-7 years' },
  { value: 'F7', label: '7+ years' },
] as const;

export interface TextRule {
  minSentences: number;
  maxSentences: number;
  maxWordsPerSentence: number;
  notes: string[];
}

export const TEXT_RULES: Record<AgeGroup, TextRule> = {
  T2:   { minSentences: 1, maxSentences: 1, maxWordsPerSentence: 4,  notes: ['present tense', 'onomatopoeia ok', 'no commas', 'no dialogue', 'punctuation limited to . ! ?'] },
  F2T3: { minSentences: 1, maxSentences: 2, maxWordsPerSentence: 5,  notes: ['present tense', 'repetition ok', 'no commas', 'no dialogue', 'punctuation limited to . ! ?'] },
  F3T5: { minSentences: 2, maxSentences: 2, maxWordsPerSentence: 7,  notes: ['simple adjectives', 'minimal punctuation', 'allow up to 1 short dialogue line', '≤1 comma total', 'no ; : ( ) — –'] },
  F5T7: { minSentences: 2, maxSentences: 2, maxWordsPerSentence: 9,  notes: ['simple dialogue ok (≤2 lines)', 'clear cause/effect', '≤2 commas total', 'no ; : ( ) — –'] },
  F7:   { minSentences: 3, maxSentences: 3, maxWordsPerSentence: 12, notes: ['one new word by context', 'avoid subordinate clauses', '≤3 commas total', '≤2 short dialogue lines', 'no ; : ( ) — –'] },
};

// (Removed) Legacy single-character and styling types

export interface StoryTopic {
  id: string;
  name: string;
  emoji: string;
  description: string;
}

export interface StoryTone {
  id: string;
  name: string;
  emoji: string;
  description: string;
  technicalValue: string; // Maps to existing tone values
}

export interface StoryConfig {
  title: string;
  topics: string[]; // IDs of selected topics
  customTopic?: string;
  pages: number;
  tone: string;
  targetAge: number;
  /**
   * Age group controls per-page text complexity; the age must not appear in output.
   * Defaults may be inferred from targetAge if not explicitly chosen.
   */
  ageGroup?: AgeGroup;
  // Accessibility
  dyslexiaMode: boolean;
  fontScale: number;
  highContrast: boolean;
}

import type { WorkflowState } from '../../temporal/src/types';
import type { BookTheme } from '@/types/book';

export interface CreateFlowState {
  currentStep: number;
  currentSubStep?: number; // For multi-step Step 1 (1.1, 1.2, 1.3)
  workflowId?: string;
  bookId?: string;
  // Live workflow progress snapshot (from SSE)
  progress?: WorkflowState;
  
  // NEW: Multi-character roster system
  characterRoster?: CharacterRoster;
  // NEW: Human hero maturity selector (only applies to human heroes)
  characterMaturity?: 'unspecified' | 'kid' | 'teen' | 'adult';
  selectedCharacterSetOption?: CharacterSetOption;
  characterSetOptions?: CharacterSetOption[]; // The 4 generated options
  // Optional palette override to slightly tweak locked palette (nudge only)
  paletteOverride?: string[];
  // Single-hero mode
  primaryCharacter?: {
    id: string;
    name: string;
    type: CharacterType;
    props: string[];
    ageYears: number;
    personality: string[];
  };
  styleLock?: StyleLock;
  characterRefDataUri?: string; // canonical full-body PNG as data URI
  
  // (Removed) Legacy single-character + style fields
  
  // Step 4: Story config
  story?: StoryConfig;
  
  // Step 5: Cover selection
  selectedCoverOptionId?: string;
  // Visual theme for this book (unique per book)
  theme?: BookTheme;
  
  // Session metadata
  createdAt: number;
  updatedAt: number;
}

// (Removed) Legacy preset characters and styling constants

export const STORY_TOPICS: StoryTopic[] = [
  { id: 'friendship', name: 'Friendship', emoji: '💝', description: 'Stories about friends and togetherness' },
  { id: 'adventure', name: 'Adventure', emoji: '🗺️', description: 'Exciting journeys and discoveries' },
  { id: 'courage', name: 'Courage', emoji: '🦁', description: 'Being brave and overcoming fears' },
  { id: 'learning', name: 'Learning', emoji: '📚', description: 'Discovering new things and growing' },
  { id: 'kindness', name: 'Kindness', emoji: '🌟', description: 'Helping others and being caring' },
  { id: 'discovery', name: 'Discovery', emoji: '🔍', description: 'Finding and exploring new things' },
  { id: 'magic', name: 'Magic', emoji: '✨', description: 'Wonder and imagination' },
  { id: 'nature', name: 'Nature', emoji: '🌳', description: 'Plants, animals, and the outdoors' },
  { id: 'family', name: 'Family', emoji: '👨‍👩‍👧', description: 'Love and family bonds' },
];

export const STORY_TONES: StoryTone[] = [
  {
    id: 'cheerful',
    name: 'Cheerful & Uplifting',
    emoji: '😊',
    description: 'Happy, positive, and joyful',
    technicalValue: 'cheerful',
  },
  {
    id: 'adventurous',
    name: 'Adventurous & Exciting',
    emoji: '🦸',
    description: 'Thrilling and action-packed',
    technicalValue: 'adventurous',
  },
  {
    id: 'calm',
    name: 'Calm & Soothing',
    emoji: '😌',
    description: 'Peaceful and relaxing',
    technicalValue: 'calm',
  },
  {
    id: 'funny',
    name: 'Funny & Playful',
    emoji: '😆',
    description: 'Humorous and entertaining',
    technicalValue: 'funny',
  },
  {
    id: 'educational',
    name: 'Educational & Informative',
    emoji: '🧠',
    description: 'Teaching and inspiring learning',
    technicalValue: 'educational',
  },
];

// ========================================
// NEW: CHARACTER ARCHETYPES GALLERY
// ========================================

export const CHARACTER_ARCHETYPES: CharacterArchetype[] = [
  // Animals 🐾
  {
    id: 'brown-bear',
    name: 'Brown Bear',
    type: 'animal',
    emoji: '🐻',
    description: 'Warm, protective, and gentle',
    ageRange: [3, 10],
    defaultProps: ['red-scarf', 'small-backpack'],
    personality: ['protective', 'warm', 'gentle', 'strong'],
  },
  {
    id: 'curious-giraffe',
    name: 'Curious Giraffe',
    type: 'animal',
    emoji: '🦒',
    description: 'Tall, observant, and curious',
    ageRange: [4, 10],
    defaultProps: ['telescope', 'star-badge'],
    personality: ['curious', 'observant', 'tall', 'gentle'],
  },
  {
    id: 'space-cat',
    name: 'Space Cat',
    type: 'animal',
    emoji: '🐱',
    description: 'Adventurous and cosmic explorer',
    ageRange: [5, 12],
    defaultProps: ['goggles', 'small-backpack'],
    personality: ['adventurous', 'brave', 'independent', 'curious'],
  },
  {
    id: 'friendly-fox',
    name: 'Friendly Fox',
    type: 'animal',
    emoji: '🦊',
    description: 'Clever, playful, and quick',
    ageRange: [4, 10],
    defaultProps: ['magnifying-glass', 'messenger-bag'],
    personality: ['clever', 'playful', 'quick', 'friendly'],
  },
  
  // Humans 👤
  {
    id: 'brave-knight',
    name: 'Brave Knight',
    type: 'human',
    emoji: '🛡️',
    description: 'Courageous and heroic',
    ageRange: [5, 12],
    defaultProps: ['crown', 'magic-cape'],
    personality: ['courageous', 'heroic', 'noble', 'strong'],
  },
  {
    id: 'young-scientist',
    name: 'Young Scientist',
    type: 'human',
    emoji: '🔬',
    description: 'Curious, smart, and inquisitive',
    ageRange: [6, 12],
    defaultProps: ['glasses', 'messenger-bag'],
    personality: ['curious', 'smart', 'inquisitive', 'logical'],
  },
  {
    id: 'little-artist',
    name: 'Little Artist',
    type: 'human',
    emoji: '🎨',
    description: 'Creative and colorful',
    ageRange: [4, 10],
    defaultProps: ['paintbrush', 'flower-crown'],
    personality: ['creative', 'imaginative', 'colorful', 'expressive'],
  },
  {
    id: 'kind-helper',
    name: 'Kind Helper',
    type: 'human',
    emoji: '💝',
    description: 'Caring, gentle, and helpful',
    ageRange: [3, 8],
    defaultProps: ['cozy-scarf', 'treasure-pouch'],
    personality: ['kind', 'caring', 'helpful', 'gentle'],
  },
  
  // Fantasy Creatures ✨
  {
    id: 'gentle-dragon',
    name: 'Gentle Dragon',
    type: 'creature',
    emoji: '🐉',
    description: 'Magical, loyal, and protective',
    ageRange: [4, 12],
    defaultProps: ['magic-cape', 'star-badge'],
    personality: ['magical', 'loyal', 'protective', 'wise'],
  },
  {
    id: 'tiny-fairy',
    name: 'Tiny Fairy',
    type: 'creature',
    emoji: '🧚',
    description: 'Delicate, sparkly, and magical',
    ageRange: [3, 8],
    defaultProps: ['wings', 'magic-wand', 'flower-crown'],
    personality: ['delicate', 'magical', 'sparkly', 'gentle'],
  },
  
  // Humanized Objects 🎈
  {
    id: 'happy-sun',
    name: 'Happy Sun',
    type: 'object',
    emoji: '☀️',
    description: 'Warm, cheerful, and bright',
    ageRange: [3, 8],
    defaultProps: ['star-badge'],
    personality: ['warm', 'cheerful', 'bright', 'positive'],
  },
  {
    id: 'robot-friend',
    name: 'Robot Friend',
    type: 'object',
    emoji: '🤖',
    description: 'Helpful, mechanical, and smart',
    ageRange: [5, 12],
    defaultProps: ['goggles', 'small-backpack'],
    personality: ['helpful', 'logical', 'friendly', 'inventive'],
  },
];

// ========================================
// NEW: PROPS LIBRARY
// ========================================

export const PROPS_LIBRARY: PropOption[] = [
  // Headwear
  {
    id: 'crown',
    name: 'Crown',
    emoji: '👑',
    category: 'headwear',
    ageSafe: true,
    minAge: 3,
  },
  {
    id: 'wizard-hat',
    name: 'Wizard Hat',
    emoji: '🎩',
    category: 'headwear',
    ageSafe: true,
    minAge: 4,
  },
  {
    id: 'baseball-cap',
    name: 'Baseball Cap',
    emoji: '🧢',
    category: 'headwear',
    ageSafe: true,
    minAge: 3,
  },
  {
    id: 'flower-crown',
    name: 'Flower Crown',
    emoji: '🌸',
    category: 'headwear',
    ageSafe: true,
    minAge: 3,
  },
  
  // Scarves & Capes
  {
    id: 'red-scarf',
    name: 'Red Scarf',
    emoji: '🧣',
    category: 'clothing',
    ageSafe: true,
    minAge: 3,
  },
  {
    id: 'magic-cape',
    name: 'Magic Cape',
    emoji: '🦸',
    category: 'clothing',
    ageSafe: true,
    minAge: 4,
  },
  {
    id: 'cozy-scarf',
    name: 'Cozy Scarf',
    emoji: '🧣',
    category: 'clothing',
    ageSafe: true,
    minAge: 3,
  },
  
  // Bags
  {
    id: 'small-backpack',
    name: 'Small Backpack',
    emoji: '🎒',
    category: 'bags',
    ageSafe: true,
    minAge: 3,
  },
  {
    id: 'messenger-bag',
    name: 'Messenger Bag',
    emoji: '💼',
    category: 'bags',
    ageSafe: true,
    minAge: 5,
  },
  {
    id: 'treasure-pouch',
    name: 'Treasure Pouch',
    emoji: '👝',
    category: 'bags',
    ageSafe: true,
    minAge: 4,
  },
  
  // Tools
  {
    id: 'magnifying-glass',
    name: 'Magnifying Glass',
    emoji: '🔍',
    category: 'tools',
    ageSafe: true,
    minAge: 5,
  },
  {
    id: 'paintbrush',
    name: 'Paintbrush',
    emoji: '🖌️',
    category: 'tools',
    ageSafe: true,
    minAge: 4,
  },
  {
    id: 'magic-wand',
    name: 'Magic Wand',
    emoji: '✨',
    category: 'magical',
    ageSafe: true,
    minAge: 3,
  },
  {
    id: 'telescope',
    name: 'Telescope',
    emoji: '🔭',
    category: 'tools',
    ageSafe: true,
    minAge: 6,
  },
  
  // Accessories
  {
    id: 'glasses',
    name: 'Glasses',
    emoji: '👓',
    category: 'accessories',
    ageSafe: true,
    minAge: 3,
  },
  {
    id: 'goggles',
    name: 'Goggles',
    emoji: '🥽',
    category: 'accessories',
    ageSafe: true,
    minAge: 4,
  },
  {
    id: 'wings',
    name: 'Wings',
    emoji: '🪽',
    category: 'magical',
    ageSafe: true,
    minAge: 3,
  },
  {
    id: 'star-badge',
    name: 'Star Badge',
    emoji: '⭐',
    category: 'accessories',
    ageSafe: true,
    minAge: 3,
  },
];

