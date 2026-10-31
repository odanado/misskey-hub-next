import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { parseFrontmatter } from "@ox-content/napi";
import { parseOx } from "../ssg/markdown-ox.mjs";

// Independent snapshots from PR #3's parser. They are test evidence only and
// are never imported by the build. VRT covers whitespace and hoisted styles.
export function structure(node) {
	if (node.type === "text") return node.value.replace(/\s+/g, " ").trim();
	if (node.tag === "style" || node.type === "comment") return null;
	return {
		tag: node.tag ?? node.type,
		props: Object.fromEntries(
			Object.entries(node.props ?? {})
				.filter(([key]) =>
					["href", "src", "alt", "id", "style", "title"].includes(key),
				)
				.sort(([a], [b]) => a.localeCompare(b)),
		),
		children: (node.children ?? [])
			.map(structure)
			.filter((v) => v !== null && v !== ""),
	};
}
const hash = (value) => createHash("sha256").update(value).digest("hex");
test(
	"Historical Markdown corpus retains PR #3 structure and attributes",
	{ timeout: 120000 },
	async (t) => {
		const reference = JSON.parse(
			await readFile(
				new URL("./fixtures/corpus-pr3.json", import.meta.url),
				"utf8",
			),
		);
		let checked = 0,
			changed = 0;
		for (const [source, expected] of Object.entries(reference.sources)) {
			let raw;
			try {
				raw = await readFile("content/" + source, "utf8");
			} catch (error) {
				if (error.code === "ENOENT") {
					changed++;
					continue;
				}
				throw error;
			}
			// Future editorial changes are not frozen to the migration snapshot.
			if (hash(raw) !== expected.sourceSha256) {
				changed++;
				continue;
			}
			const { content, frontmatter } = parseFrontmatter(raw);
			const parsed = await parseOx(content, source, frontmatter);
			assert.equal(
				hash(JSON.stringify(structure(parsed.body))),
				expected.semanticSha256,
				source,
			);
			assert.equal(
				hash(
					JSON.stringify(
						stable({
							title: parsed.title,
							description: parsed.description,
							path: parsed._path,
							toc: parsed.body.toc,
						}),
					),
				),
				expected.metadataSha256,
				source + " metadata",
			);
			assert.equal(
				hash(JSON.stringify(stable(componentProps(parsed.body)))),
				expected.componentPropsSha256,
				source + " props",
			);
			checked++;
		}
		assert.ok(checked > 0);
		t.diagnostic(
			`${checked}/${reference.sourceCount} migration snapshots checked; ${changed} subsequently edited/deleted sources`,
		);
	},
);
test("All 201 inline YAML Markdown strings retain PR #3 output", async () => {
	const reference = JSON.parse(
		await readFile(
			new URL("./fixtures/inline-pr3.json", import.meta.url),
			"utf8",
		),
	);
	for (const { source, semanticSha256 } of reference.samples) {
		const parsed = await parseOx(source, "inline.md");
		assert.equal(
			hash(JSON.stringify(structure(parsed.body))),
			semanticSha256,
			source,
		);
	}
});

function stable(value) {
	if (Array.isArray(value)) return value.map(stable);
	if (value && typeof value === "object")
		return Object.fromEntries(
			Object.keys(value)
				.sort()
				.map((key) => [key, stable(value[key])]),
		);
	return value;
}
function componentProps(node, out = []) {
	if (
		node.type === "element" &&
		(["tip", "warning", "danger", "g-details", "fukidashi"].includes(
			node.tag,
		) ||
			node.tag?.includes("-")) &&
		!node.tag?.startsWith("mk-schema-viewer")
	)
		out.push({ tag: node.tag, props: node.props });
	node.children?.forEach((child) => componentProps(child, out));
	return out;
}
