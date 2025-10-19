// @@@SNIPSTART typescript-next-oneclick-activities
export * from './activities/openai.activities';
export * from './activities/render.activities';
export * from './activities/files.activities';
export * from './activities/style.activities';
export * from './activities/layout.activities';
export * from './activities/layout.activities';
export * from './activities/assets.activities';
export * from './activities/agents.activities';
export * from './activities/character.activities';
export * from './activities/cover.activities';

// New exports may be used by workflows

// Keep template activity used by oneClickBuy
import { activityInfo } from '@temporalio/activity';
export async function purchase(id: string): Promise<string> {
  console.log(`Purchased ${id}!`);
  return activityInfo().activityId;
}
// @@@SNIPEND
