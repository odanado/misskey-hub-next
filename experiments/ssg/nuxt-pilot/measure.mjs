import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const startedAt = new Date().toISOString();
// Rotate order to spread OS filesystem cache and thermal effects. Run this with
// no VRT/browser processes; each child removes the same Nuxt cache before build.
const order = [
	'baseline',
	'query',
	'native',
	'query',
	'native',
	'baseline',
	'native',
	'baseline',
	'query',
];
for (const mode of order) {
	const child = spawn(process.execPath, ['experiments/ssg/nuxt-pilot/build.mjs', mode], {
		stdio: 'inherit',
	});
	const code = await new Promise((resolve, reject) => {
		child.once('error', reject);
		child.once('close', resolve);
	});
	if (code !== 0) throw new Error(`Benchmark stopped: ${mode} failed`);
}
const samples = JSON.parse(await readFile('.pilot/timings.json', 'utf8')).filter(
	(s) => s.timestamp >= startedAt,
);
const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const summary = ['baseline', 'query', 'native'].map((mode) => {
	const rows = samples.filter((s) => s.mode === mode);
	return {
		mode,
		runs: rows.length,
		medianSeconds: median(rows.map((s) => s.seconds)),
		medianPrerenderSeconds: median(rows.map((s) => s.prerenderSeconds)),
		medianContentCacheSeconds: median(rows.map((s) => s.contentCacheSeconds)),
	};
});
await mkdir('experiments/ssg/nuxt-pilot/results', { recursive: true });
await writeFile(
	'experiments/ssg/nuxt-pilot/results/timings.json',
	JSON.stringify({ startedAt, order, summary, samples }, null, 2) + '\n',
);
console.table(summary);
