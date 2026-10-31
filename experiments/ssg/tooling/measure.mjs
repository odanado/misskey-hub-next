import { spawn } from 'node:child_process';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
const startedAt = new Date().toISOString();
process.env.NODE_ENV = 'production';
const portsOnly = process.argv.includes('--ports-only');
const reference = portsOnly
	? JSON.parse(await readFile('experiments/ssg/results/timings.json', 'utf8'))
	: null;
const order = portsOnly
	? [
			'ox-ported',
			'astro',
			'astro-ox',
			'astro-ox',
			'astro',
			'ox-ported',
			'astro',
			'astro-ox',
			'ox-ported',
		]
	: [
			'baseline',
			'ox-ported',
			'astro',
			'astro-ox',
			'astro-ox',
			'astro',
			'ox-ported',
			'baseline',
			'astro',
			'baseline',
			'astro-ox',
			'ox-ported',
		];
for (const mode of order) {
	const script =
		mode === 'baseline'
			? 'experiments/ssg/nuxt-pilot/build.mjs'
			: 'experiments/ssg/tooling/build.mjs';
	const child = spawn(process.execPath, [script, mode], { stdio: 'inherit' });
	const code = await new Promise((resolve, reject) => {
		child.once('error', reject);
		child.once('close', resolve);
	});
	if (code !== 0) throw new Error(`Measurement failed: ${mode}`);
}
const previous = JSON.parse(await readFile('.pilot/timings.json', 'utf8'));
const ported = JSON.parse(await readFile('.pilot/ported-timings.json', 'utf8'));
const samples = [...previous.filter((s) => s.mode === 'baseline'), ...ported].filter(
	(s) => s.timestamp >= startedAt,
);
if (reference) samples.push(...reference.samples.filter((s) => s.mode === 'baseline'));
const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const summary = ['baseline', 'ox-ported', 'astro', 'astro-ox'].map((mode) => {
	const rows = samples.filter((s) => s.mode === mode);
	const seconds = rows.map((r) => r.seconds);
	if (rows.length !== 3) throw new Error(`Expected exactly 3 samples: ${mode}`);
	return {
		mode,
		runs: rows.length,
		medianSeconds: median(seconds),
		minSeconds: Math.min(...seconds),
		maxSeconds: Math.max(...seconds),
		metadataMedianSeconds: rows[0].dataPhases
			? median(rows.map((r) => r.dataPhases.metadataSeconds))
			: null,
		bodyAndNavigationMedianSeconds: rows[0].dataPhases
			? median(rows.map((r) => r.dataPhases.bodyAndNavigationSeconds))
			: null,
	};
});
await mkdir('experiments/ssg/results', { recursive: true });
await writeFile(
	'experiments/ssg/results/timings.json',
	JSON.stringify(
		{ startedAt, order, baselineFromPreviousRound: reference?.startedAt ?? null, summary, samples },
		null,
		2,
	) + '\n',
);
console.table(summary);
