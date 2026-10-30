import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { mkdir, readFile, writeFile, stat, readdir } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { cpus, platform, arch } from 'node:os';
import { createHash } from 'node:crypto';
import { pages } from '../shared/pages.mjs';
import { fullSite, resultDirectory } from '../shared/scope.mjs';
if (!fullSite) throw new Error('Set HUB_PILOT_PAGES=all');
const allModes = ['baseline', 'ox-ported', 'astro', 'astro-ox'];
const selectedModes = process.argv
	.find((arg) => arg.startsWith('--modes='))
	?.slice(8)
	.split(',');
if (selectedModes?.some((mode) => !allModes.includes(mode))) throw new Error('Invalid --modes');
const modes = selectedModes ?? allModes;
const vizeOnly = process.argv.includes('--vize-only');
const compilers = vizeOnly
	? ['vize']
	: process.argv.includes('--with-vize')
		? ['vue', 'vize']
		: ['vue'];
const resultFile = vizeOnly
	? selectedModes
		? 'vize-retry-timings.json'
		: 'vize-timings.json'
	: compilers.length === 2
		? 'compiler-timings.json'
		: 'timings.json';
const runs = Number(process.argv.find((a) => a.startsWith('--runs='))?.slice(7) ?? 1);
if (![1, 3].includes(runs)) throw new Error('Expected --runs=1 or --runs=3');
await mkdir(resultDirectory, { recursive: true });
const startedAt = new Date().toISOString(),
	results = [];
const files = [
	'package.json',
	'pnpm-lock.yaml',
	'nuxt.config.ts',
	'experiments/ssg/shared/full-pages.mjs',
	'experiments/ssg/shared/full-data.mjs',
	'experiments/ssg/nuxt-compat/FullSurface.vue',
	'experiments/ssg/nuxt-compat/FullMDC.vue',
	'experiments/ssg/nuxt-compat/PortApp.vue',
	'experiments/ssg/nuxt-compat/runtime.ts',
	'experiments/ssg/nuxt-compat/vite.mjs',
	'experiments/ssg/nuxt-compat/registry.ts',
	'experiments/ssg/shared/content/markdown.mjs',
	'experiments/ssg/shared/content/ox-native.mjs',
	'experiments/ssg/shared/content/ox-islands.mjs',
];
async function fingerprint() {
	const hash = createHash('sha256'),
		all = [...files];
	for (const dir of [
		'experiments/ssg',
		'experiments/ssg/nuxt-pilot',
		'components',
		'pages',
		'layouts',
		'content',
		'locales',
		'composables',
		'assets/css',
		'assets/js',
		'assets/data',
	])
		for (const file of await readdir(dir, { recursive: true }))
			if (
				(/\.(mjs|ts|vue|astro|css|scss|json|ya?ml)$/.test(file) ||
					(dir === 'content' && file.endsWith('.md'))) &&
				!file.split('/').includes('results') &&
				!file.split('/').some((x) => x.startsWith('.'))
			)
				all.push(dir + '/' + file);
	for (const file of [...new Set(all)].sort()) hash.update(file).update(await readFile(file));
	return hash.digest('hex');
}
const sourceHash = await fingerprint();
const referenceVue = vizeOnly
	? {
			path: resultDirectory + '/timings.json',
			sha256: createHash('sha256')
				.update(await readFile(resultDirectory + '/timings.json'))
				.digest('hex'),
		}
	: undefined;
