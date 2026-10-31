import { extractMdcIslands } from "./mdc-islands.mjs";
import Slugger from "github-slugger";
import { transform } from "@ox-content/napi";
import { fromHtml } from "hast-util-from-html";
import { isRelative } from "ufo";

// Shared preprocessing for the direct N-API path and the official Vue plugin.
// Extract component/code islands before Rust parses the remaining Markdown.
export function prepareNativeMarkdown(
	entry,
	{ mdcIslands = false, allowUnclosedContainers = false } = {},
) {
	const snippets = [];
	const extracted = mdcIslands
		? extractMdcIslands(entry.body, snippets, {
				allowUnclosed: allowUnclosedContainers,
			})
		: null;
	const componentSnippets = snippets.length;
	// Respect the opening fence length: a four-backtick example may contain a
	// literal triple-backtick AiScript fence, which must remain code text.
	const lines =
		(extracted?.markdown ?? entry.body).match(/[^\n]*\n|[^\n]+$/g) ?? [];
	let markdown = "";
	for (let i = 0; i < lines.length; i++) {
		const opening = /^ {0,3}(`{3,}|~{3,})[^\n]*\r?\n?$/.exec(lines[i]);
		if (!opening) {
			markdown += lines[i];
			continue;
		}
		let code = lines[i];
		const closing = new RegExp(
			`^ {0,3}${opening[1][0]}{${opening[1].length},}[ \\t]*\\r?\\n?$`,
		);
		while (++i < lines.length) {
			code += lines[i];
			if (closing.test(lines[i])) break;
		}
		const slot = snippets.push(code) - 1;
		markdown += `<div data-mdc-slot="${slot}"></div>\n`;
	}
	const codeIslands = snippets.length - componentSnippets;
	if (/^:{2,}[^\n]*(?:\{|#)|^:{2}[^:\n]/m.test(markdown)) {
		throw new Error(`MDC syntax outside supported MDC syntax: ${entry.source}`);
	}
	return { markdown, snippets, componentSnippets, extracted, codeIslands };
}

// MDC compatibility bridge. Unsupported MDC must fail, never disappear.
// Keep the existing Shiki/AiScript output for fenced code; Rust parses the rest.
export async function nativeDocument(
	entry,
	compileCode,
	{
		compileHast,
		generateToc,
		generatePath,
		mdcIslands = false,
		allowUnclosedContainers = false,
		prepared,
		renderedHtml,
		normalizeTree,
	},
) {
	const { markdown, snippets, extracted, codeIslands } =
		prepared ??
		prepareNativeMarkdown(entry, { mdcIslands, allowUnclosedContainers });

	const rendered =
		renderedHtml === undefined
			? transform(markdown, {
					gfm: true,
					...(mdcIslands ? { semanticFootnotes: true } : {}),
					containers: { enabled: true },
					toc: true,
					linkTargetBlank: false,
					autolinkTargetBlank: false,
				})
			: { html: renderedHtml, errors: [] };

	if (rendered.errors.length) throw new Error(JSON.stringify(rendered.errors));

	const compiled = await Promise.all(snippets.map(compileCode));

	const tree = fromHtml(rendered.html, { fragment: true });
	normalizeTree?.(tree);
	function adapt(node, parent) {
		if (
			node.type === "text" &&
			["root", "p", "em", "strong", ...(mdcIslands ? ["li"] : [])].includes(
				parent?.tagName ?? parent?.type,
			)
		) {
			node.value = node.value.replace(/(?<=[\.\?\!])([A-Z(])/g, " $1");
		}
		if (node.type === "element") {
			const first = node.children?.[0];
			const checkbox =
				first?.tagName === "input"
					? first
					: first?.tagName === "p"
						? first.children?.[0]
						: null;
			if (node.tagName === "li" && checkbox?.properties?.type === "checkbox") {
				node.properties.className = [
					...new Set([...(node.properties.className ?? []), "task-list-item"]),
				];
				if (parent?.tagName === "ul")
					parent.properties.className = [
						...new Set([
							...(parent.properties.className ?? []),
							"contains-task-list",
						]),
					];
			}

			const classes = node.properties.className ?? [];
			if (classes.includes("ox-container")) {
				const type = classes
					.find((c) => c.startsWith("ox-container--"))
					?.slice("ox-container--".length);
				if (!["tip", "warning"].includes(type))
					throw new Error(`Unsupported container: ${type}`);
				node.tagName = type;
				node.properties = {};
				node.children = node.children.filter(
					(child) =>
						!child.properties?.className?.includes("ox-container-title"),
				);
			}
			// Use the existing slugger, including its duplicate and numeric-heading rules.
			if (/^h[1-6]$/.test(node.tagName)) delete node.properties.id;
			if (node.tagName === "a" && /^https?:/.test(node.properties.href ?? "")) {
				delete node.properties.target;
				node.properties.rel = ["nofollow"];
			}
			if (node.tagName === "a") {
				const href = node.properties.href ?? "";
				if (mdcIslands && href.includes("#"))
					node.properties.href = href.replace(
						/#(.*)$/,
						(_, hash) => "#" + encodeURI(decodeURI(hash)),
					);
				const hash = href.match(/#.+$/)?.[0] ?? "";
				if (
					href.replace(/#.+$/, "").endsWith(".md") &&
					(isRelative(href) || (!/^https?/.test(href) && !href.startsWith("/")))
				) {
					node.properties.href =
						generatePath(href.replace(".md" + hash, ""), {
							forceLeadingSlash: false,
						}) + hash;
				}
			}
			if (node.tagName === "img")
				node.properties.alt = node.properties.alt?.replace(/[\[\]]/g, "");
		}
		for (const child of node.children ?? []) adapt(child, node);
		if (
			mdcIslands &&
			node.children &&
			!["a", "code", "pre"].includes(node.tagName)
		)
			node.children = node.children.flatMap((child) => {
				if (child.type !== "text" || !child.value.includes("@")) return [child];
				const result = [];
				let cursor = 0;
				for (const match of child.value.matchAll(
					/(?<![\w@])([A-Za-z0-9][\w.+-]*@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+)/g,
				)) {
					result.push(
						{ type: "text", value: child.value.slice(cursor, match.index) },
						{
							type: "element",
							tagName: "a",
							properties: { href: "mailto:" + match[1] },
							children: [{ type: "text", value: match[1] }],
						},
					);
					cursor = match.index + match[0].length;
				}
				return cursor
					? [...result, { type: "text", value: child.value.slice(cursor) }]
					: [child];
			});
	}
	adapt(tree);
	if (mdcIslands) {
		const element = (tagName, properties, children) => ({
			type: "element",
			tagName,
			properties,
			children,
		});
		const text = (value) => ({ type: "text", value });
		const footnotes = tree.children.find((node) =>
			node.properties?.className?.includes("footnotes"),
		);
		if (footnotes) {
			delete footnotes.properties.ariaLabel;
			footnotes.properties.dataFootnotes = "";
			footnotes.children.unshift(
				element("h2", { className: ["sr-only"], id: "footnote-label" }, [
					text("Footnotes"),
				]),
			);
		}
		const visit = (node) => {
			const props = node.properties ?? {};
			if (props.href?.startsWith("#fn-")) {
				props.href = props.href.replace("#fn-", "#user-content-fn-");
				props.ariaDescribedBy = ["footnote-label"];
				props.dataFootnoteRef = "";
			}
			if (props.id?.startsWith("fn")) props.id = "user-content-" + props.id;
			if (props.href?.startsWith("#fnref-")) {
				props.href = props.href.replace("#fnref-", "#user-content-fnref-");
				props.className = ["data-footnote-backref"];
				props.dataFootnoteBackref = "";
			}
			if (node.tagName === "li" && props.id?.startsWith("user-content-fn-")) {
				const back = node.children.find(
					(c) =>
						c.tagName === "a" &&
						/^#(?:user-content-)?fnref-/.test(c.properties?.href ?? ""),
				);
				const paragraph = node.children.findLast((c) => c.tagName === "p");
				if (back && paragraph) {
					node.children = node.children.filter((c) => c !== back);
					paragraph.children.push(text(" "), back);
				}
			}
			node.children?.forEach(visit);
		};
		visit(tree);
	}
	const compiler = {};
	compileHast.call(compiler);
	const { body } = compiler.Compiler(tree);
	const styles = new Map();
	for (const snippet of compiled)
		for (const node of snippet.body.children) {
			if (node.tag === "style") styles.set(JSON.stringify(node), node);
		}
	function substitute(node) {
		node.children = node.children?.flatMap((child) =>
			child.tag === "span" && child.props.dataMdcInline !== undefined
				? compiled[Number(child.props.dataMdcInline)].body.children
						.flatMap((part) => (part.tag === "p" ? part.children : [part]))
						.map(substitute)
				: child.tag === "div" && child.props.dataMdcSlot !== undefined
					? compiled[Number(child.props.dataMdcSlot)].body.children
							.filter((node) => node.tag !== "style")
							.map(substitute)
					: [substitute(child)],
		);
		return node;
	}
	substitute(body);
	body.children.push(...styles.values());
	if (mdcIslands) {
		const slugs = new Slugger();
		const text = (n) => n.value ?? n.children?.map(text).join("") ?? "";
		const walk = (n) => {
			if (/^h[1-6]$/.test(n.tag ?? "") && n.props?.id !== "footnote-label") {
				n.props ??= {};
				n.props.id = slugs
					.slug(text(n))
					.replace(/-+/g, "-")
					.replace(/^-|-$/g, "")
					.replace(/^(\d)/, "_$1");
			}
			n.children?.forEach(walk);
		};
		walk(body);
	}
	const text = (node) => node.value ?? node.children?.map(text).join("") ?? "";
	const title =
		entry.frontmatter.title ??
		text(body.children.find((c) => c.tag === "h1") ?? {});
	const headingChildren = body.children.filter(
		(c) => c.type === "element" && c.tag !== "hr",
	);
	if (headingChildren[0]?.tag === "h1") headingChildren.shift();
	const description =
		entry.frontmatter.description ??
		text(
			mdcIslands
				? headingChildren[0]?.tag === "p"
					? headingChildren[0]
					: {}
				: (body.children.find((c) => c.tag === "p") ?? {}),
		);
	body.toc = generateToc(body, { title: "", searchDepth: 2, depth: 2 });

	return {
		...entry.frontmatter,
		title,
		description,
		body,
		...(mdcIslands
			? {
					_parsing: {
						engine: "ox",
						codeIslands,
						mdcIslands:
							(extracted?.containers ?? 0) + (extracted?.components ?? 0),
						fullMdcFallback: false,
					},
				}
			: {}),
		_path: entry.path,
		_file: entry.source,
		_type: "markdown",
		_id: `content:${entry.source.replaceAll("/", ":")}`,
	};
}
