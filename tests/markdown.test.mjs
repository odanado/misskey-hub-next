import test from "node:test";
import assert from "node:assert/strict";
import {
	parseMdc,
	compileHast,
	generateToc,
	generatePath,
} from "../nuxt-compat/mdc.ts";
import { nativeDocument } from "../ssg/markdown-native.mjs";
const semantic = (node) =>
	node.type === "text"
		? node.value
		: {
				tag: node.tag,
				type: node.type,
				props:
					node.props &&
					Object.fromEntries(
						Object.entries(node.props).filter(
							([key, value]) =>
								key !== "className" ||
								!Array.isArray(value) ||
								value.length > 0,
						),
					),
				children: node.children?.map(semantic),
			};
for (const source of [
	'<span title="[literal]">Text</span>',
	'<script>const values = ["one"];</script>',

	"# Title\n\n<MkSchemaViewer :schema=\"{\n $ref: 'misskey://Note'\n}\"/>\n\nDescription.\n\n## Operation\n\nNone",
	":MkIndex",
	"<figure>\n\n::ExampleFigure\n::\n\n<figcaption>Caption</figcaption>\n</figure>",
	"Use [1OCPU RAM6GB or greater] here.",
	"Use [a span]{.important} here.",
	"Keep [docs](https://example.com), `literal [code]`, and \\[escaped\\].",
	"- [x] completed\n- [ ] pending",
	"[docs][ref]\n\n[ref]: https://example.com",
	":::tip\nUse [a span] inside a component.\n:::",
])
	test("MDC compatibility: " + source.split("\n")[0], async () => {
		const reference = await parseMdc(source, "test.md");
		const migrated = await nativeDocument(
			{ body: source, source: "test.md", path: "/test", frontmatter: {} },
			(snippet) => parseMdc(snippet, "snippet.md"),
			{ compileHast, generateToc, generatePath, mdcIslands: true },
		);
		assert.deepEqual(
			migrated.body.children.map(semantic),
			reference.body.children.map(semantic),
		);
	});

test("Vue highlight preserves the original MDC grammar order", async () => {
 await parseMdc('```md\nExample Markdown\n```', "markdown.md");
 const parsed = await parseMdc('```vue\n<template>\n<div :class="$style.red">Text</div>\n</template>\n```', "vue.md");
 const tokens = [];
 const visit = node => { if (node.tag === "span") tokens.push(node); node.children?.forEach(visit); };
 visit(parsed.body);
 assert.ok(tokens.some(node => node.children?.some(child => child.value === " :class") && node.props?.style?.includes("--shiki-default:#DF8E1D")));
});

test("Vue route examples retain the original plain foreground", async () => {
 const parsed = await parseMdc('```vue\n<route lang="yaml">\nname: note\npath: /notes/:noteId\n</route>\n```', "route.md");
 const spans = [];
 const visit = node => { if (node.tag === "span") spans.push(node); node.children?.forEach(visit); };
 visit(parsed.body);
 assert.ok(spans.some(node => node.children?.some(child => child.value?.includes("name: note")) && node.props?.style?.includes("--shiki-default:#4C4F69")));
});
