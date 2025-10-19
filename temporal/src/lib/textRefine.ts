import OpenAI from 'openai';

let client: OpenAI | undefined;
function getClient() {
  if (!client) client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return client;
}

export async function refinePageText(args: {
  text: string;
  targetAge: number;
  tone: string;
  title: string;
  pageIndex: number;
}): Promise<string> {
  const model = process.env.OPENAI_TEXT_REFINE_MODEL || 'gpt-4o-mini';
  const temperature = Number(process.env.OPENAI_TEMPERATURE_REFINE || 0.2);
  const system = `Polish for clarity, rhythm, and age ${args.targetAge}.
Keep creative devices: dialogue (quotes), onomatopoeia, gentle rhyme/refrain, vivid imagery.
Keep meaning and tone ${args.tone}. <=90 words. Return raw text only.`;
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

export async function engagementRefine(args: {
  text: string;
  tone: string;
  title: string;
  pageIndex: number;
  ageGroup: 'T2' | 'F2T3' | 'F3T5' | 'F5T7' | 'F7';
}): Promise<string> {
  const model = process.env.OPENAI_TEXT_REFINE_MODEL || 'gpt-4o-mini';
  const temperature = Number(process.env.OPENAI_TEMPERATURE_REFINE || 0.3);
  // Encourage micro-wonder/humor while staying within constraints (we validate later)
  const ageHints = {
    T2: 'use one vivid, concrete action with gentle onomatopoeia',
    F2T3: 'add a playful sound or tiny surprise, keep words simple',
    F3T5: 'add a sensory detail or tiny curiosity hook',
    F5T7: 'vary sentence openings, add light cause/effect or feeling',
    F7: 'introduce a subtle hook or small metaphor, keep concise',
  } as const;
  const system = `Make this page more engaging without changing meaning or increasing complexity beyond its level.
Keep it easy to understand, kid-friendly, with vivid active verbs and a tiny moment of wonder/humor.
Stay concise; preserve dialogue and refrain if present; no age/level mentions. Tone: ${args.tone}. Hint: ${ageHints[args.ageGroup]}.`;
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