const output = {
	startedAt,
	runs,
	compilers,
	referenceVue,
	expectedPublicPages: pages.length,
	categories: Object.fromEntries(
		[...new Set(pages.map((p) => p.kind))].map((kind) => [
			kind,
			pages.filter((p) => p.kind === kind).length,
		]),
	),
	node: process.version,
	platform: platform() + '-' + arch(),
	cpu: cpus()[0]?.model,
	implementationFingerprint: sourceHash,
	policy:
		'Sequential fresh builds; no VRT; all 1991 public HTML files required. Elapsed includes worker startup and route inventory. No blank fallback for failed SSR.',
	results,
};
async function save() {
	await writeFile(resultDirectory + '/' + resultFile, JSON.stringify(output, null, 2) + '\n');
}
for (let round = 0; round < runs; round++)
	for (const mode of modes)
		for (const compiler of round % 2 ? [...compilers].reverse() : compilers) {
			if ((await fingerprint()) !== sourceHash)
				throw new Error('Implementation changed during measurement');
			const name = mode + (compiler === 'vize' ? '-vize' : ''),
				artifact = 'full/' + name;
			console.log('[full-benchmark] ' + (round + 1) + '/' + runs + ' ' + name);
			const logPath =
					resultDirectory +
					'/' +
					name +
					(selectedModes ? '-retry' : '') +
					'-run-' +
					(round + 1) +
					'.log',
				log = createWriteStream(logPath),
				start = performance.now(),
				timestamp = new Date().toISOString();
			const child = spawn(
				process.execPath,
				[
					mode === 'baseline'
						? 'experiments/ssg/nuxt-pilot/build.mjs'
						: 'experiments/ssg/tooling/build.mjs',
					mode,
				],
				{
					env: {
						...process.env,
						HUB_PILOT_PAGES: 'all',
						HUB_VUE_COMPILER: compiler,
						NODE_ENV: 'production',
					},
					stdio: ['ignore', 'pipe', 'pipe'],
				},
			);
			child.stdout.pipe(log, { end: false });
			child.stderr.pipe(log, { end: false });
			const exitCode = await new Promise((resolve, reject) => {
				child.once('error', reject);
				child.once('close', resolve);
			});
			await new Promise((resolve) => log.end(resolve));
			const elapsedSeconds = (performance.now() - start) / 1000,
				missing = [],
				empty = [];
			for (const page of pages) {
				try {
					const file = '.pilot/' + artifact + '/public' + page.path + 'index.html';
					const info = await stat(file);
					if (info.size < 32) empty.push(page.path);
				} catch {
					missing.push(page.path);
				}
			}
			const buildLog = await readFile('.pilot/' + artifact + '/build.log', 'utf8').catch(() => ''),
				workerLog = await readFile(logPath, 'utf8');
			const history = [
				...JSON.parse(await readFile('.pilot/timings.json', 'utf8').catch(() => '[]')),
				...JSON.parse(await readFile('.pilot/ported-timings.json', 'utf8').catch(() => '[]')),
			];
			const sample = history.findLast((s) => s.artifact === artifact && s.timestamp >= timestamp);
			const runtimeErrors = (
				buildLog.match(/(?:ReferenceError|TypeError|RangeError|SyntaxError|URIError):/g) ?? []
			).length;
			const compilerConfirmed = compiler !== 'vize' || buildLog.includes('[pilot-compiler] vize:');
			const row = {
				round: round + 1,
				mode,
				compiler,
				artifact,
				timestamp,
				exitCode,
				status:
					exitCode === 0 && !missing.length && !empty.length && !runtimeErrors && compilerConfirmed
						? 'success'
						: 'failed',
				elapsedSeconds,
				completedPublicPages: pages.length - missing.length - empty.length,
				missing,
				empty,
				buildLog: '.pilot/' + artifact + '/build.log',
				logPath,
				compatWarnings: (buildLog.match(/\[full-compat\]/g) ?? []).length,
				unresolvedComponents: (buildLog.match(/Failed to resolve component/g) ?? []).length,
				runtimeErrors,
				compilerConfirmed,
				cssModuleRepairs: (buildLog.match(/\[full-vize-compat\]/g) ?? []).length,
				unhandledErrors: (buildLog.match(/Unhandled error/g) ?? []).length,
				sample,
				error: exitCode ? workerLog.slice(-3500) : undefined,
			};
			results.push(row);
			await save();
			console.log(
				'[full-result] ' +
					JSON.stringify({
						mode,
						compiler,
						status: row.status,
						seconds: elapsedSeconds,
						pages: row.completedPublicPages,
						exitCode,
					}),
			);
		}
if (
	referenceVue &&
	referenceVue.sha256 !==
		createHash('sha256')
			.update(await readFile(referenceVue.path))
			.digest('hex')
)
	throw new Error('Saved Vue reference changed');
output.finishedAt = new Date().toISOString();
output.sourceUnchanged = (await fingerprint()) === sourceHash;
await save();
console.table(
	results.map((r) => ({
		mode: r.mode,
		compiler: r.compiler,
		status: r.status,
		seconds: r.elapsedSeconds,
		pages: r.completedPublicPages,
	})),
);
