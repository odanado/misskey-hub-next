import Slugger from "github-slugger";
const text = (node) => node.value ?? node.children?.map(text).join("") ?? "";
const unsafe =
	/^(?:javascript:|vbscript:|data:(?:text\/(?:html|javascript|vbscript|css|plain|xml)))/i;
export function compileHast() {
	const slugs = new Slugger();
	const convert = (node, parent) => {
		if (node.type === "root")
			return {
				type: "root",
				children: node.children.map((n) => convert(n, node)).filter(Boolean),
			};
		if (node.type === "text")
			return !/^\n+$/.test(node.value || "") ||
				parent?.properties?.emptyLinePlaceholder
				? { type: "text", value: node.value }
				: null;
		if (node.type !== "element") return null;
		if (
			node.tagName === "p" &&
			node.children.every((n) => n.type === "text" && /^\s*$/.test(n.value))
		)
			return null;
		if (node.tagName === "li") {
			let paragraph = false;
			node.children = node.children.flatMap((n) => {
				if (n.type !== "element" || n.tagName !== "p") return n;
				const children = paragraph
					? [
							{ type: "element", tagName: "br", properties: {}, children: [] },
							...n.children,
						]
					: n.children;
				paragraph = true;
				return children;
			});
		}
		const props = Object.fromEntries(
			Object.entries(node.properties ?? {}).filter(
				([k, v]) =>
					!k.startsWith("on") &&
					(!["href", "src"].includes(k) || !unsafe.test(String(v))),
			),
		);
		if (/^h[1-6]$/.test(node.tagName))
			props.id = String(props.id || slugs.slug(text(node)))
				.replace(/-+/g, "-")
				.replace(/^-|-$/g, "")
				.replace(/^(\d)/, "_$1");
		if (node.tagName === "pre" && typeof props.highlights === "string")
			props.highlights = props.highlights.split(" ").map(Number);
		return {
			type: "element",
			tag: node.tagName === "component-slot" ? "template" : node.tagName,
			props,
			children: (node.tagName === "template" && node.content?.children.length
				? node.content.children
				: node.children
			)
				.map((n) => convert(n, node))
				.filter(Boolean),
		};
	};
	this.Compiler = (tree) => {
		const body = convert(tree);
		body.children = body.children.filter((n) => n.type !== "text");
		return { body };
	};
}
export function generateToc(
	body,
	{ title = "", searchDepth = 2, depth = 2 } = {},
) {
	const headers = [];
	function walk(node, level) {
		if (level > searchDepth) return;
		if (/^h[2-6]$/.test(node.tag ?? "") && Number(node.tag[1]) <= depth + 1)
			headers.push({
				id: node.props?.id,
				depth: Number(node.tag[1]),
				text: text(node),
			});
		node.children?.forEach((n) => walk(n, level + 1));
	}
	walk(body, 0);
	const nest = (list) => {
		const out = [];
		let parent;
		for (const n of list) {
			if (!parent || n.depth <= parent.depth) {
				parent = { ...n, children: [] };
				out.push(parent);
			} else parent.children.push(n);
		}
		for (const n of out) {
			if (n.children.length) n.children = nest(n.children);
			else delete n.children;
		}
		return out;
	};
	return { title, searchDepth, depth, links: nest(headers) };
}
