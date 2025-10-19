import OpenAI from 'openai';
import { config } from '../shared';

export type AgentRole = 'planner' | 'layoutDesigner' | 'critic';

export interface AgentRunOptions {
  role: AgentRole;
  instructions: string;
  tools?: Array<{ name: string; description?: string; schema?: any; call: (args: any) => Promise<any> }>;
  maxSteps?: number;
  tokenBudget?: number;
  timeBudgetMs?: number;
}

// Minimal wrapper so we can swap in OpenAI Agents SDK later without touching call sites
export async function runAgent(options: AgentRunOptions, input: any): Promise<any> {
  const start = Date.now();
  const client = new OpenAI({ apiKey: config.getApiKey() });
  const maxSteps = Math.min(options.maxSteps ?? config.agents.maxSteps, 32);
  const tokenBudget = Math.min(options.tokenBudget ?? config.agents.tokenBudget, 100000);
  const deadline = start + (options.timeBudgetMs ?? config.agents.timeBudgetMs);

  const toolMap = new Map((options.tools ?? []).map(t => [t.name, t]));

  let steps = 0;
  let usedTokens = 0;
  let state: any = { input };

  // Simple single-pass for now; placeholder for multi-step planner/critic loop
  const sys = `[${options.role}] You are a specialized assistant. Follow instructions and call tools if provided.`;
  const user = typeof input === 'string' ? input : JSON.stringify(input);
  const resp = await client.chat.completions.create({
    model: config.models.pages,
    temperature: 0.2,
    messages: [
      { role: 'system', content: options.instructions || sys },
      { role: 'user', content: user },
    ],
  });
  const content = resp.choices?.[0]?.message?.content ?? '';
  usedTokens += (resp.usage?.total_tokens || 0);
  steps += 1;

  if (Date.now() > deadline || steps >= maxSteps || usedTokens >= tokenBudget) {
    return { content, steps, usedTokens };
  }
  return { content, steps, usedTokens };
}


