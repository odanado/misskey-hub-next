import { getStrategy } from './strategies.mjs';
import { tick, elapsed } from '../tooling/profiling.mjs';
import { readFile, readdir } from 'node:fs/promises';
import yaml from 'js-yaml';
import { performance } from 'node:perf_hooks';
import { pages } from './pages.mjs';
import { metadata, createNavigation, sourceOrder } from './navigation.mjs';
import { parseMdc, parseOx } from './content/markdown.mjs';
import { localesConst } from '../../../assets/data/locales.ts';
export async function prepareFullData(mode, { parseDocument = parseOx } = {}) {
	const manifestStart = tick();
	const start = performance.now(),
		ox = getStrategy(mode).engine === 'ox',
		napi = ox ? await import('@ox-content/napi') : null;
	const manifest = ox
		? new Map(
				JSON.parse(
					napi.buildCollectionManifest({
						srcDir: 'content',
						extensions: ['md'],
						collections: [{ name: 'all', source: ['**/*.md'], include: ['body'] }],
					}),
				).collections.all.map((e) => [e.source, e]),
			)
		: null;
	elapsed('data.nativeImportAndManifest', manifestStart);
	const contents = [],
		configs = {},
		inlineMarkdown = {};
	let md = 0;
	const files = (await readdir('content', { recursive: true })).filter(
		(f) => /\.(md|ya?ml)$/.test(f) && !f.split('/').some((x) => x.startsWith('.')),
	);
	for (const source of files) {
		const readStart = tick();
		const raw = await readFile('content/' + source, 'utf8');
		let item;
		elapsed('data.sourceRead', readStart);
		const parseStart = tick();
		if (source.endsWith('.md')) {
			md++;
			console.log('[full-parse] ' + source);
			item = ox
				? metadata(
						source,
						await parseDocument({ ...manifest.get(source), body: napi.parseFrontmatter(raw).content }),
					)
				: await parseMdc(raw, source);
		} else {
			const fields = yaml.load(raw) ?? {};
			item = metadata(source, fields);
			if (fields._TYPE_) Object.assign(item, fields);
		}
		elapsed(
			source.endsWith('.md') ? 'data.markdownParseAndMetadata' : 'data.yamlParseAndMetadata',
			parseStart,
		);
		contents.push(item);
		if (item._partial && item._path.endsWith('/_dir'))
			configs[item._path.slice(0, -5)] = { ...item, ...item.body };
	}
	// The original YAML guides and history timeline pass Markdown strings to MDC.
	// Compile these strings explicitly; do not silently discard their content.
	async function inline(value) {
		if (typeof value === 'string' && value.includes('\n') && !inlineMarkdown[value])
			inlineMarkdown[value] = (await parseMdc(value, 'inline.md')).body;
		else if (Array.isArray(value)) for (const item of value) await inline(item);
		else if (value && typeof value === 'object')
			for (const item of Object.values(value)) await inline(item);
	}
	const inlineStart = tick();
	for (const item of contents.filter((x) => x._extension !== 'md' && !x._partial))
		await inline(item);
	elapsed('data.yamlInlineMdc', inlineStart);
	const navigationStart = tick();
	const sorted = [...contents].sort(sourceOrder),
		blog = contents
			.filter((x) => x._path.startsWith('/blog/') && !x._partial)
			.map(({ body, ...item }) => item),
		out = [];
	const messages = new Map(),
		nav = new Map();
	for (const locale of localesConst) {
		const sourceLocale = locale.code === 'ja-ks' ? 'ja' : locale.code;
		messages.set(
			locale.code,
			yaml.load(await readFile('locales/' + locale.files[0].replace('.json', '.yml'), 'utf8')),
		);
		nav.set(
			locale.code,
			createNavigation(
				sorted.filter(
					(x) =>
						x._path.startsWith('/' + sourceLocale + '/docs/') &&
						!x._partial &&
						x.navigation !== false,
				),
				configs,
			),
		);
	}
	elapsed('data.navigationMessages', navigationStart);
	const payloadStart = tick();
	for (const page of pages) {
		const key =
			page.kind === 'blog'
				? page.path.replace(/^\/ja\//, '/').replace(/\/$/, '')
				: page.path.replace(/^\/ja-ks\//, '/ja/').replace(/\/$/, '');
		const sourceLocale = page.locale === 'ja-ks' ? 'ja' : page.locale;
		const original = page.source ? contents.find((x) => x._file === page.source) : null;
		const document = original ? { ...original } : { title: page.path, description: '', _path: key };
		if (original?._partial) Object.assign(document, { _dir: configs[key], _file: undefined });
		let styles = '';
		if (document.body?.children) {
			styles = document.body.children
				.filter((n) => n.tag === 'style')
				.flatMap((n) => n.children.map((c) => c.value ?? ''))
				.join('\n');
			document.body = {
				...document.body,
				children: document.body.children.map((n) =>
					n.tag === 'style'
						? { type: 'element', tag: 'span', props: { hidden: true }, children: [] }
						: n,
				),
			};
		}
		const index = sorted.findIndex((x) => x._path === key),
			related =
				page.pageFile === 'pages/contact.vue'
					? contents.filter((x) => x._path.startsWith('/' + sourceLocale + '/contact-faq/'))
					: page.pageFile === 'pages/blog/index.vue'
						? blog
						: [];
		out.push({
			...page,
			fullSite: true,
			document,
			styles,
			messages: messages.get(page.locale),
			navigation: nav.get(page.locale),
			surround: [sorted[index - 1] ?? null, sorted[index + 1] ?? null],
			related,
			inlineMarkdown: page.source?.endsWith('.yml') ? inlineMarkdown : {},
			locales: localesConst,
		});
	}
	elapsed('data.payloadAssembly', payloadStart);
	console.log(
		'[port-data] ' +
			JSON.stringify({
				mode,
				fullSite: true,
				sourceCount: files.length,
				markdownSources: md,
				renderedPages: out.length,
				seconds: (performance.now() - start) / 1000,
				markdownEngine: ox ? 'Ox + MDC islands' : 'MDC',
				oxPages: contents.filter((x) => x._pilotParsing?.engine === 'ox').length,
				mdcComponentIslands: contents.reduce((n, x) => n + (x._pilotParsing?.mdcIslands ?? 0), 0),
				codeIslands: contents.reduce((n, x) => n + (x._pilotParsing?.codeIslands ?? 0), 0),
				fullMdcFallbackPages: contents.filter((x) => x._pilotParsing?.fullMdcFallback).length,
				inlineMarkdownStrings: Object.keys(inlineMarkdown).length,
			}),
	);
	return out;
}
