import { spawnSync } from 'node:child_process';
import { cpus, platform, arch } from 'node:os';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { scopePrefix } from '../shared/scope.mjs';

const args = process.argv.slice(2);
if (
	args.length > 1 ||
	(args.length === 1 && !/^--runs=[1-9]\d?$/.test(args[0]))
)
	throw new Error('Usage: pnpm pilot:ox-native:measure [--runs=5] (1–99 runs)');
const runs = args.length ? Number(args[0].split('=')[1]) : 5;
const root = resolve(import.meta.dirname, '../../..');
const directory = resolve(root, `.pilot/${scopePrefix}ox-native-theme`);
mkdirSync(directory, { recursive: true });
const samples = [];
for (let run = 1; run <= runs; run++) {
	const started = performance.now();
	const child = spawnSync(
		process.execPath,
		[resolve(import.meta.dirname, 'build.mjs')],
		{
			cwd: root,
			env: process.env,
			encoding: 'utf8',
		},
	);
	const wallSeconds = (performance.now() - started) / 1000;
	writeFileSync(
		resolve(directory, `run-${run}.log`),
		child.stdout + child.stderr,
	);
	if (child.error || child.status !== 0)
		throw (
			child.error ??
			new Error(`Native SSG failed; see ${directory}/run-${run}.log`)
		);
	const sample = JSON.parse(
		readFileSync(resolve(directory, 'build.json'), 'utf8'),
	);
	samples.push({ run, ...sample, wallSeconds });
	console.log(JSON.stringify(samples.at(-1)));
}
const median = (values) => {
	const sorted = [...values].sort((a, b) => a - b);
	return (
		(sorted[Math.floor((sorted.length - 1) / 2)] +
			sorted[Math.floor(sorted.length / 2)]) /
		2
	);
};
const report = {
	timestamp: new Date().toISOString(),
	node: process.version,
	cpu: cpus()[0]?.model,
	platform: `${platform()}-${arch()}`,
	scope:
		'Raw Markdown and explicit route scaffolds, Ox default native theme; no Vue/MDC parity',
	samples,
	medianBuildSeconds: median(samples.map((sample) => sample.buildSeconds)),
	medianTotalSeconds: median(samples.map((sample) => sample.seconds)),
	medianWallSeconds: median(samples.map((sample) => sample.wallSeconds)),
};
const reportPath = resolve(directory, 'timings.json');
writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
console.log(
	JSON.stringify({ report: reportPath, ...report, samples: undefined }),
);
