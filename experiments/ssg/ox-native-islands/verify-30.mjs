import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { readFile, writeFile, readdir, mkdir, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fingerprint, baselineHashes } from '../ox-native/evidence.mjs';
if (process.env.HUB_PILOT_PAGES !== '30') throw new Error('Use HUB_PILOT_PAGES=30');
const mode = 'ox-native-islands';
const output = 'experiments/ssg/results/ox-native-islands/2026-10-31';
const artifact = '.pilot/30/' + mode;
await mkdir(output, { recursive: true });
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const source = () => fingerprint(['experiments/ssg/ox-native-islands']);
const sourceBefore = await source(), baselineBefore = await baselineHashes();
const frozen = JSON.parse(await readFile('experiments/ssg/results/30/baseline.json', 'utf8'));
if (JSON.stringify(baselineBefore) !== JSON.stringify(frozen.snapshots)) throw new Error('Original baseline changed');
const startedAt = new Date().toISOString();
async function run(args, logFile) {
	const stream = createWriteStream(output + '/' + logFile);
	const child = spawn('pnpm', args, { env: { ...process.env, HUB_CONTENT_PILOT: mode, HUB_VUE_COMPILER: 'vue' }, stdio: ['ignore', 'pipe', 'pipe'] });
	child.stdout.pipe(stream, { end: false }); child.stderr.pipe(stream, { end: false });
	const code = await new Promise((ok, fail) => { child.once('error', fail); child.once('close', ok); });
	await new Promise((ok) => stream.end(ok));
	if (code !== 0) throw new Error(args.join(' ') + ' failed: ' + output + '/' + logFile);
}
await run(['pilot:ox-islands:check'], 'typecheck.log');
await run(['pilot:ox-islands:build'], 'build.log');
await run(['pilot:ox-islands:verify'], 'verify.log');
await rm(artifact + '/vrt/captures', { recursive: true, force: true });
await run(['pilot:vrt'], 'vrt.log');
const raw = await readFile(artifact + '/vrt/results.json'), report = JSON.parse(raw);
if (report.stats.expected !== 120 || report.stats.unexpected || report.stats.skipped || report.stats.flaky) throw new Error('Require 120 tests without retries or skips');
const images = (await readdir(artifact + '/vrt/captures', { recursive: true })).filter((p) => p.endsWith('.png')).sort();
if (images.length !== 144) throw new Error('Require all 144 actual screenshots');
const imageHashes = {};
for (const file of images) imageHashes[file] = hash(await readFile(artifact + '/vrt/captures/' + file));
if ((await source()) !== sourceBefore) throw new Error('Build sources changed during VRT');
if (JSON.stringify(await baselineHashes()) !== JSON.stringify(baselineBefore)) throw new Error('Frozen baseline changed');
const manifestBytes = await readFile(artifact + '/public/.vite/manifest.json'), manifest = JSON.parse(manifestBytes);
if (Object.keys(manifest).some((key) => key.endsWith('.md'))) throw new Error('Markdown modules must not enter client build');
const js = Object.values(manifest).filter((entry) => entry.file.endsWith('.js'));
const jsBytes = (await Promise.all(js.map((entry) => readFile(artifact + '/public/' + entry.file)))).reduce((total, bytes) => total + bytes.length, 0);
const result = {
	startedAt, finishedAt: new Date().toISOString(), mode, referenceCommit: 'c52b733c227aaf5f91341544aebe4c3977800cee',
	sourceFingerprint: sourceBefore, sourceUnchanged: true, pages: 30, tests: 120, exactRgbaImages: 144,
	stats: report.stats, baselineUnchanged: true, baselineHashes: baselineBefore, actualImageHashes: imageHashes,
	playwrightReportSha256: hash(raw), clientManifestSha256: hash(manifestBytes),
	client: { jsFiles: js.length, jsBytes, markdownModuleEntries: 0 },
	policy: 'Original docs.spec.ts, Nuxt 30-page baseline, desktop/mobile x light/dark, exact RGBA/dimensions and semantic snapshots, navigation/theme reload/menu/details, no masks/tolerance/snapshot changes/retries/skips.',
};
await writeFile(output + '/vrt-30.json', JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ ...result, baselineHashes: '264 hashes saved', actualImageHashes: '144 hashes saved' }, null, 2));
