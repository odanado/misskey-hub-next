import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { parseFrontmatter } from "@ox-content/napi";
import { parseMdc, compileHast, generateToc, generatePath } from "../ssg/mdc.mjs";
import { nativeDocument } from "../ssg/markdown-native.mjs";
import { legacyMdcSources, parseLegacyDocument } from "../ssg/mdc-compatibility.mjs";
import { semanticFootnotes } from "../ssg/semantic-footnotes.mjs";

// Compare text and element structure with the actual pre-migration parser.
// Whitespace and hoisted highlighting styles are verified separately by VRT.
function structure(node) {
	if (node.type === "text") return node.value.replace(/\s+/g, " ").trim();
	if (node.tag === "style" || node.type === "comment") return null;
	return { tag: node.tag ?? node.type, props: Object.fromEntries(Object.entries(node.props ?? {}).filter(([key]) => ["href", "src", "alt", "id", "style", "title"].includes(key)).sort(([a], [b]) => a.localeCompare(b))), children: (node.children ?? []).map(structure).filter(v => v !== null && v !== "") };
}
test("All Markdown preserves original MDC text, structure and link/image attributes", { timeout: 120000 }, async (t) => {
	const sources = (await readdir("content", { recursive: true })).filter(p => p.endsWith(".md") && !p.split("/").some(s => s.startsWith(".")));
	for (const source of legacyMdcSources) assert.ok(sources.includes(source), "Missing compatibility source: " + source);
	for (const source of sources) {
		const raw = await readFile("content/" + source, "utf8");
		const entry = { source, body: parseFrontmatter(raw).content, frontmatter: {}, path: "/" + source };
		const reference = await parseMdc(raw, source);
		const migrated = legacyMdcSources.has(source) ? await parseLegacyDocument(entry) : await nativeDocument(entry, snippet => parseMdc(snippet, "snippet.md"), { compileHast, generateToc, generatePath, mdcIslands: true, allowUnclosedContainers: true, normalizeTree: semanticFootnotes });
		assert.deepEqual(structure(migrated.body), structure(reference.body), source);
	}
	t.diagnostic(`${sources.length} Markdown sources checked; ${legacyMdcSources.size} explicit legacy parser exceptions`);
});
