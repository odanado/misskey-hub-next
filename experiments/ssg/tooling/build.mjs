import { getStrategy } from '../shared/strategies.mjs';
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile, rm, readdir, stat } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { cpus } from 'node:os';
import { pages } from '../shared/pages.mjs';
import { compiler, artifactMode } from '../shared/compiler.mjs';
const mode = process.argv[2];
const artifact = artifactMode(mode);
const strategy = getStrategy(mode);
await mkdir(`.pilot/${artifact}`, { recursive: true });
const log = createWriteStream(`.pilot/${artifact}/build.log`);
const started = performance.now();
const profileStages = {};
let phaseStarted = performance.now();
await rm(`.pilot/${artifact}/public`, { recursive: true, force: true });
await rm(`.pilot/${artifact}/cache`, { recursive: true, force: true });
await rm(`experiments/ssg/${strategy.directory}/.astro`, { recursive: true, force: true });
profileStages.cleanupMs = performance.now() - phaseStarted;
const command = strategy.entry ? process.execPath : 'pnpm';
const args =
	strategy.entry ? [strategy.entry] : ['exec', strategy.framework === 'vite' ? 'vite' : 'astro', 'build', '--config', strategy.config];
if (process.env.HUB_SSG_CPU_PROFILE === '1' && mode === 'ox-ported') {
	const cpuDir = process.env.HUB_SSG_CPU_DIR ?? `.pilot/${artifact}/cpu-profile`;
	await mkdir(cpuDir, { recursive: true });
	args.unshift('--cpu-prof', `--cpu-prof-dir=${cpuDir}`, '--cpu-prof-name=ssg.cpuprofile');
}
phaseStarted = performance.now();
const child = spawn(command, args, {
	env: {
		...process.env,
		NODE_ENV: 'production',
		HUB_CONTENT_PILOT: mode,
		ASTRO_TELEMETRY_DISABLED: '1',
	},
	stdio: ['ignore', 'pipe', 'pipe'],
});
child.stdout.pipe(log, { end: false });
child.stderr.pipe(log, { end: false });
const code = await new Promise((resolve, reject) => {
	child.once('error', reject);
	child.once('close', resolve);
});
await new Promise((resolve) => log.end(resolve));
profileStages.childProcessMs = performance.now() - phaseStarted;
phaseStarted = performance.now();
if (code !== 0) throw new Error(`Build failed: ${mode}; see .pilot/${artifact}/build.log`);
for (const page of pages) {
	const html = await readFile(`.pilot/${artifact}/public${page.path}index.html`, 'utf8');
	if (!html.includes(page.title)) throw new Error('Missing static page ' + page.path);
}
profileStages.validateMs = performance.now() - phaseStarted;
if (process.env.HUB_SSG_PROFILE === '1') {
	const file = process.env.HUB_SSG_PROFILE_FILE ?? `.pilot/${artifact}/profile-worker.json`;
	const profile = JSON.parse(await readFile(file, 'utf8'));
	profile.outer = { ...profileStages, totalMs: performance.now() - started };
	await writeFile(file, JSON.stringify(profile, null, 2) + '\n');
}
const sample = {
	mode,
	compiler,
	artifact,
	seconds: (performance.now() - started) / 1000,
	timestamp: new Date().toISOString(),
	node: process.version,
	cpu: cpus()[0]?.model,
	scope:
		'fresh metadata and Markdown, Vue theme compilation, CSS, hydration bundle, static HTML, complete public assets; child startup included',
	pages: pages.map((p) => p.path),
};
const output = await readFile(`.pilot/${artifact}/build.log`, 'utf8');
const phases = /\[port-data\] (\{[^\n]+\})/.exec(output)?.[1];
if (phases) sample.dataPhases = JSON.parse(phases);
let samples = [];
try {
	samples = JSON.parse(await readFile('.pilot/ported-timings.json', 'utf8'));
} catch {}
samples.push(sample);
await writeFile('.pilot/ported-timings.json', JSON.stringify(samples, null, 2) + '\n');
console.log(JSON.stringify(sample, null, 2));
