import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { modes, pages } from '../shared/pages.mjs';
import { performance } from 'node:perf_hooks';
import { cpus, platform, arch } from 'node:os';

import { compiler, artifactMode } from '../shared/compiler.mjs';
const mode = process.argv[2];
const artifact = artifactMode(mode);
if (!modes.includes(mode))
	throw new Error(`Usage: node experiments/ssg/nuxt-pilot/build.mjs ${modes.join('|')}`);
// Nuxt and its Content cache are cold on every measured run. Output snapshots live elsewhere.
await rm('.nuxt', { recursive: true, force: true });
await rm(`.pilot/${artifact}/public`, { recursive: true, force: true });
await rm(`.pilot/${artifact}/output`, { recursive: true, force: true });
await mkdir(`.pilot/${artifact}`, { recursive: true });
const logPath = `.pilot/${artifact}/build.log`;
const log = createWriteStream(logPath);
const start = performance.now();
const child = spawn('pnpm', ['generate:nuxt'], {
	env: { ...process.env, HUB_CONTENT_PILOT: mode, CROWDIN_INTG_API: '' },
	stdio: ['ignore', 'pipe', 'pipe'],
});
child.stdout.pipe(log);
child.stderr.pipe(log);
const code = await new Promise((resolve, reject) => {
	child.once('error', reject);
	child.once('close', resolve);
});
log.end();
if (code !== 0) throw new Error(`${mode} build failed (${code}); see ${logPath}`);
const seconds = (performance.now() - start) / 1000;
const output = await readFile(logPath, 'utf8');
for (const page of pages) {
	const html = await readFile(`.pilot/${artifact}/public${page.path}index.html`, 'utf8');
	if (!html.includes(page.title)) throw new Error(`Missing generated page: ${page.path}`);
}
let history = [];
try {
	history = JSON.parse(await readFile('.pilot/timings.json', 'utf8'));
} catch {}
const result = {
	mode,
	compiler,
	artifact,
	seconds,
	prerenderSeconds: Number(output.match(/Prerendered \d+ routes in ([\d.]+) seconds/)?.[1]),
	generatedRouteCount: Number(output.match(/Prerendered (\d+) routes/)?.[1]),
	contentCacheSeconds:
		Number(output.match(/\/api\/_content\/cache\.[^\s]+ \((\d+)ms\)/)?.[1]) / 1000,
	timestamp: new Date().toISOString(),
	node: process.version,
	platform: `${platform()}-${arch()}`,
	cpu: cpus()[0]?.model,
	pages: pages.map((p) => p.path),
	cache: 'removed .nuxt before build',
};
history.push(result);
await writeFile('.pilot/timings.json', JSON.stringify(history, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
