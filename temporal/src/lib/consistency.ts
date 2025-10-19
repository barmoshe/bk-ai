// Lightweight species continuity validator for page text
// Forward-only: no data migrations, just heuristic checks

const SPECIES_LEXICON: Record<string, string[]> = {
  dog: ['bark', 'barked', 'barking', 'wag', 'wagged', 'wagging', 'fetch'],
  cat: ['meow', 'meowed', 'purr', 'purred', 'purring'],
  bear: ['growl', 'growled', 'growling', 'lumber', 'lumbered', 'lumbering'],
  bird: ['chirp', 'chirped', 'chirping', 'tweet', 'tweeted', 'tweeting'],
  lion: ['roar', 'roared', 'roaring'],
};

export function validateSpeciesContinuity(text: string, species: string): { ok: boolean; issues: string[] } {
  const issues: string[] = [];
  const s = String(species || '').toLowerCase().trim();
  if (!text || !s) return { ok: true, issues };

  const words = text.toLowerCase();
  // Build a set of disallowed tokens by taking all species lexicons except the expected one
  const disallowed: string[] = [];
  for (const [sp, toks] of Object.entries(SPECIES_LEXICON)) {
    if (sp === s) continue;
    disallowed.push(...toks);
  }
  for (const token of disallowed) {
    const re = new RegExp(`\\b${token}\\b`, 'i');
    if (re.test(words)) issues.push(`contains '${token}' which mismatches species '${s}'`);
  }
  return { ok: issues.length === 0, issues };
}

export function normalizeImagePromptSpecies(imagePrompt: string, expectedSpecies: string): string {
  if (!imagePrompt) return imagePrompt;
  let out = imagePrompt;
  const speciesWords = ['dog','cat','fox','rabbit','bear','elephant','giraffe','lion','tiger','bird','human'];
  for (const w of speciesWords) {
    const re = new RegExp(`\\b(${w})\\b`, 'gi');
    out = out.replace(re, expectedSpecies);
  }
  // Normalize determiner phrase like "<Name> the dog" => "<Name> the <species>"
  const det = new RegExp(`(the)\s+(dog|cat|fox|rabbit|bear|elephant|giraffe|lion|tiger|bird|human)`, 'gi');
  out = out.replace(det, `$1 ${expectedSpecies}`);
  return out;
}


