import { readFile, writeFile, readdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { platform, release, arch } from 'node:os';
import { pages } from '../shared/pages.mjs';

const variants = [];
for (const mode of ['baseline', 'query', 'native', 'standalone']) {
	const summary = JSON.parse(await readFile(`.pilot/${mode}/vrt/summary.json`, 'utf8'));
	let captures = [];
	try {
		captures = await readdir(`.pilot/${mode}/vrt/captures`, { recursive: true });
	} catch {}
	variants.push({
		mode,
		passed: summary.passed,
		failed: summary.failed,
		exactRgbaCaptures: captures.filter((file) => file.endsWith('.png')).length,
		screenshotFailures: summary.tests.reduce((n, test) => n + test.screenshots.length, 0),
	});
}
if (
	variants.slice(0, 3).some((v) => v.passed !== 16 || v.failed !== 0 || v.exactRgbaCaptures !== 20)
) {
	throw new Error('Record results only after all Nuxt variants pass the final VRT');
}
const record = {
	recordedAt: new Date().toISOString(),
	referenceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
	platform: `${platform()} ${release()} ${arch()}`,
	node: process.version,
	versions: Object.fromEntries(
		await Promise.all(
			[
				'nuxt',
				'@nuxt/content',
				'@ox-content/napi',
				'@ox-content/vite-plugin',
				'@playwright/test',
			].map(async (name) => [
				name,
				JSON.parse(await readFile(`node_modules/${name}/package.json`, 'utf8')).version,
			]),
		),
	),
	externalNetwork: 'blocked identically for all variants',
	pages,
	variants,
};
await writeFile(
	'experiments/ssg/nuxt-pilot/results/vrt.json',
	JSON.stringify(record, null, 2) + '\n',
);
console.table(variants);
