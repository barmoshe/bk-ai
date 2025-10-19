import OpenAI from 'openai';
import { config } from '../shared';

export type AgeGroup = 'T2' | 'F2T3' | 'F3T5' | 'F5T7' | 'F7';

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

export function determineAgeGroup(targetAge: number): AgeGroup {
  if (targetAge <= 2) return 'T2';
  if (targetAge <= 3) return 'F2T3';
  if (targetAge <= 5) return 'F3T5';
  if (targetAge <= 7) return 'F5T7';
  return 'F7';
}

export function splitSentences(text: string): string[] {
  const parts = text
    .replace(/[\n\r]+/g, ' ')
    .split(/(?<=[.!?])[\s]+|\n+/)
    .map(s => s.trim())
    .filter(Boolean);
  return parts;
}

export function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

export function validateAgainstRules(text: string, rules: TextRule, ageGroup?: AgeGroup): { ok: boolean; issues: string[]; sentenceCount: number; wordCounts: number[] } {
  const sentences = splitSentences(text);
  const sentenceCount = sentences.length;
  const wordCounts = sentences.map(wordCount);
  const issues: string[] = [];
  if (sentenceCount < rules.minSentences || sentenceCount > rules.maxSentences) {
    issues.push(`sentenceCount ${sentenceCount} outside [${rules.minSentences}, ${rules.maxSentences}]`);
  }
  wordCounts.forEach((n, i) => {
    if (n > rules.maxWordsPerSentence) issues.push(`sentence ${i + 1} too long (${n} > ${rules.maxWordsPerSentence})`);
  });

  // Helper counters
  const commaCount = (text.match(/,/g) || []).length;
  // Count quoted segments as dialogue lines (either single or double quotes)
  const dialogueSegments = (text.match(/"[^"\n]+"|'[^'\n]+'/g) || []).length;

  // Additional punctuation/style constraints per age group
  if (ageGroup === 'T2' || ageGroup === 'F2T3') {
    if (commaCount > 0) issues.push('commas not allowed for this age');
    if (/[;:()]/.test(text)) issues.push('complex punctuation not allowed for this age');
    if (/[—–]/.test(text)) issues.push('dashes not allowed for this age');
    if (/['"]/.test(text)) issues.push('dialogue not allowed for this age');
  } else if (ageGroup === 'F3T5') {
    if (commaCount > 1) issues.push(`too many commas (${commaCount} > 1)`);
    if (dialogueSegments > 1) issues.push(`too many dialogue lines (${dialogueSegments} > 1)`);
    if (/[;:()—–]/.test(text)) issues.push('complex punctuation not allowed for this age');
  } else if (ageGroup === 'F5T7') {
    if (commaCount > 2) issues.push(`too many commas (${commaCount} > 2)`);
    if (dialogueSegments > 2) issues.push(`too many dialogue lines (${dialogueSegments} > 2)`);
    if (/[;:()—–]/.test(text)) issues.push('complex punctuation not allowed for this age');
  } else if (ageGroup === 'F7') {
    if (commaCount > 3) issues.push(`too many commas (${commaCount} > 3)`);
    if (dialogueSegments > 2) issues.push(`too many dialogue lines (${dialogueSegments} > 2)`);
    if (/[;:()—–]/.test(text)) issues.push('complex punctuation not allowed for this age');
  }
  return { ok: issues.length === 0, issues, sentenceCount, wordCounts };
}

// Best-effort clamping utility to conform text to age rules when model refinements fall short
export function enforceTextToRules(text: string, rules: TextRule, ageGroup?: AgeGroup): string {
  if (!text) return text;
  let working = text.replace(/[\r\n]+/g, ' ').trim();

  // Strip disallowed complex punctuation by age group
  const stripComplex = () => {
    if (ageGroup === 'T2' || ageGroup === 'F2T3') {
      working = working.replace(/[;:()—–]/g, '');
      working = working.replace(/[,]/g, '');
      working = working.replace(/["']/g, '');
    } else if (ageGroup === 'F3T5') {
      working = working.replace(/[;:()—–]/g, '');
    } else if (ageGroup === 'F5T7' || ageGroup === 'F7') {
      working = working.replace(/[;:()—–]/g, '');
    }
  };
  stripComplex();

  // Reduce commas to allowed maximum per group
  const maxCommas = ageGroup === 'F3T5' ? 1 : ageGroup === 'F5T7' ? 2 : ageGroup === 'F7' ? 3 : 0;
  if (maxCommas >= 0) {
    let count = 0;
    working = working.replace(/,/g, () => (++count <= maxCommas ? ',' : ''));
  }

  // Reduce dialogue segments to allowed maximum per group by removing extra quote marks
  const maxDialogue = ageGroup === 'F3T5' ? 1 : ageGroup === 'F5T7' ? 2 : ageGroup === 'F7' ? 2 : 0;
  if (maxDialogue === 0) {
    working = working.replace(/["']/g, '');
  } else {
    let seen = 0;
    working = working.replace(/(\"[^\"\n]+\"|'[^'\n]+')/g, (m) => {
      if (seen < maxDialogue) { seen++; return m; }
      // Drop surrounding quotes but keep content
      return m.slice(1, -1);
    });
  }

  // Enforce sentence and word caps
  const sentences = splitSentences(working);
  const trimmedSentences = sentences.slice(0, rules.maxSentences).map((s) => {
    const tokens = s.split(/\s+/).filter(Boolean);
    if (tokens.length <= rules.maxWordsPerSentence) return s.trim();
    const kept = tokens.slice(0, rules.maxWordsPerSentence).join(' ');
    // Ensure sentence ends with simple punctuation
    return /[.!?]$/.test(kept) ? kept : `${kept}.`;
  });
  // If we had fewer sentences than required, keep as-is (do not fabricate content)
  working = trimmedSentences.join(' ').trim();
  stripComplex();
  return working;
}

let client: OpenAI | undefined;
function getClient() {
  if (!client) {
    client = new OpenAI({ apiKey: config.getApiKey() });
  }
  return client;
}

export async function refineToAgeRules(args: {
  text: string;
  ageGroup: AgeGroup;
  tone: string;
  title: string;
  pageIndex: number;
}): Promise<string> {
  const rules = TEXT_RULES[args.ageGroup];
  const model = config.models.refine;
  const temperature = config.temperatures.refine;
  const system = [
    `Rewrite for a children's book page.`,
    `Write ${rules.minSentences === rules.maxSentences ? `exactly ${rules.minSentences}` : `${rules.minSentences}-${rules.maxSentences}`} sentences.`,
    `Max ${rules.maxWordsPerSentence} words per sentence.`,
    `${rules.notes.join('; ')}.`,
    `Do not mention ages or reading levels. Keep tone ${args.tone}.`,
  ].join(' ');
  const user = `Book: ${args.title}\nPage ${args.pageIndex}\nText:\n${args.text}`;
  try {
    const resp = await getClient().chat.completions.create({
      model,
      temperature,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    });
    const out = resp.choices?.[0]?.message?.content?.trim();
    return out || args.text;
  } catch {
    return args.text;
  }
}

// Age-relevant content cues to keep outputs familiar and engaging without increasing complexity
export function ageCues(ageGroup: AgeGroup): string[] {
  switch (ageGroup) {
    case 'T2':
      return [
        'everyday actions and routines',
        'present tense, concrete nouns/verbs',
        'one simple idea per page',
        'gentle onomatopoeia (e.g., "pop!", "whoosh!")',
      ];
    case 'F2T3':
      return [
        'playful repetition',
        'simple verbs and concrete objects',
        'tiny gentle surprise',
        'sound words allowed',
      ];
    case 'F3T5':
      return [
        'simple feelings words',
        'one clear sensory detail',
        'very clear goal or action',
      ];
    case 'F5T7':
      return [
        'short dialogue allowed',
        'clear cause and effect',
        'small challenge with cozy resolution',
      ];
    case 'F7':
    default:
      return [
        'subtle hook or refrain',
        'one new word taught by context',
        'concise comparisons; avoid subordinate clauses',
      ];
  }
}


