// @@@SNIPSTART typescript-next-oneclick-workflows
import { proxyActivities, sleep } from '@temporalio/workflow';
import type * as activities from './activities';
export { PageRenderWorkflow } from './workflows/pageRender.workflow';
export { BookOrchestratorWorkflow } from './workflows/orchestrator.workflow';
export { CharacterOptionsWorkflow } from './workflows/children/characterOptions.workflow';
export { CharacterVariantWorkflow } from './workflows/children/characterVariant.workflow';
export { OutlineWorkflow } from './workflows/children/outline.workflow';
export { LayoutWorkflow } from './workflows/children/layout.workflow';
export { ManifestWorkflow } from './workflows/children/manifest.workflow';
export { CoverWorkflow } from './workflows/children/cover.workflow';

// Keep template workflow to satisfy existing API route
const { purchase } = proxyActivities<typeof activities>({
  startToCloseTimeout: '1 minute',
});

export async function oneClickBuy(id: string): Promise<string> {
  const result = await purchase(id);
  await sleep('10 seconds');
  return result;
}
// @@@SNIPEND
