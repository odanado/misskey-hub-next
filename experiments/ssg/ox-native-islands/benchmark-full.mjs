// Run only after the current 30-page source passes the unmodified VRT gate.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { cpus, platform, arch } from 'node:os';
import { fingerprint } from '../ox-native/evidence.mjs';
const output = 'experiments/ssg/results/ox-native-islands/2026-10-31';
const evidence = await readFile(output + '/vrt-30.json');
const vrt = JSON.parse(evidence);
const source = () => fingerprint(['experiments/ssg/ox-native-islands']);
const sha = (data) => createHash('sha256').update(data).digest('hex');
assert.equal(vrt.tests, 120); assert.equal(vrt.exactRgbaImages, 144);
assert.equal(vrt.sourceFingerprint, await source());
const env = { ...process.env, HUB_PILOT_PAGES: 'all', NODE_ENV: 'production', HUB_CONTENT_PILOT: 'ox-native-islands', HUB_VUE_COMPILER: 'vue' };
delete env.HUB_SSG_PROFILE; delete env.HUB_SSG_CPU_PROFILE;
async function run(args, file) {
	const log = createWriteStream(file);
	const start = performance.now();
	const child = spawn(args[0], args.slice(1), { env, stdio: ['ignore', 'pipe', 'pipe'] });
	child.stdout.pipe(log, { end: false }); child.stderr.pipe(log, { end: false });
	const exitCode = await new Promise((ok, fail) => { child.once('error', fail); child.once('close', ok); });
	const seconds = (performance.now() - start) / 1000;
	await new Promise((ok) => log.end(ok));
	assert.equal(exitCode, 0, file);
	return { seconds, exitCode, logSha256: sha(await readFile(file)) };
}
const result = {
	startedAt: new Date().toISOString(), scope: 'All 1991 public URLs, including Markdown, YAML, fixed pages and language entry HTML',
	policy: 'Three sequential fresh processes; PNPM/Node startup, Vite client build, Ox Custom Host preparation/render/output and full public asset copy included. HTML/asset verifier outside timer. OS caches retained; no concurrent VRT; live contributor API fetched once per process; default heap limit. Visual parity only verified in the separate 30-page scope.',
	node: process.version, cpu: cpus()[0].model, platform: platform() + '-' + arch(),
	sourceFingerprint: vrt.sourceFingerprint, vrtSha256: sha(evidence), runs: [],
};
for (let index = 1; index <= 3; index++) {
	assert.equal(await source(), vrt.sourceFingerprint);
	const logFile = output + '/full-build-' + index + '.log';
	const sample = await run(['/usr/bin/time', '-l', 'pnpm', 'pilot:ox-islands:build'], logFile);
	const log = await readFile(logFile, 'utf8');
	assert.match(log, /Custom host generated 1991 output files/);
	assert.doesNotMatch(log, /(?:AggregateError|ReferenceError|TypeError|RangeError|SyntaxError|Unhandled error):/);
	const verifyFile = output + '/full-verify-' + index + '.log';
	await run(['pnpm', 'pilot:ox-islands:verify'], verifyFile);
	const verification = JSON.parse((await readFile(verifyFile, 'utf8')).trim().split('\n').at(-1));
	assert.equal(verification.renderedPages, 1991);
	const publicDir = '.pilot/full/ox-native-islands/public/';
	const manifestBytes = await readFile(publicDir + '.vite/manifest.json');
	const manifest = JSON.parse(manifestBytes);
	assert.ok(!Object.keys(manifest).some((file) => file.endsWith('.md')));
	const js = Object.values(manifest).filter((entry) => entry.file.endsWith('.js'));
	const jsBytes = (await Promise.all(js.map((entry) => readFile(publicDir + entry.file)))).reduce((total, data) => total + data.length, 0);
	const compatibility = [...log.matchAll(/^\[ox-islands-compat\] (.+)$/gm)].map((match) => JSON.parse(match[1]));
	const row = { run: index, ...sample, peakRssBytes: Number(/^\s*(\d+)\s+maximum resident set size\s*$/m.exec(log)?.[1]), verification,
		client: { jsFiles: js.length, jsBytes, markdownModuleEntries: 0, manifestSha256: sha(manifestBytes) }, compatibility };
	result.runs.push(row);
	assert.equal(await source(), vrt.sourceFingerprint);
	await writeFile(output + '/timings-full.json', JSON.stringify(result, null, 2) + '\n');
	console.log(JSON.stringify({ run: index, seconds: row.seconds, verification, jsBytes, compatibilityUrls: compatibility.length }));
}
result.finishedAt = new Date().toISOString();
result.sourceUnchanged = true;
result.medianSeconds = result.runs.map((row) => row.seconds).sort((a, b) => a - b)[1];
await writeFile(output + '/timings-full.json', JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ medianSeconds: result.medianSeconds }));
