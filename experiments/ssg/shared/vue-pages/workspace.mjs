import { resolve } from 'node:path';
import { readFile, writeFile, mkdir, readdir, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';

export const repository = resolve(import.meta.dirname, '../../../..');
const sourceRef = '6cbe059c5d3b358557f6493b606f196c2ca06e8a';
const compilers = { 'ox-native-vue-pages': 'vue', 'ox-native-vue-pages-vize': 'vize' };
export function pathsFor(variant) {
  if (compilers[variant.name] !== variant.compiler) throw Error('Unknown Vue pages variant');
  return {
    directory: resolve(repository, 'experiments/ssg', variant.name),
    workspace: resolve(repository, '.pilot/variants', variant.name),
    output: resolve(repository, '.pilot/full', variant.name, 'public'),
  };
}
export function selectVariant(variant) {
  pathsFor(variant);
  process.env.HUB_PILOT_PAGES = 'all';
  process.env.HUB_VUE_COMPILER = variant.compiler;
  process.env.NODE_ENV = 'production';
}
async function run(command, args, options = {}) {
  const child = spawn(command, args, { cwd: repository, stdio: 'inherit', ...options });
  const code = await new Promise((ok, fail) => { child.once('close', ok); child.once('error', fail); });
  if (code !== 0) throw Error(`${command} failed (${code})`);
}
async function inputSignature(variant) {
  const digest = createHash('sha256').update(sourceRef).update(JSON.stringify(variant)).update(repository);
  const helper = 'experiments/ssg/tooling/islands-comparison';
  const files = ['pnpm-lock.yaml', `${helper}/prepare-pages.py`];
  for (const name of await readdir(resolve(repository, helper, 'vue-pages')))
    files.push(`${helper}/vue-pages/${name}`);
  for (const name of ['workspace.mjs', 'config.mjs'])
    files.push('experiments/ssg/shared/vue-pages/' + name);
  for (const file of files.sort()) digest.update(file).update(await readFile(resolve(repository, file)));
  return digest.digest('hex');
}
async function prepareVizeDependencies(directory) {
  const require = createRequire(resolve(directory, 'package.json'));
  try {
    const entry = require.resolve('@vizejs/vite-plugin');
    const { version } = JSON.parse(await readFile(resolve(entry, '../../package.json'), 'utf8'));
    if (version === '0.609.0') return;
  } catch (error) {
    if (!['MODULE_NOT_FOUND', 'ENOENT'].includes(error.code)) throw error;
  }
  console.log('[vue-pages] Preparing isolated Vize 0.609.0 / Vite 7.3.1 dependencies');
  await run('pnpm', ['--dir', directory, 'install', '--ignore-workspace', '--ignore-scripts', '--frozen-lockfile']);
}
export async function prepareVariant(variant, { fresh = false } = {}) {
  const paths = pathsFor(variant);
  if (variant.compiler === 'vize') await prepareVizeDependencies(paths.directory);
  const marker = resolve(paths.workspace, 'named-variant.json');
  let previous;
  try { previous = JSON.parse(await readFile(marker, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const signature = await inputSignature(variant);
  if (!fresh && previous?.signature === signature) return paths;
  // Only disposable workspaces created by this helper may be refreshed.
  if (previous && previous.name !== variant.name) throw Error('Workspace marker mismatch');
  if (previous) await rm(paths.workspace, { recursive: true });
  await mkdir(resolve(paths.workspace, '..'), { recursive: true });
  console.log(`[vue-pages] Preparing ${variant.name} from ${sourceRef} (before SSG)`);
  const env = { ...process.env, HUB_COMPARE_WORKSPACE: paths.workspace, HUB_VUE_COMPILER: 'vue' };
  for (const name of ['HUB_CONTENT_PILOT', 'HUB_COMPILER_PROFILE', 'HUB_SSG_PROFILE', 'HUB_SSG_CPU_PROFILE', 'NODE_ENV']) delete env[name];
  await run('python3', ['experiments/ssg/tooling/islands-comparison/prepare-pages.py'], { env });
  const native = resolve(paths.workspace, 'experiments/ssg/ox-native-islands');
  const routesFile = resolve(native, 'routes.ts');
  const routes = await readFile(routesFile, 'utf8');
  const original = "export const outDir = resolve(root, `.pilot/${scope === 'all' ? 'full/' : scope === '30' ? '30/' : ''}ox-native-islands/public`);";
  if (!routes.includes(original)) throw Error('Historical routes template changed');
  await writeFile(routesFile, routes.replace(original, 'export const outDir = ' + JSON.stringify(paths.output) + ';'));
  await writeFile(resolve(native, 'vite.config.ts'), 'export { default } from ' + JSON.stringify(resolve(paths.directory, 'vite.config.ts')) + ';\n');
  // Preserve a correct source manifest after replacing these two entry files.
  const evidenceFile = resolve(paths.workspace, 'diagnostic-source.json');
  const evidence = JSON.parse(await readFile(evidenceFile, 'utf8'));
  for (const name of ['routes.ts', 'vite.config.ts']) {
    const key = 'experiments/ssg/ox-native-islands/' + name;
    evidence.files[key] = createHash('sha256').update(await readFile(resolve(paths.workspace, key))).digest('hex');
  }
  evidence.name = variant.name;
  await writeFile(evidenceFile, JSON.stringify(evidence, null, 2) + '\n');
  await writeFile(marker, JSON.stringify({ ...variant, sourceRef, signature }, null, 2) + '\n');
  return paths;
}
