import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { readFile, writeFile, mkdir, readdir, rm } from 'node:fs/promises';
import { fingerprint, baselineHashes, resultsDirectory } from './evidence.mjs';
if (process.env.HUB_PILOT_PAGES !== '30') throw new Error('Use HUB_PILOT_PAGES=30');
await mkdir(resultsDirectory, { recursive: true });
const source = await fingerprint(),
	baseline = await baselineHashes(),
	startedAt = new Date().toISOString();
const run = async (command, args, logFile) => {
	const log = createWriteStream(logFile);
	const child = spawn(command, args, {
		env: { ...process.env, HUB_CONTENT_PILOT: 'ox-native', HUB_VUE_COMPILER: 'vue' },
		stdio: ['ignore', 'pipe', 'pipe'],
	});
	child.stdout.pipe(log, { end: false });
	child.stderr.pipe(log, { end: false });
	const code = await new Promise((resolve, reject) => {
		child.once('error', reject);
		child.once('close', resolve);
	});
	await new Promise((resolve) => log.end(resolve));
	if (code !== 0) throw new Error('Command failed; see ' + logFile);
};
await run(
	process.execPath,
	['experiments/ssg/tooling/build.mjs', 'ox-native'],
	resultsDirectory + '/build-30.log',
);
await rm('.pilot/30/ox-native/vrt/captures', { recursive: true, force: true });
await run('pnpm', ['pilot:vrt'], resultsDirectory + '/vrt-30.log');
const rawFile = '.pilot/30/ox-native/vrt/results.json',
	raw = await readFile(rawFile),
	result = JSON.parse(raw);
if (
	result.stats.expected !== 120 ||
	result.stats.unexpected ||
	result.stats.skipped ||
	result.stats.flaky
)
	throw new Error('Require all 120 VRT tests, no retry/skips');
const captures = (await readdir('.pilot/30/ox-native/vrt/captures', { recursive: true })).filter(
	(file) => file.endsWith('.png'),
);
if (captures.length !== 144) throw new Error('Expected 144 actual images');
const after = await baselineHashes();
if (JSON.stringify(after) !== JSON.stringify(baseline))
	throw new Error('Original VRT references changed');
if ((await fingerprint()) !== source) throw new Error('Source changed during final VRT');
const summary = {
	mode: 'ox-native',
	startedAt,
	finishedAt: new Date().toISOString(),
	sourceFingerprint: source,
	conditions: ['desktop-light', 'mobile-light', 'desktop-dark', 'mobile-dark'],
	pages: 30,
	tests: 120,
	exactRgbaImages: 144,
	stats: result.stats,
	baselineUnchanged: true,
	baselineHashes: baseline,
	playwrightReportSha256: createHash('sha256').update(raw).digest('hex'),
	policy:
		'Existing Nuxt baseline; exact RGBA/dimensions and semantics; no masks/tolerance/snapshot updates/retries; SSG HTML, client errors, navigation and theme persistence checked.',
};
await writeFile(resultsDirectory + '/vrt-30.json', JSON.stringify(summary, null, 2) + '\n');
console.log(
	JSON.stringify({ ...summary, baselineHashes: '144 PNG + 120 semantic hashes saved' }, null, 2),
);
