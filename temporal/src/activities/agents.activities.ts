import { runAgent } from '../agents/agentFactory';
import { BookPrefs, CharacterSpec, PageJSON } from '../types';

export async function plannerAgent(args: {
  bookId: string;
  spec: CharacterSpec;
  prefs: BookPrefs;
}): Promise<{ outlineNote: string }>{
  const res = await runAgent({
    role: 'planner',
    instructions: 'Plan a children story structure and key beats concisely.',
  }, { spec: args.spec, prefs: args.prefs });
  return { outlineNote: String(res?.content || '') };
}

export async function layoutDesignerAgent(args: {
  bookId: string;
  pages: PageJSON[];
}): Promise<{ layoutNote: string }>{
  const res = await runAgent({
    role: 'layoutDesigner',
    instructions: 'Suggest layout rationale for pages (one sentence).',
  }, { pages: args.pages.map(p => ({ index: p.pageIndex, layout: p.layout })) });
  return { layoutNote: String(res?.content || '') };
}

export async function criticAgent(args: {
  bookId: string;
  page: PageJSON;
  prefs: BookPrefs;
}): Promise<{ approved: boolean; note?: string }>{
  const res = await runAgent({
    role: 'critic',
    instructions: 'Critique the page text for age appropriateness; return APPROVE or REVISE and a brief note.',
  }, { text: args.page.text, targetAge: args.prefs.targetAge });
  const content = String(res?.content || '');
  const approved = /approve/i.test(content) && !/revise/i.test(content);
  return { approved, note: content };
}


