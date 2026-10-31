// Shiki helper adapted from @nuxtjs/mdc 0.9.5 (MIT); see prose/NOTICE.md.
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { createWasmOnigEngine } from "shiki/engine/oniguruma";
import { bundledLanguages } from "shiki/langs";
import { bundledThemes } from "shiki/themes";
const require = createRequire(import.meta.url);
export function createShikiHighlighter({
	langs = [],
	themes = [],
	bundledLangs = {},
	bundledThemes = {},
	getHighlightConfigs,
	options: shikiOptions,
	engine,
} = {}) {
	let shiki;
	let configs;
	async function _getShiki() {
		const {
			createHighlighterCore,
			addClassToHast,
			isSpecialLang,
			isSpecialTheme,
		} = await import("shiki/core");
		const {
			transformerNotationDiff,
			transformerNotationErrorLevel,
			transformerNotationFocus,
			transformerNotationHighlight,
		} = await import("@shikijs/transformers");
		const shiki2 = await createHighlighterCore({
			langs,
			themes,
			engine,
		});
		for await (const config of await getConfigs()) {
			await config.shiki?.setup?.(shiki2);
		}
		return {
			shiki: shiki2,
			addClassToHast,
			isSpecialLang,
			isSpecialTheme,
			transformers: [
				transformerNotationDiff(),
				transformerNotationErrorLevel(),
				transformerNotationFocus(),
				transformerNotationHighlight(),
			],
		};
	}
	async function getShiki() {
		if (!shiki) {
			shiki = _getShiki();
		}
		return shiki;
	}
	async function getConfigs() {
		if (!configs) {
			configs = Promise.resolve(getHighlightConfigs?.() || []);
		}
		return configs;
	}
	const highlighter = async (code, lang, theme, options = {}) => {
		const {
			shiki: shiki2,
			addClassToHast,
			isSpecialLang,
			isSpecialTheme,
			transformers: baseTransformers,
		} = await getShiki();
		const codeToHastOptions = {
			defaultColor: false,
			meta: {
				__raw: options.meta,
			},
		};
		if (lang === "ts-type" || lang === "typescript-type") {
			lang = "typescript";
			codeToHastOptions.grammarContextCode = "let a:";
		} else if (lang === "vue-html" || lang === "vue-template") {
			lang = "vue";
			codeToHastOptions.grammarContextCode = "<template>";
		}
		const themesObject = {
			...(typeof theme === "string" ? { default: theme } : theme || {}),
		};
		const loadedThemes = shiki2.getLoadedThemes();
		const loadedLanguages = shiki2.getLoadedLanguages();
		if (
			typeof lang === "string" &&
			!loadedLanguages.includes(lang) &&
			!isSpecialLang(lang)
		) {
			if (bundledLangs[lang]) {
				await shiki2.loadLanguage(bundledLangs[lang]);
			} else {
				if (process.dev) {
					console.warn(
						`[site:highlight] Language "${lang}" is not loaded to the Shiki highlighter, fallback to plain text. Add the language to ssg/highlight.mjs to fix this.`,
					);
				}
				lang = "text";
			}
		}
		for (const [color, theme2] of Object.entries(themesObject)) {
			if (
				typeof theme2 === "string" &&
				!loadedThemes.includes(theme2) &&
				!isSpecialTheme(theme2)
			) {
				if (bundledThemes[theme2]) {
					await shiki2.loadTheme(bundledThemes[theme2]);
				} else {
					if (process.dev) {
						console.warn(
							`[site:highlight] Theme "${theme2}" is not loaded to the Shiki highlighter. Add the theme to ssg/highlight.mjs to fix this.`,
						);
					}
					themesObject[color] = "none";
				}
			}
		}
		const transformers = [...baseTransformers];
		for (const config of await getConfigs()) {
			const newTransformers =
				typeof config.shiki?.transformers === "function"
					? await config.shiki?.transformers(code, lang, theme, options)
					: config.shiki?.transformers || [];
			transformers.push(...newTransformers);
		}
		const root = shiki2.codeToHast(code.trimEnd(), {
			lang,
			...codeToHastOptions,
			themes: themesObject,
			transformers: [
				...transformers,
				{
					name: "site:highlight",
					line(node, line) {
						if (options.highlights?.includes(line))
							addClassToHast(node, "highlight");
						node.properties.line = line;
					},
				},
				{
					name: "site:newline",
					line(node) {
						if (code?.includes("\n")) {
							if (
								node.children.length === 0 ||
								(node.children.length === 1 &&
									node.children[0].type === "element" &&
									node.children[0].children.length === 1 &&
									node.children[0].children[0].type === "text" &&
									node.children[0].children[0].value === "")
							) {
								node.children = [
									{
										type: "element",
										tagName: "span",
										properties: {
											emptyLinePlaceholder: true,
										},
										children: [{ type: "text", value: "\n" }],
									},
								];
								return;
							}
							const last = node.children.at(-1);
							if (last?.type === "element" && last.tagName === "span") {
								const text = last.children.at(-1);
								if (text?.type === "text") text.value += "\n";
							}
						}
					},
				},
			],
		});
		const preEl = root.children[0];
		const codeEl = preEl.children[0];
		const wrapperStyle = shikiOptions?.wrapperStyle;
		preEl.properties.style = wrapperStyle
			? typeof wrapperStyle === "string"
				? wrapperStyle
				: preEl.properties.style
			: "";
		const styles = [];
		Object.keys(themesObject).forEach((color) => {
			const colorScheme = color !== "default" ? `.${color}` : "";
			styles.push(
				wrapperStyle ? `${colorScheme} .shiki,` : "",
				`html .${color} .shiki span {`,
				`color: var(--shiki-${color});`,
				`background: var(--shiki-${color}-bg);`,
				`font-style: var(--shiki-${color}-font-style);`,
				`font-weight: var(--shiki-${color}-font-weight);`,
				`text-decoration: var(--shiki-${color}-text-decoration);`,
				"}",
			);
			styles.push(
				`html${colorScheme} .shiki span {`,
				`color: var(--shiki-${color});`,
				`background: var(--shiki-${color}-bg);`,
				`font-style: var(--shiki-${color}-font-style);`,
				`font-weight: var(--shiki-${color}-font-weight);`,
				`text-decoration: var(--shiki-${color}-text-decoration);`,
				"}",
			);
		});
		return {
			tree: codeEl.children,
			className: Array.isArray(preEl.properties.class)
				? preEl.properties.class.join(" ")
				: preEl.properties.class,
			inlineStyle: preEl.properties.style,
			style: styles.join(""),
		};
	};
	return highlighter;
}

const grammar = JSON.parse(
	await readFile(
		require.resolve(
			"aiscript-vscode/aiscript/syntaxes/aiscript.tmLanguage.json",
		),
		"utf8",
	),
);
const highlighterOptions = {
	bundledLangs: bundledLanguages,
	bundledThemes,
	engine: createWasmOnigEngine(() => import("shiki/wasm")),
	getHighlightConfigs: () => [
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
const highlighter = async (code, lang, theme, options) => {
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
					const data = imported.default ?? imported;
					const color = data.fg ?? data.colors["editor.foreground"];
					return `--shiki-${variant}:${color.startsWith("#") ? color.toUpperCase() : color}`;
				}),
			)
		).join(";");
		const text = (node) =>
			node.value ?? node.children?.map(text).join("") ?? "";
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

export { highlighter };
