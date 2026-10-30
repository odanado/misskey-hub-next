import { createServer } from 'node:http';
import { readFile, writeFile, appendFile, mkdir, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { chromium } from '@playwright/test';
import { fullPages } from '../shared/full-pages.mjs';
import { capturePage, comparePixels, createFixtureContext } from './full-vrt-capture.mjs';

const option = (name, fallback) =>
	process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const sample = option('sample', 'all');
const outputDirectory = option('output-dir', 'experiments/ssg/results/full/2026-10-30');
const artifacts = sample === '30' ? '30' : 'full';
const workers = Number(option('workers', '6'));
if (![1, 2, 4, 6, 8].includes(workers)) throw new Error('Use 1, 2, 4, 6, or 8 workers');
const modes = [
	'baseline',
	'baseline-vize',
	'ox-ported',
	'ox-ported-vize',
	'astro',
	'astro-vize',
	'astro-ox',
	'astro-ox-vize',
];
let pages =
	sample === '30'
		? JSON.parse(await readFile('experiments/ssg/results/30/baseline.json', 'utf8')).pages.map(
				(page) => ({ ...page, kind: 'docs' }),
			)
		: await fullPages();
const only = option('only', '').split(',').filter(Boolean);
if (only.length) pages = pages.filter((page) => only.includes(page.path));
const limit = Number(option('limit', String(pages.length)));
pages = pages.slice(0, limit);
await mkdir(outputDirectory, { recursive: true });
const rowFile = resolve(outputDirectory, 'vrt-rows.jsonl');
const summaryFile = resolve(outputDirectory, 'vrt.json');
const manifestFile = resolve(outputDirectory, 'vrt-run.json');
const startedAt = new Date().toISOString();
const benchmarkFile = resolve(outputDirectory, 'compiler-timings.json');
const benchmark = sample === 'all' ? JSON.parse(await readFile(benchmarkFile, 'utf8')) : null;
if (
	benchmark &&
	(!benchmark.finishedAt || !benchmark.sourceUnchanged || benchmark.results.length !== 8)
)
	throw new Error('Finish the current eight-mode benchmark before running full-site VRT');
const scriptHash = createHash('sha256')
	.update(await readFile(new URL(import.meta.url)))
	.update(await readFile(new URL('./full-vrt-capture.mjs', import.meta.url)))
	.digest('hex');
const manifest = {
	startedAt,
	sample,
	pages: pages.map((page) => page.path),
	modes,
	workers,
	scriptHash,
	buildFingerprint: benchmark?.implementationFingerprint,
	benchmarkFile: benchmark ? benchmarkFile : undefined,
	benchmarkSha256: benchmark
		? createHash('sha256')
				.update(await readFile(benchmarkFile))
				.digest('hex')
		: undefined,
	viewport: { width: 1440, height: 900 },
	colorScheme: 'light',
	locale: 'ja-JP',
	timezone: 'Asia/Tokyo',
	policy:
		'Exact decoded RGBA and dimensions, stable consecutive frames, no masks/tolerance. Offline external network; empty emoji cache; seeded client randomness; frozen MFM/static clocks; motion disabled after layout settles.',
};
const rows = [];
if (process.argv.includes('--resume')) {
	const previous = JSON.parse(await readFile(manifestFile, 'utf8'));
	if (
		previous.scriptHash !== scriptHash ||
		previous.benchmarkSha256 !== manifest.benchmarkSha256 ||
		JSON.stringify(previous.pages) !== JSON.stringify(manifest.pages)
	)
		throw new Error('Cannot resume with changed capture code or URL scope');
	manifest.startedAt = previous.startedAt;
	rows.push(
		...(await readFile(rowFile, 'utf8'))
			.split('\n')
			.filter(Boolean)
			.map((line) => JSON.parse(line)),
	);
} else {
	await writeFile(rowFile, '');
	await writeFile(manifestFile, JSON.stringify(manifest, null, 2) + '\n');
}
const completed = new Set(rows.map((row) => row.path));
const remaining = pages.filter((page) => !completed.has(page.path));
const mime = {
	'.html': 'text/html; charset=utf-8',
	'.js': 'text/javascript',
	'.mjs': 'text/javascript',
	'.css': 'text/css',
	'.json': 'application/json',
	'.svg': 'image/svg+xml',
	'.png': 'image/png',
	'.webp': 'image/webp',
	'.jpg': 'image/jpeg',
	'.woff2': 'font/woff2',
	'.woff': 'font/woff',
	'.ico': 'image/x-icon',
	'.wasm': 'application/wasm',
	'.gif': 'image/gif',
	'.avif': 'image/avif',
	'.mp4': 'video/mp4',
};
const servers = [],
	origins = {};
let browser;
let cursor = 0;
const sampleCounts = {},
	maxSamplesPerMode = 2;
let summaryWrite = Promise.resolve();
async function saveSummary(finished = false) {
	const summary = modes.map((mode) => {
		const counts = {};
		for (const row of rows) {
			const status = row.results[mode].status;
			counts[status] = (counts[status] ?? 0) + 1;
		}
		const passed = counts.passed ?? 0;
		const unavailable = counts['reference-unavailable'] ?? 0;
		return {
			mode,
			total: pages.length,
			processed: rows.length,
			passed,
			passRatePercent: (passed / pages.length) * 100,
			comparable: pages.length - unavailable,
			comparablePassRatePercent:
				pages.length === unavailable ? null : (passed / (pages.length - unavailable)) * 100,
			counts,
		};
	});
	const contents =
		JSON.stringify(
			{
				...manifest,
				pages: pages.length,
				updatedAt: new Date().toISOString(),
				finished,
				processed: rows.length,
				referenceUnavailable: rows.filter((row) => row.reference.status !== 'captured').length,
				summary,
			},
			null,
			2,
		) + '\n';
	summaryWrite = summaryWrite.then(() => writeFile(summaryFile, contents));
	await summaryWrite;
}
async function saveSamples(mode, entry, reference, candidate) {
	if ((sampleCounts[mode] ?? 0) >= maxSamplesPerMode || !reference.bytes || !candidate.bytes)
		return;
	sampleCounts[mode] = (sampleCounts[mode] ?? 0) + 1;
	const dir = resolve(
		'.pilot/full-vrt/samples',
		mode,
		createHash('sha256').update(entry.path).digest('hex').slice(0, 12),
	);
	await mkdir(dir, { recursive: true });
	await writeFile(dir + '/baseline.png', reference.bytes);
	await writeFile(dir + '/candidate.png', candidate.bytes);
	return dir;
}
try {
	for (const mode of modes) {
		const root = resolve(`.pilot/${artifacts}/${mode}/public`);
		await stat(root);
		const server = createServer(async (req, res) => {
			try {
				let file = resolve(
					root,
					'.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname),
				);
				if (file !== root && !file.startsWith(root + sep)) throw new Error('Invalid path');
				if ((await stat(file)).isDirectory()) file = resolve(file, 'index.html');
				const bytes = await readFile(file);
				res.writeHead(200, {
					'Content-Type': mime[extname(file)] ?? 'application/octet-stream',
					'Cache-Control': extname(file) === '.html' ? 'no-cache' : 'public,max-age=3600',
				});
				res.end(bytes);
			} catch {
				res.writeHead(404);
				res.end('Not found');
			}
		});
		await new Promise((accept) => server.listen(0, '127.0.0.1', accept));
		servers.push(server);
		origins[mode] = `http://127.0.0.1:${server.address().port}`;
	}
	browser = await chromium.launch();
	console.log(
		`[full-vrt] ${pages.length} URLs, ${modes.length} modes, ${workers} workers; ${remaining.length} URLs remaining`,
	);
	await Promise.all(
		Array.from({ length: workers }, async (_, worker) => {
			const contexts = Object.fromEntries(
				await Promise.all(modes.map(async (mode) => [mode, await createFixtureContext(browser)])),
			);
			try {
				while (cursor < remaining.length) {
					const entry = remaining[cursor++];
					const capture = async (mode) => {
						const page = await contexts[mode].newPage();
						try {
							return await capturePage(page, origins[mode] + entry.path);
						} finally {
							await page.close();
						}
					};
					const reference = await capture('baseline');
					const results = {
						baseline: {
							status: reference.status === 'captured' ? 'passed' : 'reference-unavailable',
							errors: reference.errors,
						},
					};
					for (const mode of modes.slice(1)) {
						if (reference.status !== 'captured') {
							results[mode] = { status: 'reference-unavailable' };
							continue;
						}
						const candidate = await capture(mode);
						if (candidate.status !== 'captured') {
							results[mode] = { status: candidate.status, errors: candidate.errors };
							continue;
						}
						const pixels = comparePixels(reference.png, candidate.png);
						results[mode] = {
							status: pixels.equal ? 'passed' : 'different',
							...pixels,
							finalPath: candidate.finalPath,
						};
						if (!pixels.equal)
							results[mode].sampleDirectory = await saveSamples(mode, entry, reference, candidate);
					}
					const row = {
						path: entry.path,
						kind: entry.kind,
						reference: {
							status: reference.status,
							errors: reference.errors,
							finalPath: reference.finalPath,
						},
						results,
					};
					rows.push(row);
					await appendFile(rowFile, JSON.stringify(row) + '\n');
					if (rows.length % 10 === 0 || rows.length === pages.length) {
						await saveSummary();
						console.log(
							`[full-vrt] ${rows.length}/${pages.length} URLs complete; baseline unavailable ${rows.filter((row) => row.reference.status !== 'captured').length}; worker ${worker}`,
						);
					}
				}
			} finally {
				await Promise.all(Object.values(contexts).map((context) => context.close()));
			}
		}),
	);
	await saveSummary(true);
	console.table(
		JSON.parse(await readFile(summaryFile, 'utf8')).summary.map(
			({ mode, passed, total, passRatePercent, counts }) => ({
				mode,
				passed,
				total,
				percent: passRatePercent.toFixed(2),
				counts: JSON.stringify(counts),
			}),
		),
	);
} finally {
	await browser?.close();
	await Promise.all(servers.map((server) => new Promise((accept) => server.close(accept))));
}
