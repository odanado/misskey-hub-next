import { spawn } from 'node:child_process';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
const modes = ['baseline', 'ox-ported', 'astro', 'astro-ox'];
const startedAt = new Date().toISOString();
const nuxtOnly = process.argv.includes('--nuxt-only');
const reference = nuxtOnly
	? JSON.parse(await readFile('experiments/ssg/results/compiler-timings.json', 'utf8'))
	: null;
const measuredModes = nuxtOnly ? ['baseline'] : modes;
const order = [];
async function run(mode, compiler) {
	const script =
		mode === 'baseline'
			? 'experiments/ssg/nuxt-pilot/build.mjs'
			: 'experiments/ssg/tooling/build.mjs';
	const child = spawn(process.execPath, [script, mode], {
		stdio: 'inherit',
		env: { ...process.env, NODE_ENV: 'production', HUB_VUE_COMPILER: compiler },
	});
	const code = await new Promise((resolve, reject) => {
		child.once('error', reject);
		child.once('close', resolve);
	});
	if (code !== 0) throw new Error(`Build failed: ${mode}/${compiler}`);
}
// Alternate order of each compiler pair and rotate framework order. No build
// runs concurrently with another build or VRT. Each worker starts fresh.
for (let round = 0; round < 3; round++) {
	const rotated = [...measuredModes.slice(round), ...measuredModes.slice(0, round)];
	for (const mode of rotated)
		for (const compiler of round % 2 ? ['vize', 'vue'] : ['vue', 'vize']) {
			order.push({ round: round + 1, mode, compiler });
			console.log(`[compiler-benchmark] ${round + 1}/3 ${mode} ${compiler}`);
			await run(mode, compiler);
		}
}
const history = [
	...JSON.parse(await readFile('.pilot/timings.json', 'utf8')),
	...JSON.parse(await readFile('.pilot/ported-timings.json', 'utf8')),
];
const samples = history.filter(
	(s) => s.timestamp >= startedAt && modes.includes(s.mode) && ['vue', 'vize'].includes(s.compiler),
);
if (reference) samples.push(...reference.samples.filter((s) => s.mode !== 'baseline'));
const median = (values) => [...values].sort((a, b) => a - b)[1];
const summary = modes.map((mode) => {
	const variants = Object.fromEntries(
		['vue', 'vize'].map((compiler) => {
			const rows = samples.filter((s) => s.mode === mode && s.compiler === compiler);
			if (rows.length !== 3)
				throw new Error(`Expected 3 ${mode}/${compiler} samples; got ${rows.length}`);
			return [
				compiler,
				{
					runs: 3,
					medianSeconds: median(rows.map((s) => s.seconds)),
					minSeconds: Math.min(...rows.map((s) => s.seconds)),
					maxSeconds: Math.max(...rows.map((s) => s.seconds)),
				},
			];
		}),
	);
	return {
		mode,
		...variants,
		changePercent: (variants.vize.medianSeconds / variants.vue.medianSeconds - 1) * 100,
	};
});
await mkdir('experiments/ssg/results', { recursive: true });
await writeFile(
	'experiments/ssg/results/compiler-timings.json',
	JSON.stringify(
		{
			startedAt: reference?.startedAt ?? startedAt,
			nuxtRemeasuredAt: reference ? startedAt : null,
			preservedPortsFrom: reference?.startedAt ?? null,
			finishedAt: new Date().toISOString(),
			vizeVersion: '0.607.0',
			scope:
				'same four pilot pages and full SSG worker time as previous experiment; both compiler variants remeasured',
			order: reference
				? [...reference.order.filter((s) => s.mode !== 'baseline'), ...order]
				: order,
			summary,
			samples: samples.sort((a, b) => a.timestamp.localeCompare(b.timestamp)),
		},
		null,
		2,
	) + '\n',
);
console.table(
	summary.map((s) => ({
		mode: s.mode,
		vue: s.vue.medianSeconds,
		vize: s.vize.medianSeconds,
		changePercent: s.changePercent,
	})),
);
