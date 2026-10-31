import { prepareNativeMarkdown, nativeDocument } from "./markdown-native.mjs";
import {
	compileHast,
	generateToc,
	generatePath,
	compileFragment,
} from "./markdown-ox.mjs";
import { semanticFootnotes } from "./semantic-footnotes.mjs";
import { resolve } from "node:path";
import { root } from "./routes.mjs";
// Ox's supported Custom Host Markdown API owns parsing. The compatibility AST
// exists only on the build side; it is neither Vue-rendered nor sent to clients.
export function createDocumentParser(host: any) {
	const documents = new Map<string, Promise<any>>();
	return (entry: any) => {
		if (!documents.has(entry.source))
			documents.set(
				entry.source,
				(async () => {
					const prepared = prepareNativeMarkdown(entry, {
						componentIslands: true,
						allowUnclosedContainers: true,
					});
					const result = await host.markdown.render({
						source: prepared.markdown,
						documentPath: resolve(root, "content", entry.source),
						convertMdLinks: false,
						renderHtml: async ({ html }: { html: string }) => ({
							html,
							metadata: await nativeDocument(entry, compileFragment, {
								compileHast,
								generateToc,
								generatePath,
								componentIslands: true,
								allowUnclosedContainers: true,
								prepared,
								renderedHtml: html,
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
