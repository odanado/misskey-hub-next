// Ox Markdown currently renders footnote definitions in place. Keep
// Nuxt/MDC's semantic endnotes and reading order without reparsing the document.
export function semanticFootnotes(tree) {
	const definitions = [];
	const visit = (node) => {
		node.children = node.children?.filter((child) => {
			if (
				child.type === "element" &&
				child.properties?.className?.includes("footnote")
			) {
				let children = child.children;
				if (children.filter((node) => node.tagName === "p").length === 1) {
					children = children
						.flatMap((node) => (node.tagName === "p" ? node.children : [node]))
						.filter((node) => node.type !== "text" || node.value.trim());
					const back = children.find(
						(node) =>
							node.tagName === "a" &&
							node.properties?.href?.startsWith("#fnref-"),
					);
					if (back) {
						children = children.filter((node) => node !== back);
						children.push({ type: "text", value: " " }, back);
					}
				}
				definitions.push({
					...child,
					tagName: "li",
					properties: { id: child.properties.id },
					children,
				});
				return false;
			}
			visit(child);
			return true;
		});
	};
	visit(tree);
	if (definitions.length)
		tree.children.push({
			type: "element",
			tagName: "section",
			properties: { className: ["footnotes"] },
			children: [
				{
					type: "element",
					tagName: "ol",
					properties: {},
					children: definitions,
				},
			],
		});
}
