import { detab } from "detab";
import { transform, extractCodeBlocks } from "@ox-content/napi";
import { fromHtml } from "hast-util-from-html";
import { nativeDocument } from "./markdown-native.mjs";
import { compileHast, generateToc } from "./document-tree.mjs";
import { generatePath, pathMeta } from "./path-meta.mjs";
import { semanticFootnotes } from "./semantic-footnotes.mjs";
import { componentMarkdown } from "./component-syntax.mjs";
import { highlighter } from "./highlight.mjs";
import { isRelative } from "ufo";

const text = (node) => node.value ?? node.children?.map(text).join("") ?? "";
const theme = { default: "catppuccin-latte", dark: "one-dark-pro" };
function codeMeta(block) {
	const raw = block.language + " " + block.meta;
	const h = /\{([^}]*)\}/.exec(raw),
		f = /\[((?:\\\]|[^\]])*)\]/.exec(raw);
	const highlights = h?.[1]
		.split(",")
		.filter(Boolean)
		.flatMap((value) => {
			const [a, b] = value.trim().split("-").map(Number);
			return Array.from({ length: (b || a) - a + 1 }, (_, i) => a + i);
		});
	return {
		language: block.language || undefined,
		highlights: highlights?.length ? highlights : undefined,
		filename: f?.[1].replace(/\\\]/g, "]") || undefined,
		meta: raw
			.replace(block.language, "")
			.replace(h?.[0] ?? "", "")
			.replace(f?.[0] ?? "", "")
			.trim(),
	};
}
export async function compileFragment(raw) {
	const converted = componentMarkdown(raw);
	converted.source = converted.source.replace(
		/([\u0080-\uFFFF])([A-Za-z0-9.+_-]+)\\@([A-Za-z0-9.-]+)/g,
		"$1$2&#xE000;$3",
	);
	const result = transform(converted.source, {
		gfm: true,
		mdx: true,
		emojiShortcodes: true,
		semanticFootnotes: true,
		linkTargetBlank: false,
		autolinkTargetBlank: false,
	});
	if (result.errors.length) throw Error(JSON.stringify(result.errors));
	const tree = fromHtml(result.html, { fragment: true });
	const blocks = extractCodeBlocks(raw),
		styles = [];
	let codeIndex = 0;
	async function visit(node, parent) {
		if (node.properties?.dataLegacyBinding !== undefined) {
			node.tagName = "binding";
			node.properties = { value: node.properties.dataLegacyBinding };
		}
		if (node.properties?.dataLegacyProps !== undefined)
			node.properties =
				converted.properties[Number(node.properties.dataLegacyProps)];
		if (node.type === "element" && node.properties?.dataOxIsland) {
			const payload = node.children.find(
				(n) =>
					n.tagName === "script" && n.properties?.type === "application/json",
			);
			const data = payload ? JSON.parse(text(payload)) : {};
			if (Object.keys(data.expressions ?? {}).length || data.spreads?.length)
				throw Error(
					"Only literal MDX props are supported; use a client island for expressions",
				);
			const nativeProps = data.props ?? {};
			const props = {
				...nativeProps,
				...converted.properties[nativeProps.oxPropsId],
			};
			delete props.oxPropsId;
			const name = node.properties.dataOxIsland;
			node.tagName =
				converted.originalTags[nativeProps.oxPropsId] ??
				converted.componentTag(name);
			node.properties = props;
			node.children = node.children.filter((n) => n !== payload);
			if (name === "OxSpan")
				node.children = node.children.flatMap((n) =>
					n.tagName === "p" ? n.children : [n],
				);
			if (
				converted.inline?.[nativeProps.oxPropsId] &&
				node.children[0]?.tagName === "p"
			)
				node.children.splice(0, 1, ...node.children[0].children);
		}
		if (node.type === "element" && node.tagName === "pre") {
			const block = blocks[codeIndex++];
			if (!block) throw Error("Code fence metadata missing");
			const value = block.code ? detab(block.code) + "\n" : "";
			const metadata = codeMeta(block),
				hasInfo = !!(block.language + " " + block.meta).trim();
			node.properties = Object.fromEntries(
				Object.entries({ ...(hasInfo ? metadata : {}), code: value }).filter(
					([, v]) => v !== undefined,
				),
			);
			const code = {
				type: "element",
				tagName: "code",
				properties: { __ignoreMap: "" },
				children: [{ type: "text", value }],
			};
			node.children = [code];
			if (metadata.language) {
				const highlighted = await highlighter(value, metadata.language, theme, {
					highlights: metadata.highlights,
					meta: metadata.meta,
				});
				node.properties.className =
					"language-" + metadata.language + " " + highlighted.className;
				node.properties.style = highlighted.inlineStyle;
				code.children = highlighted.tree;
				styles.push(highlighted.style);
			}
			return;
		}
		if (node.tagName === "a") {
			const href = node.properties?.href ?? "",
				hash = href.match(/#.+$/)?.[0] ?? "";
			if (/^https?:/.test(href)) node.properties.rel = ["nofollow"];
			if (
				href.replace(/#.+$/, "").endsWith(".md") &&
				(isRelative(href) || (!/^https?/.test(href) && !href.startsWith("/")))
			)
				node.properties.href =
					generatePath(href.replace(".md" + hash, ""), {
						forceLeadingSlash: false,
					}) + hash;
		}
		if (
			node.type === "text" &&
			["root", "p", "em", "strong"].includes(parent?.tagName ?? parent?.type)
		)
			node.value = node.value.replace(/(?<=[\.\?\!])([A-Z(])/g, " $1");
		if (node.children && !["a", "code", "pre", "script"].includes(node.tagName))
			node.children = node.children.flatMap((child) => {
				if (child.type !== "text") return [child];
				const result = [];
				let cursor = 0;
				for (const m of child.value.matchAll(
					/(?<![\w])([A-Za-z0-9][\w.+-]*@[A-Za-z0-9-]+(?:\.[A-Za-z][A-Za-z0-9-]*)+)/gu,
				)) {
					result.push(
						{ type: "text", value: child.value.slice(cursor, m.index) },
						{
							type: "element",
							tagName: "a",
							properties: { href: "mailto:" + m[1] },
							children: [{ type: "text", value: m[1] }],
						},
					);
					cursor = m.index + m[0].length;
				}
				return cursor
					? [...result, { type: "text", value: child.value.slice(cursor) }]
					: [child];
			});
		for (const child of node.children ?? []) await visit(child, node);
	}
	await visit(tree);
	restoreEscapedEmails(tree);
	if (styles.length)
		tree.children.push({
			type: "element",
			tagName: "style",
			properties: {},
			children: [
				{
					type: "text",
					value: [
						...new Set(
							styles.flatMap((s) =>
								s
									.split("}")
									.filter((x) => x.trim())
									.map((x) => x.trim() + "}"),
							),
						),
					].join(""),
				},
			],
		});
	const compiler = {};
	compileHast.call(compiler);
	const { body } = compiler.Compiler(tree);
	if (
		/^\[/.test(raw) &&
		body.children.length === 1 &&
		body.children[0].tag === "span"
	)
		body.children = [
			{ type: "element", tag: "p", props: {}, children: body.children },
		];
	body.toc = generateToc(body);
	return { body };
}
export async function parseOx(body, source = "inline.md", frontmatter = {}) {
	const entry = {
		source,
		body,
		frontmatter,
		path: frontmatter._path ?? generatePath(source.replace(/\.md$/, "")),
	};
	const document = await nativeDocument(entry, compileFragment, {
		compileHast,
		generateToc,
		generatePath,
		componentIslands: true,
		allowUnclosedContainers: true,
		normalizeTree: semanticFootnotes,
	});
	return pathMeta.transform(document, { defaultLocale: "" });
}
export { compileHast, generateToc, generatePath };

function restoreEscapedEmails(node) {
	if (node.type === "text") node.value = node.value.replaceAll("\uE000", "@");
	node.children?.forEach(restoreEscapedEmails);
}
