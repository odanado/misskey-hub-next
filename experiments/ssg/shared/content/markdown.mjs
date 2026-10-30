import { expanded, fullSite } from '../scope.mjs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { readFile } from 'node:fs/promises';
import { createWasmOnigEngine } from 'shiki/engine/oniguruma';
import { bundledLanguages } from 'shiki/langs';
import { bundledThemes } from 'shiki/themes';
import remarkEmoji from 'remark-emoji';
import fixer from '../../../../scripts/markdown-fixer/index.js';
import { isRelative } from 'ufo';
const require = createRequire(import.meta.url);
const dist = dirname(require.resolve('@nuxtjs/mdc'));
const { createMarkdownParser } = await import(resolve(dist, 'runtime/parser/index.js'));
const { createShikiHighlighter } = await import(resolve(dist, 'runtime/highlighter/shiki.js'));
const { default: highlight } = await import(resolve(dist, 'runtime/highlighter/rehype.js'));
export const { compileHast } = await import(resolve(dist, 'runtime/parser/compiler.js'));
export const { generateToc } = await import(resolve(dist, 'runtime/parser/toc.js'));
const contentDist = dirname(require.resolve('@nuxt/content'));
export const { generatePath, default: pathMeta } = await import(
	resolve(contentDist, 'runtime/transformers/path-meta.js')
);
const grammar = JSON.parse(
	await readFile(
		require.resolve('aiscript-vscode/aiscript/syntaxes/aiscript.tmLanguage.json'),
		'utf8',
	),
);
const highlighter = createShikiHighlighter({
	bundledLangs: bundledLanguages,
	bundledThemes,
	engine: createWasmOnigEngine(() => import('shiki/wasm')),
	getMdcConfigs: () => [
		{
			shiki: {
				setup: async (shiki) => {
					await shiki.loadLanguage(grammar);
				},
			},
		},
	],
});
const parserOptions = {
	remark: { plugins: { 'remark-emoji': { instance: remarkEmoji }, fixer: { instance: fixer } } },
	rehype: {
		plugins: {
			highlight: {
				instance: highlight,
				options: { highlighter, theme: { default: 'catppuccin-latte', dark: 'one-dark-pro' } },
			},
		},
	},
};
export async function parseMdc(body, source) {
	// A parser owns a heading slugger; do not carry duplicate-ID counters from
	// the Japanese page into the English page (for example CW -> cw-1).
	const parser = await createMarkdownParser(parserOptions);
	const parsed = await parser(body);
	function links(node) {
		if (node.tag === 'a') {
			const href = node.props.href ?? '';
			const hash = href.match(/#.+$/)?.[0] ?? '';
			if (
				href.replace(/#.+$/, '').endsWith('.md') &&
				(isRelative(href) || (!/^https?/.test(href) && !href.startsWith('/')))
			)
				node.props.href =
					generatePath(href.replace('.md' + hash, ''), { forceLeadingSlash: false }) + hash;
		}
		for (const child of node.children ?? []) links(child);
	}
	links(parsed.body);
	return pathMeta.transform(
		{
			...parsed.data,
			body: { ...parsed.body, toc: parsed.toc },
			_type: 'markdown',
			_id: `content:${source.replaceAll('/', ':')}`,
		},
		{ defaultLocale: '' },
	);
}
export const parseOx = async (entry) => {
	const { nativeDocument } = await import('./ox-native.mjs');
	return nativeDocument(entry, (code) => parseMdc(code, 'snippet.md'), {
		compileHast,
		generateToc,
		generatePath,
		mdcIslands: expanded,
		allowUnclosedContainers: fullSite,
	});
};
