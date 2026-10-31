import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parseOx, compileFragment } from "../ssg/markdown-ox.mjs";
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
const fixture = JSON.parse(
	await readFile(
		new URL("./fixtures/markdown-pr3.json", import.meta.url),
		"utf8",
	),
);
for (const { source, body } of fixture.samples)
	test("Legacy authoring: " + source.split("\n")[0], async () => {
		const migrated = await parseOx(source, "test.md");
		assert.deepEqual(
			migrated.body.children.map(semantic),
			body.children.map(semantic),
		);
	});

test("Vue highlight preserves the original MDC grammar order", async () => {
	await parseOx("```md\nExample Markdown\n```", "markdown.md");
	const parsed = await parseOx(
		'```vue\n<template>\n<div :class="$style.red">Text</div>\n</template>\n```',
		"vue.md",
	);
	const tokens = [];
	const visit = (node) => {
		if (node.tag === "span") tokens.push(node);
		node.children?.forEach(visit);
	};
	visit(parsed.body);
	assert.ok(
		tokens.some(
			(node) =>
				node.children?.some((child) => child.value === " :class") &&
				node.props?.style?.includes("--shiki-default:#DF8E1D"),
		),
	);
});

test("Vue route examples retain the original plain foreground", async () => {
	const parsed = await parseOx(
		'```vue\n<route lang="yaml">\nname: note\npath: /notes/:noteId\n</route>\n```',
		"route.md",
	);
	const spans = [];
	const visit = (node) => {
		if (node.tag === "span") spans.push(node);
		node.children?.forEach(visit);
	};
	visit(parsed.body);
	assert.ok(
		spans.some(
			(node) =>
				node.children?.some((child) => child.value?.includes("name: note")) &&
				node.props?.style?.includes("--shiki-default:#4C4F69"),
		),
	);
});

test("Ox MDX owns nested components and typed literal props", async () => {
	const result = await compileFragment(
		'<Tip count={42} options={{"open":true}} enabled={true}>\n\n**Bold**\n\n<Warning>\n\nNested *Markdown*\n\n</Warning>\n\n</Tip>',
	);
	const tip = result.body.children[0];
	assert.equal(tip.tag, "tip");
	assert.deepEqual(tip.props, {
		count: 42,
		options: { open: true },
		enabled: true,
	});
	assert.equal(tip.children[0].children[0].tag, "strong");
	assert.equal(tip.children[1].tag, "warning");
	assert.equal(tip.children[1].children[0].children[1].tag, "em");
});
test("Dynamic MDX props fail instead of silently dropping expressions", async () => {
	await assert.rejects(
		() => compileFragment("<Tip count={unknownVariable} />"),
		/Only literal MDX props/,
	);
});

test("Named slots and quoted MDX-looking strings remain intact", async () => {
	const { body } = await compileFragment(
		":::tip\n#title\n\n**Heading**\n\n#default\n\nBody\n:::",
	);
	assert.equal(body.children[0].children[0].tag, "template");
	assert.equal(body.children[0].children[0].props["#title"], "");
	const literal = await compileFragment('<MfmPreview text="count={42}" />');
	assert.deepEqual(literal.body.children[0].props, { text: "count={42}" });
});

test("MDX spreads fail while spread-like quoted text remains literal", async () => {
	await assert.rejects(
		() => compileFragment("<Tip {...props} />"),
		/spread props are unsupported/,
	);
	const result = await compileFragment('<MfmPreview text="{...props}" />');
	assert.deepEqual(result.body.children[0].props, { text: "{...props}" });
});
