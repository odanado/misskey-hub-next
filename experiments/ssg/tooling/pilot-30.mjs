import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile, readdir, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pages } from '../shared/pages.mjs';
import { expanded, fullSite, artifactPath, resultDirectory } from '../shared/scope.mjs';
if (!expanded || fullSite) throw new Error('Set HUB_PILOT_PAGES=30');
const action = process.argv[2] ?? 'verify',
	modes = ['baseline', 'ox-ported', 'astro', 'astro-ox'];
const expectedTests = pages.length * 4,
	expectedImages = expectedTests + 4 + pages.filter((page) => page.expandDetails).length * 4;
await mkdir(resultDirectory, { recursive: true });
async function run(command, args, env = {}) {
	const child = spawn(command, args, {
		stdio: 'inherit',
		env: { ...process.env, ...env, HUB_PILOT_PAGES: '30' },
	});
	const code = await new Promise((resolve, reject) => {
		child.once('error', reject);
		child.once('close', resolve);
	});
	if (code !== 0) throw new Error(`Failed: ${command} ${args.join(' ')}`);
}
async function hashes() {
	const dir = 'tests/vrt/snapshots/30';
	const files = (await readdir(dir, { recursive: true }))
		.filter((file) => /\.(png|json)$/.test(file))
		.sort();
	return Object.fromEntries(
		await Promise.all(
			files.map(async (file) => [
				file,
				createHash('sha256')
					.update(await readFile(dir + '/' + file))
					.digest('hex'),
			]),
		),
	);
}
async function fingerprint() {
	const files = [
		'package.json',
		'pnpm-lock.yaml',
		'nuxt.config.ts',
		'uno.config.ts',
		'i18n.config.ts',
		'app.vue',
		'playwright.config.ts',
		'tests/vrt/docs.spec.ts',
	];
	for (const dir of [
		'experiments/ssg',
		'experiments/ssg/nuxt-pilot',
		'components',
		'layouts',
		'pages',
		'assets/css',
		'assets/js',
		'assets/data',
		'locales',
		'composables',
	])
		for (const f of await readdir(dir, { recursive: true })) {
			if (
				/\.(mjs|ts|vue|astro|css|scss|json|yml)$/.test(f) &&
				!f.split('/').some((x) => x.startsWith('.')) &&
				!f.split('/').includes('results')
			)
				files.push(dir + '/' + f);
		}
	files.push(...pages.map((page) => 'content/' + page.source));
	const h = createHash('sha256');
	for (const file of [...new Set(files)].sort()) h.update(file).update(await readFile(file));
	return h.digest('hex');
}
async function freeze() {
	const snapshots = await hashes();
	if (Object.keys(snapshots).length !== expectedImages + expectedTests)
		throw new Error('Incomplete baseline snapshot set');
	await writeFile(
		resultDirectory + '/baseline.json',
		JSON.stringify(
			{ recordedAt: new Date().toISOString(), pages, expectedTests, expectedImages, snapshots },
			null,
			2,
		) + '\n',
	);
}
async function unchanged() {
	const base = JSON.parse(await readFile(resultDirectory + '/baseline.json', 'utf8'));
	if (JSON.stringify(base.snapshots) !== JSON.stringify(await hashes()))
		throw new Error('Frozen baseline snapshots changed');
}
async function build(mode, compiler) {
	await run(
		process.execPath,
		[
			mode === 'baseline'
				? 'experiments/ssg/nuxt-pilot/build.mjs'
				: 'experiments/ssg/tooling/build.mjs',
			mode,
		],
		{ HUB_VUE_COMPILER: compiler },
	);
}
if (action === 'baseline') {
	await build('baseline', 'vue');
	await run('pnpm', ['pilot:vrt', '--update-snapshots'], {
		HUB_CONTENT_PILOT: 'baseline',
		HUB_VUE_COMPILER: 'vue',
	});
	await freeze();
} else if (action === 'freeze') {
	await freeze();
} else if (action === 'build') {
	for (const mode of modes) for (const compiler of ['vue', 'vize']) await build(mode, compiler);
} else if (action === 'verify') {
	await unchanged();
	const summaries = [];
	const selected = process.argv.slice(3);
	for (const mode of modes)
		for (const compiler of ['vue', 'vize']) {
			const name = compiler === 'vize' ? mode + '-vize' : mode;
			if (selected.length && !selected.includes(name)) continue;
			const artifact = artifactPath(name);
			await rm(`.pilot/${artifact}/vrt/captures`, { recursive: true, force: true });
			console.log('[30 VRT] ' + name);
			await run('pnpm', ['pilot:vrt'], { HUB_CONTENT_PILOT: name });
			await run(process.execPath, ['experiments/ssg/tooling/vrt-summary.mjs', name]);
			const summary = JSON.parse(await readFile(`.pilot/${artifact}/vrt/summary.json`, 'utf8'));
			const count = (await readdir(`.pilot/${artifact}/vrt/captures`, { recursive: true })).filter(
				(f) => f.endsWith('.png'),
			).length;
			if (summary.passed !== expectedTests || summary.failed || count !== expectedImages)
				throw new Error('Incomplete exact VRT ' + name);
			summaries.push({ ...summary, compiler, exactImages: count });
			await unchanged();
		}
	const result = {
		recordedAt: new Date().toISOString(),
		pages: pages.length,
		testsPerMode: expectedTests,
		imagesPerMode: expectedImages,
		pixelPolicy: 'exact decoded RGBA; no masks or baseline changes',
		implementationFingerprint: await fingerprint(),
		summaries,
	};
	await writeFile(
		resultDirectory + (selected.length ? '/vrt-partial.json' : '/vrt.json'),
		JSON.stringify(result, null, 2) + '\n',
	);
} else if (action === 'measure') {
	await unchanged();
	const vrt = JSON.parse(await readFile(resultDirectory + '/vrt.json', 'utf8'));
	if (vrt.summaries.length !== 8) throw new Error('Complete VRT for all 8 modes first');
	const sourceHash = await fingerprint();
	if (vrt.implementationFingerprint !== sourceHash)
		throw new Error('Code changed after VRT; verify again before measuring');
	const startedAt = new Date().toISOString(),
		order = [];
	for (let round = 0; round < 3; round++) {
		const rotated = [...modes.slice(round), ...modes.slice(0, round)];
		for (const mode of rotated)
			for (const compiler of round % 2 ? ['vize', 'vue'] : ['vue', 'vize']) {
				console.log(`[30 measure] ${round + 1}/3 ${mode}/${compiler}`);
				order.push({ round: round + 1, mode, compiler });
				await build(mode, compiler);
			}
	}
	const history = [
		...JSON.parse(await readFile('.pilot/timings.json', 'utf8')),
		...JSON.parse(await readFile('.pilot/ported-timings.json', 'utf8')),
	];
	const samples = history.filter((s) => s.timestamp >= startedAt && s.pages.length === 30);
	const median = (values) => [...values].sort((a, b) => a - b)[1];
	const summary = modes.map((mode) => {
		const variants = Object.fromEntries(
			['vue', 'vize'].map((compiler) => {
				const rows = samples.filter((s) => s.mode === mode && s.compiler === compiler);
				if (rows.length !== 3) throw new Error('Expected 3 samples ' + mode + '/' + compiler);
				const seconds = rows.map((s) => s.seconds);
				return [
					compiler,
					{
						runs: 3,
						medianSeconds: median(seconds),
						minSeconds: Math.min(...seconds),
						maxSeconds: Math.max(...seconds),
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
	await unchanged();
	if ((await fingerprint()) !== sourceHash) throw new Error('Code changed during measurement');
	await writeFile(
		resultDirectory + '/timings.json',
		JSON.stringify(
			{
				startedAt,
				finishedAt: new Date().toISOString(),
				pages,
				implementationFingerprint: sourceHash,
				vrtRecordedAt: vrt.recordedAt,
				order,
				summary,
				samples,
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
} else throw new Error('Expected baseline, freeze, build, verify, or measure');
