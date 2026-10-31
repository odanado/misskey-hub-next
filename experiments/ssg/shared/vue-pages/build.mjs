import { fileURLToPath } from 'node:url';
import { prepareVariant, selectVariant } from './workspace.mjs';
import { verifyVariant } from './verify.mjs';
export async function buildVariant(variant, configUrl) {
  const paths = await prepareVariant(variant);
  selectVariant(variant);
  const { build } = await import('vite');
  await build({ root: paths.workspace, configFile: fileURLToPath(configUrl) });
  await verifyVariant(variant);
  // Original Vue components may own timers. All SSG writes and checks finished.
  process.exit(0);
}
