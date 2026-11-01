import { parentPort, workerData } from "node:worker_threads";
import { parseMdc, parseMdcContent, mdcDocument } from "../../nuxt-compat/mdc.ts";
import { legacyMdcSources } from "../../nuxt-compat/legacy-markdown.ts";
const started = performance.now();

try {
	// Embedded MDC/Vue grammars must see the same YAML grammar in every worker.
	await parseMdc("```yaml\nfixture: true\n```\n", "snippet.md");
	const rows = [];
	for (const source of workerData.snippets)
		rows.push([source, await parseMdc(source, "snippet.md")]);
	parentPort.postMessage({ type: "snippets", rows, ms: performance.now() - started });
	parentPort.once("message", async (job) => {
		try {
			if (job.type !== "documents") throw new Error("Expected document preparation jobs");
			const snippets = new Map(job.snippets);
			const { createOxContentMarkdownRenderer } = await import("@ox-content/vite-plugin/markdown");
			const { createDocumentParser } = await import("../markdown.ts");
			const markdown = createOxContentMarkdownRenderer({
				root: workerData.root,
				oxContent: {
					srcDir: "content",
					docs: false,
					search: false,
					embeds: false,
					highlight: false,
					containers: true,
					ssg: { generateOgImage: false, lastUpdated: false, readerChrome: false },
				},
			});
			const legacyContent = new Map();
			const parseLegacy = async (body, source) => {
				let task = legacyContent.get(body);
				if (!task) {
					task = parseMdcContent(body);
					legacyContent.set(body, task);
				}
				return mdcDocument(structuredClone(await task), source);
			};
			const parse = createDocumentParser(
				{ markdown },
				async (source) => {
					if (!snippets.has(source)) throw new Error("Missing prepared MDC snippet");
					return snippets.get(source);
				},
				parseLegacy,
			);
			const documents = [],
				timing = { legacyMs: 0, nativeMs: 0 };
			for (const entry of job.entries) {
				const start = performance.now();
				documents.push([entry.source, await parse(entry)]);
				timing[legacyMdcSources.has(entry.source) ? "legacyMs" : "nativeMs"] +=
					performance.now() - start;
			}
			parentPort.postMessage({ type: "documents", rows: documents, timing });
		} catch (error) {
			parentPort.postMessage({ type: "error", error: error.stack ?? String(error) });
		}
		parentPort.close();
	});
} catch (error) {
	parentPort.postMessage({ type: "error", error: error.stack ?? String(error) });
	parentPort.close();
}
