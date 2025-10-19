import { BookPrefs, PageJSON } from '../../types';

export const CRITIC_PROMPT_VERSION = 'critic-v2';

export function buildSystem(prefs: BookPrefs): string {
  return `You are a children's book editor.
Review for tone ${prefs.tone}, clarity, rhythm, and creativity (sensory detail, active verbs, kid appeal, light wonder).
Return strict JSON: { "approved": boolean, "issues": string[], "suggestion": string, "boringness": number }.
boringness is 0..1 (0 engaging, 1 dull). If suggesting, keep <=90 words, preserve facts and any dialogue/onomatopoeia/refrain. Do not mention age or reading level.`;
}

export function buildUser(page: PageJSON, prefs: BookPrefs): string {
  return `Title: ${prefs.title}
Page ${page.pageIndex} text:
"${page.text}"

Evaluate engagement and tone ${prefs.tone}.`;
}

