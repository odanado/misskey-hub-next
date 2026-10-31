import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
export const resultsDirectory = 'experiments/ssg/results/ox-native/2026-10-30';
export async function fingerprint(extraDirectories = []) {
	const paths = [
		'package.json',
		'pnpm-lock.yaml',
		'nuxt.config.ts',
		'app.vue',
		'app.config.ts',
		'uno.config.ts',
		'i18n/i18n.config.ts',
		'experiments/ssg/tooling/build.mjs',
		'experiments/ssg/tooling/serve.mjs',
		'experiments/ssg/tooling/full-benchmark.mjs',
		'playwright.config.ts',
		'tests/vrt/docs.spec.ts',
		'experiments/ssg/results/public-url-count.json',
	];
	for (const directory of [
		'experiments/ssg/ox-native',
		'experiments/ssg/nuxt-compat',
		'experiments/ssg/shared',
		'content',
		'components',
		'layouts',
		'pages',
		'composables',
		'locales',
		'assets/css',
		'assets/js',
		'assets/data',
		...extraDirectories,
	]) {
		for (const file of await readdir(directory, { recursive: true }))
			if (
				!file.split('/').some((part) => part.startsWith('.')) &&
				(/\.(?:[cm]?[jt]s|vue|css|scss|json|ya?ml)$/.test(file) ||
					(directory === 'content' && file.endsWith('.md')))
			)
				paths.push(directory + '/' + file);
	}
	const hash = createHash('sha256');
	for (const path of [...new Set(paths)].sort()) hash.update(path).update(await readFile(path));
	return hash.digest('hex');
}
export async function baselineHashes() {
	const directory = 'tests/vrt/snapshots/30',
		hashes = {};
	for (const file of (await readdir(directory, { recursive: true }))
		.filter((file) => /\.(png|json)$/.test(file))
		.sort())
		hashes[file] = createHash('sha256')
			.update(await readFile(directory + '/' + file))
			.digest('hex');
	if (Object.keys(hashes).length !== 264)
		throw new Error('Expected 144 images + 120 semantic baseline files');
	return hashes;
}
