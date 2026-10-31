import { getStrategy } from './strategies.mjs';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import yaml from 'js-yaml';
import { expanded, fullSite } from './scope.mjs';
import { pages } from './pages.mjs';
import { parseMdc, parseOx } from './content/markdown.mjs';
import { createNavigation, metadata, sourceOrder } from './navigation.mjs';
import { localesConst } from '../../../assets/data/locales.ts';
import { performance } from 'node:perf_hooks';

export async function prepareData(mode, { parseDocument = parseOx } = {}) {
	if (fullSite) return (await import('./full-data.mjs')).prepareFullData(mode, { parseDocument });
	const started = performance.now();
	const ox = getStrategy(mode).engine === 'ox';
	const native = ox ? await import('@ox-content/napi') : null;
	const files = (await readdir('content', { recursive: true })).filter(
		(file) =>
			/\.(md|yml|yaml)$/.test(file) && !file.split('/').some((part) => part.startsWith('.')),
	);
	const contents = [];
	const entries = ox
		? JSON.parse(
				native.buildCollectionManifest({
					srcDir: 'content',
					extensions: ['md'],
					collections: [{ name: 'docs', source: ['**/*.md'], include: ['body'] }],
				}),
			).collections.docs
		: [];
	const bySource = new Map(entries.map((e) => [e.source, e]));
	const configurations = {};
	for (const source of files) {
		let fields;
		if (source.endsWith('.md')) {
			if (ox) {
				const e = bySource.get(source);
				if (!e) continue;
				fields = { ...e.frontmatter };
				fields.title ??= heading(e.body);
			} else {
				const raw = await readFile(join('content', source), 'utf8');
				const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(raw);
				fields = match ? (yaml.load(match[1]) ?? {}) : {};
				const body = match ? raw.slice(match[0].length) : raw;
				fields.title ??= heading(body);
			}
		} else fields = yaml.load(await readFile(join('content', source), 'utf8')) ?? {};
		const item = metadata(source, fields);
		if (item._partial && /\/_dir$/i.test(item._path))
			configurations[item._path.split('/').slice(0, -1).join('/') || '/'] = {
				...item,
				...item.body,
			};
		contents.push(item);
	}
	contents.sort(sourceOrder);
	let indexDescriptions = 0;
	if (expanded) {
		const bases = [];
		for (const page of pages) {
			if ((await readFile('content/' + page.source, 'utf8')).includes('<MkIndex'))
				bases.push(page.path.replace(/\/$/, ''));
		}
		for (const item of contents)
			if (
				item._extension === 'md' &&
				item.description === undefined &&
				bases.some((base) => item._path.startsWith(base + '/'))
			) {
				const parsed = await parseMdc(await readFile('content/' + item._file, 'utf8'), item._file);
				item.description = parsed.description;
				indexDescriptions++;
			}
	}
	const metadataFinished = performance.now();
	const out = [];
	for (const page of pages) {
		const raw = await readFile('content/' + page.source, 'utf8');
		const locale = page.path.split('/')[1];
		const document = ox
			? await parseDocument({ ...bySource.get(page.source), body: native.parseFrontmatter(raw).content })
			: await parseMdc(raw, page.source);
		// Ox hoists inline styles into shared assets. Keep generated Shiki CSS in
		// the document head so Vue never hydrates a style node that Ox has moved.
		const styles = document.body.children
			.filter((node) => node.tag === 'style')
			.flatMap((node) => node.children.map((child) => child.value ?? ''))
			.join('\n');
		document.body.children = document.body.children.map((node) =>
			node.tag === 'style'
				? // github-markdown-css applies :last-child margins. Preserve the inert
					// trailing node when hoisting CSS, including before JavaScript runs.
					{
						type: 'element',
						tag: 'span',
						props: { hidden: true, 'aria-hidden': 'true', 'data-port-style-placeholder': '' },
						children: [],
					}
				: node,
		);
		const navigation = createNavigation(
			contents.filter(
				(c) => c._path.startsWith(`/${locale}/docs/`) && !c._partial && c.navigation !== false,
			),
			configurations,
		);
		const visible = contents.filter((c) => !c._partial);
		const index = visible.findIndex((c) => c._path === page.path.replace(/\/$/, ''));
		const messages = yaml.load(
			await readFile(`locales/${locale === 'ja' ? 'ja-JP' : 'en-US'}.yml`, 'utf8'),
		);
		out.push({
			...page,
			document,
			styles,
			navigation,
			surround: [visible[index - 1] ?? null, visible[index + 1] ?? null],
			messages,
			locales: localesConst,
		});
	}
	console.log(
		'[port-data] ' +
			JSON.stringify({
				mode,
				metadataSeconds: (metadataFinished - started) / 1000,
				bodyAndNavigationSeconds: (performance.now() - metadataFinished) / 1000,
				sourceCount: files.length,
				renderedPages: out.length,
				markdownEngine: ox
					? expanded
						? 'Ox Markdown + MDC component/code islands'
						: 'ox + MDC code highlighting'
					: 'MDC unified',
				indexDescriptions,
				...(expanded && ox
					? {
							oxPages: out.length,
							mdcComponentIslands: out.reduce(
								(n, p) => n + (p.document._pilotParsing?.mdcIslands ?? 0),
								0,
							),
							codeIslands: out.reduce(
								(n, p) => n + (p.document._pilotParsing?.codeIslands ?? 0),
								0,
							),
							fullMdcFallbackPages: out.filter((p) => p.document._pilotParsing?.fullMdcFallback)
								.length,
						}
					: {}),
			}),
	);
	return out;
}
function heading(body) {
	const start = body.trimStart().replace(/^(?:<!--[\s\S]*?-->\s*)+/, '');
	const text =
		/^#\s+([^\n]+)(?:\n|$)/.exec(start)?.[1] ?? /^([^\n]+)\n=+\s*(?:\n|$)/.exec(start)?.[1];
	return text
		?.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
		.replace(/[`*_]/g, '')
		.trim();
}
