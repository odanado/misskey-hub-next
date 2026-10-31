import fs from 'node:fs';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import yaml from 'js-yaml';
import { loadNuxt, build } from 'nuxt';
const root = process.cwd(),
	require = createRequire(root + '/package.json');
const { default: pathMeta } = await import(
	resolve(dirname(require.resolve('@nuxt/content')), 'runtime/transformers/path-meta.js')
);
// Resolve real i18n routes and macros, then stop before Vue/Nitro compilation.
// Switch _prepare only after route/template generation so this uses build-time
// route resolution, including .client suffix removal and disabled i18n routes.
delete process.env.HUB_CONTENT_PILOT;
delete process.env.HUB_VUE_COMPILER;
process.env.NODE_ENV = 'production';
process.env.CROWDIN_INTG_API = '';
const nuxt = await loadNuxt({
	cwd: root,
	dev: false,
	ready: true,
	overrides: { devtools: { enabled: false } },
});
let pages;
try {
	nuxt.hook('app:templatesGenerated', (app) => {
		pages = app.pages;
		nuxt.options._prepare = true;
	});
	await build(nuxt);
} finally {
	await nuxt.close();
}
if (!pages) throw new Error('No resolved Nuxt routes');
const locales = nuxt.options.runtimeConfig.public.locales.map((locale) => locale.code);
const canonical = (p) => '/' + p.split('/').filter(Boolean).join('/') + (p === '/' ? '' : '/');
const files = fs
	.readdirSync('content', { recursive: true })
	.filter((f) => /\.(md|yml|yaml)$/.test(f) && !f.split('/').some((x) => x.startsWith('.')));
const records = [];
const docs = new Map(),
	blog = new Map(),
	directories = new Map();
const drafts = [],
	duplicateDocPaths = [];
for (const source of files) {
	const raw = fs.readFileSync('content/' + source, 'utf8');
	const m = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(raw);
	const fields = source.endsWith('.md')
		? m
			? (yaml.load(m[1]) ?? {})
			: {}
		: (yaml.load(raw) ?? {});
	const item = pathMeta.transform(
		{ ...fields, _id: 'content:' + source.replaceAll('/', ':') },
		{ defaultLocale: '' },
	);
	records.push(item);
	if (item._partial && item._path.endsWith('/_dir') && !item._draft)
		directories.set(item._path.slice(0, -5), source);
	if (item._draft || item._partial) {
		drafts.push(source);
		continue;
	}
	if (/^\/[a-z-]+\/docs\//.test(item._path)) {
		if (docs.has(item._path))
			duplicateDocPaths.push({ path: item._path, sources: [docs.get(item._path), source] });
		docs.set(item._path, source);
	}
	if (item._path.startsWith('/blog/')) {
		if (blog.has(item._path)) throw new Error('Duplicate blog path ' + item._path);
		blog.set(item._path, source);
	}
}
const directoryOnly = [];
for (const [path, source] of directories)
	if (/^\/[a-z-]+\/docs\//.test(path) && !docs.has(path)) {
		docs.set(path, source);
		directoryOnly.push({ path, source });
	}
// Exercise the actual Content query resolver for synthetic directory landings.
const { createQuery } = await import(
	resolve(dirname(require.resolve('@nuxt/content')), 'runtime/query/query.js')
);
const { createPipelineFetcher } = await import(
	resolve(dirname(require.resolve('@nuxt/content')), 'runtime/query/match/pipeline.js')
);
for (const { path } of directoryOnly) {
	const query = createQuery(
		createPipelineFetcher(async () => records),
		{ legacy: true, initialParams: { where: [{ _path: path }], dirConfig: true } },
	);
	if (!(await query.findOne())?._dir) throw new Error('Directory is not resolvable: ' + path);
}
const categories = { docs: [], blog: [], static: [], languageEntry: [] };
const redirects = pages.filter((p) => p.path.includes(':pathMatch'));
const routes = pages.filter((p) => !p.path.includes(':pathMatch'));
for (const route of routes) {
	if (route.children?.length) throw new Error('Unexpected nested routes');
	if (route.file.includes('/runtime/component-stub')) throw new Error('Unclassified stub');
	const locale = route.name.split('___')[1];
	const unprefixed = route.name.endsWith('___default');
	let candidates = [];
	let category;
	if (route.file.endsWith('/pages/docs/[...slug].vue')) {
		const sourceLocale = locale === 'ja-ks' ? 'ja' : locale;
		const prefix = '/' + sourceLocale + '/docs/';
		candidates = [...docs.keys()]
			.filter((p) => p.startsWith(prefix))
			.map((p) => route.path.replace(':slug(.*)*', p.slice(prefix.length)));
		category = 'docs';
	} else if (route.file.endsWith('/pages/blog/[slug].vue')) {
		candidates = [...blog.keys()].map((p) =>
			route.path.replace(':slug()', p.slice('/blog/'.length)),
		);
		category = 'blog';
	} else {
		if (route.path.includes(':')) throw new Error('Unknown dynamic route');
		candidates = [route.path];
		category = 'static';
	}
	for (const path of candidates)
		categories[unprefixed ? 'languageEntry' : category].push({
			path: canonical(path),
			route: route.path,
			file: route.file.replace(root + '/', ''),
			locale: locale ?? null,
		});
}
const visible = Object.values(categories).flat();
if (new Set(visible.map((x) => x.path)).size !== visible.length) throw new Error('URL collisions');
const perLocale = Object.fromEntries(
	locales.map((l) => [
		l,
		Object.fromEntries(
			['docs', 'blog', 'static'].map((k) => [
				k,
				categories[k].filter((x) => x.locale === l).length,
			]),
		),
	]),
);
const summary = {
	recordedAt: new Date().toISOString(),
	basis:
		'current checkout; actual Nuxt-resolved routes plus Nuxt Content path-meta and source frontmatter; no production HTTP crawl',
	sourceFiles: files.length,
	duplicateDocPaths,
	directoryOnly,
	sourceDocPages: docs.size,
	sourceBlogPages: blog.size,
	counts: Object.fromEntries(Object.entries(categories).map(([k, v]) => [k, v.length])),
	contentPages: categories.docs.length + categories.blog.length + categories.static.length,
	withLanguageEntryPages: visible.length,
	perLocale,
	globalStatic: categories.static.filter((x) => !x.locale),
	redirectRoutePatterns: redirects.length,
	notes: [
		'Trailing slash aliases are normalized; query/fragment variants are not separate pages.',
		'API, assets, errors, legacy redirects and redirect wildcard instances are excluded.',
		'FAQ fragments, internal _dir URLs, hidden legacy source and unsupported ca content are not separate public pages. Directory landing pages generated from _dir are included.',
		'ja-ks uses Japanese docs. Unprefixed default-language HTML is replaced by language selection/client redirect.',
		'Noindex utilities and test pages remain in the count because their routes are public.',
	],
	urls: Object.fromEntries(
		Object.entries(categories).map(([key, rows]) => [key, rows.map((row) => row.path).sort()]),
	),
};
fs.writeFileSync(
	'experiments/ssg/results/public-url-count.json',
	JSON.stringify(summary, null, 2) + '\n',
);
console.log(
	JSON.stringify(
		{
			counts: summary.counts,
			contentPages: summary.contentPages,
			withLanguageEntryPages: summary.withLanguageEntryPages,
		},
		null,
		2,
	),
);
