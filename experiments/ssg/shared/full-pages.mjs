// Public-route inventory is produced by count-public-urls.mjs from Nuxt routes.
// Excludes API/assets and wildcard redirects, includes language entry HTML.
import { readFile, readdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import yaml from 'js-yaml';
const require = createRequire(import.meta.url);
const { default: pathMeta } = await import(
	resolve(dirname(require.resolve('@nuxt/content')), 'runtime/transformers/path-meta.js')
);
export async function fullPages() {
	const inventory = JSON.parse(
		await readFile('experiments/ssg/results/public-url-count.json', 'utf8'),
	);
	const sources = new Map(),
		directories = new Map();
	for (const source of (await readdir('content', { recursive: true })).filter(
		(f) => /\.(md|ya?ml)$/.test(f) && !f.split('/').some((x) => x.startsWith('.')),
	)) {
		const raw = await readFile('content/' + source, 'utf8'),
			match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(raw);
		const fields = source.endsWith('.md')
			? match
				? (yaml.load(match[1]) ?? {})
				: {}
			: (yaml.load(raw) ?? {});
		const item = pathMeta.transform(
			{ ...fields, _id: 'content:' + source.replaceAll('/', ':') },
			{ defaultLocale: '' },
		);
		if (item._partial && item._path.endsWith('/_dir'))
			directories.set(item._path.slice(0, -5), source);
		else if (!item._partial && !item._draft) sources.set(item._path, source);
	}
	const pageFiles = (await readdir('pages', { recursive: true })).filter((f) => f.endsWith('.vue'));
	const pages = [];
	for (const [kind, urls] of Object.entries(inventory.urls))
		for (const path of urls) {
			const language = /^\/(ja-ks|ja|en|id|ko|it|pl|fr|th|es|de|cn|tw)(?:\/|$)/.exec(path)?.[1];
			const unprefixed = language ? path.slice(language.length + 1) : path;
			let source, pageFile;
			if (kind === 'docs') {
				const key = path.replace(/^\/ja-ks\//, '/ja/').replace(/\/$/, '');
				source = sources.get(key) ?? directories.get(key);
				pageFile = 'docs/[...slug].vue';
			} else if (kind === 'blog') {
				source = sources.get(unprefixed.replace(/\/$/, ''));
				pageFile = 'blog/[slug].vue';
			} else {
				let file = unprefixed.replace(/^\/|\/$/g, '');
				const candidates = [
					file + '.vue',
					file + '.client.vue',
					file + '/index.vue',
					file === '' ? 'index.vue' : '',
				];
				pageFile = candidates.find((f) => pageFiles.includes(f));
				if (path === '/ns/') source = sources.get('/ns');
			}
			if (kind !== 'languageEntry' && !pageFile) throw new Error('Unmapped public page ' + path);
			if ((kind === 'docs' || kind === 'blog') && !source)
				throw new Error('Unmapped content ' + path);
			pages.push({
				path,
				kind,
				source,
				pageFile: pageFile ? 'pages/' + pageFile : undefined,
				locale: language ?? 'ja',
				title: '',
			});
		}
	if (pages.length !== 1991 || new Set(pages.map((p) => p.path)).size !== 1991)
		throw new Error('Public route inventory changed; regenerate and review count');
	return pages;
}
