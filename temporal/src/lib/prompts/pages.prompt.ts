import { BookPrefs, CharacterSpec } from '../../types';
import { determineAgeGroup, TEXT_RULES, ageCues, AgeGroup } from '../ageRules';

export const PAGES_PROMPT_VERSION = 'pages-v2';

export function buildSystem(prefs: BookPrefs): string {
  const ag: AgeGroup = (prefs.ageGroup as any) || determineAgeGroup(prefs.targetAge);
  const rules = TEXT_RULES[ag];
  const cues = ageCues(ag).map(c => `- ${c}`).join('\n');
  const sentenceRule = rules.minSentences === rules.maxSentences ? `exactly ${rules.minSentences}` : `${rules.minSentences}-${rules.maxSentences}`;
  return `You are an award‑winning children's author collaborating with an illustrator.
You must output ONE JSON object with key "pages" only. pages is an array for pageIndex 1..${prefs.pages}.
Each page has: pageIndex (int), text (<=90 words, suitable for young readers), imagePrompt (<=18 words), layout (one of [imageRight,imageLeft,imageTop]), imageUrl (empty string).
Strict JSON only: no prose, no markdown, no extra keys.

Creative rules:
- Keep a clear arc across pages: Page 1 setup; Pages 2..${Math.max(2, prefs.pages - 1)} small discoveries/obstacles; Page ${prefs.pages} cozy resolution.
- Maintain continuity of the main character (name, traits, provided species if any, and optional maturity/age) and the book title/topic.
- If a species is provided in context, use exactly that (e.g., "<Name> the <species>"). If species is unknown, do not invent a species; refer to the hero by name only.
- Use vivid, concrete sensory details (2–3 per page), varied sentence openings, active verbs.
- Include gentle humor or wonder; avoid moralizing and clichés.
- Sprinkle kid‑friendly onomatopoeia (e.g., "whoosh!", "pop!") and 0–2 short dialogue lines (straight quotes) per page.
- Encourage a tiny hook or recurring refrain if appropriate to the page.
- Keep language simple and concrete; no reading-level labels.

Age-targeted text constraints (do not mention age or level):
- Write ${sentenceRule} sentences. Max ${rules.maxWordsPerSentence} words per sentence.
- ${rules.notes.join('; ')}.
Familiar content cues for this audience:\n${cues}

imagePrompt rules (summary seed for the illustrator):
- 10–18 words. Include subject + action + setting + time‑of‑day + mood. No style/camera jargon.
- Be specific and concrete; avoid abstract themes. Do not write "scene N".
- If the hero is a non-human animal and species is provided, include it at least once across the book (short form like "<Name> the <species>"). Do not invent a species if unknown.
- Align with chosen layout for variety across the book.`;
}

export function buildUser(spec: CharacterSpec, prefs: BookPrefs): string {
  // Species hint derived from traits to reduce ambiguity without migrations
  const known = ['dog','cat','fox','rabbit','bear','elephant','giraffe','lion','tiger','bird','human'];
  const traits = (spec.traits || []).map(t => String(t).toLowerCase());
  const speciesHint = traits.find(t => known.includes(t)) || '';
  const speciesLine = speciesHint ? `\nHero species: ${speciesHint}` : '';
  return `Title: ${prefs.title}
Topic: ${prefs.topic}
Tone: ${prefs.tone}
Hero: ${spec.name}${typeof spec.age === 'number' ? `, age ${spec.age}` : ''}${spec.maturity && spec.maturity !== 'unspecified' ? `, maturity ${spec.maturity}` : ''}, traits: ${spec.traits.join(', ')}
Visual palette: ${spec.palette.join(', ')}
Style hints: ${spec.style}
Notes:
- Keep the hero central each page; vary locations and small obstacles.
- Use a short recurring line inspired by the title if age ${prefs.targetAge} ≤ 4.${speciesLine}`;
}


