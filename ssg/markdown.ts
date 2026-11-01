import { legacyMdcSources, parseLegacyDocument } from "../nuxt-compat/legacy-markdown.ts";
import { prepareNativeMarkdown, nativeDocument } from "./markdown-native.mjs";
import { compileHast, generateToc, generatePath, parseMdc } from "../nuxt-compat/mdc.ts";
import { semanticFootnotes } from "./semantic-footnotes.mjs";
import { resolve } from "node:path";
import { root } from "./routes.mjs";
// Ox's supported Custom Host Markdown API owns parsing. The compatibility AST
// exists only on the build side; it is neither Vue-rendered nor sent to clients.
export function createDocumentParser(
	host: any,
	parseSnippet?: (source: string) => Promise<any>,
	parseLegacy?: (body: string, source: string) => Promise<any>,
) {
	const documents = new Map<string, Promise<any>>();
	const snippets = new Map<string, Promise<any>>();
	const compileSnippet = async (snippet: string) => {
		let result = snippets.get(snippet);
		if (!result) {
			result = parseSnippet ? parseSnippet(snippet) : parseMdc(snippet, "snippet.md");
			snippets.set(snippet, result);
		}
		// nativeDocument rewrites the returned tree. Every use owns its copy.
		return structuredClone(await result);
	};
	return (entry: any) => {
		if (!documents.has(entry.source))
			documents.set(
				entry.source,
				(async () => {
					if (legacyMdcSources.has(entry.source)) return parseLegacyDocument(entry, parseLegacy);
					const prepared = prepareNativeMarkdown(entry, {
						mdcIslands: true,
						allowUnclosedContainers: true,
					});
					const result = await host.markdown.render({
						source: prepared.markdown,
						documentPath: resolve(root, "content", entry.source),
						convertMdLinks: false,
						renderHtml: async ({ html, parseHtml }: any) => ({
							html,
							metadata: await nativeDocument(entry, compileSnippet, {
								compileHast,
								generateToc,
								generatePath,
								mdcIslands: true,
								allowUnclosedContainers: true,
								prepared,
								renderedHtml: html,
								parseHtml,
								normalizeTree: semanticFootnotes,
							}),
						}),
					});
					return result.metadata;
				})(),
			);
		return documents.get(entry.source)!;
	};
}
