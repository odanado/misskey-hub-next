import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { readFile } from "node:fs/promises";
import { createWasmOnigEngine } from "shiki/engine/oniguruma";
import { bundledLanguages } from "shiki/langs";
import { bundledThemes } from "shiki/themes";
import type { ThemeRegistration } from "shiki";
import remarkEmoji from "remark-emoji";
import fixer from "../scripts/markdown-fixer/index.js";
import { isRelative } from "ufo";
const require = createRequire(import.meta.url);
const dist = dirname(require.resolve("@nuxtjs/mdc"));
const { createMarkdownParser } = await import(resolve(dist, "runtime/parser/index.js"));
const { createShikiHighlighter } = await import(resolve(dist, "runtime/highlighter/shiki.js"));
const { default: highlight } = await import(resolve(dist, "runtime/highlighter/rehype.js"));
export const { compileHast } = await import(resolve(dist, "runtime/parser/compiler.js"));
export const { generateToc } = await import(resolve(dist, "runtime/parser/toc.js"));
import { generatePath, pathMeta } from "./path-meta.ts";
export { generatePath, pathMeta };
const grammar = JSON.parse(
	await readFile(
		require.resolve("aiscript-vscode/aiscript/syntaxes/aiscript.tmLanguage.json"),
		"utf8",
	),
);
const highlighterOptions = {
	bundledLangs: bundledLanguages,
	bundledThemes,
	engine: createWasmOnigEngine(() => import("shiki/wasm")),
	getMdcConfigs: () => [
		{
			shiki: {
				setup: async (shiki) => {
					await shiki.loadLanguage(grammar);
				},
			},
		},
	],
};
const defaultHighlighter = createShikiHighlighter(highlighterOptions);
// Markdown/MDC register embedded Vue grammars. Isolate the legacy Vue grammar
// so other documents' language-loading order cannot change its token colors.
const vueHighlighter = createShikiHighlighter({
	...highlighterOptions,
	langs: [bundledLanguages.mdc],
});
const highlighter = async (
	code: string,
	lang: string,
	theme: Record<string, keyof typeof bundledThemes>,
	options: any,
) => {
	const rendered = await (lang === "vue" ? vueHighlighter : defaultHighlighter)(
		code,
		lang,
		theme,
		options,
	);
	if (lang === "vue" && /<route\b/.test(code)) {
		// Existing Nuxt output leaves custom route-block contents in the theme's
		// plain foreground. Preserve that presentation without changing the code.
		const foreground = (
			await Promise.all(
				Object.entries(theme).map(async ([variant, name]) => {
					const imported = await bundledThemes[name]();
					const data = (imported.default ?? imported) as ThemeRegistration;
					const color = data.fg ?? data.colors["editor.foreground"];
					return `--shiki-${variant}:${color.startsWith("#") ? color.toUpperCase() : color}`;
				}),
			)
		).join(";");
		const text = (node: any): string => node.value ?? node.children?.map(text).join("") ?? "";
		const lines = code.split("\n");
		let inRoute = false;
		const uncolored = new Set();
		lines.forEach((line, index) => {
			if (/^\s*<\/route>/.test(line)) inRoute = false;
			if (inRoute) uncolored.add(index + 1);
			if (/^\s*<route\b/.test(line)) inRoute = true;
		});
		for (const node of rendered.tree)
			if (uncolored.has(node.properties?.line))
				node.children = [
					{
						type: "element",
						tagName: "span",
						properties: { style: foreground },
						children: [{ type: "text", value: text(node) }],
					},
				];
	}
	return rendered;
};
const parserOptions = {
	remark: {
		plugins: {
			"remark-emoji": { instance: remarkEmoji },
			fixer: { instance: fixer },
		},
	},
	rehype: {
		plugins: {
			highlight: {
				instance: highlight,
				options: {
					highlighter,
					theme: { default: "catppuccin-latte", dark: "one-dark-pro" },
				},
			},
		},
	},
};
let parserTask: Promise<any> | undefined;
function markdownParser() {
	return (parserTask ??= createMarkdownParser({
		...parserOptions,
		configs: [
			{
				unified: {
					post(processor: any) {
						processor.use(function isolatedCompiler(this: any) {
							// A compiler owns a heading slugger. Each document gets a fresh one,
							// while the immutable remark/rehype pipeline is reused.
							this.Compiler = (tree: any, file: any) => {
								const compiler: any = {};
								compileHast.call(compiler, { keepComments: false });
								return compiler.Compiler(tree, file);
							};
						});
						return processor;
					},
				},
			},
		],
	}).catch((error: unknown) => {
		parserTask = undefined;
		throw error;
	}));
}
export async function parseMdcContent(body: string) {
	const parser = await markdownParser();
	return parser(body);
}
export function mdcDocument(parsed: any, source: string) {
	function links(node: any) {
		if (node.tag === "a") {
			const href = node.props.href ?? "";
			const hash = href.match(/#.+$/)?.[0] ?? "";
			if (
				href.replace(/#.+$/, "").endsWith(".md") &&
				(isRelative(href) || (!/^https?/.test(href) && !href.startsWith("/")))
			)
				node.props.href =
					generatePath(href.replace(".md" + hash, ""), {
						forceLeadingSlash: false,
					}) + hash;
		}
		for (const child of node.children ?? []) links(child);
	}
	links(parsed.body);
	return pathMeta.transform(
		{
			...parsed.data,
			body: { ...parsed.body, toc: parsed.toc },
			_type: "markdown",
			_id: `content:${source.replaceAll("/", ":")}`,
		},
		{ defaultLocale: "" },
	);
}

export async function parseMdc(body: string, source: string) {
	return mdcDocument(await parseMdcContent(body), source);
}
