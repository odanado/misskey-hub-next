import { contentComponents as custom } from "./component-names.mjs";
import { find, html as htmlSchema } from "property-information";
export const escape = (value: any) =>
	String(value ?? "")
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;");
const voidTags = new Set([
	"area",
	"base",
	"br",
	"col",
	"embed",
	"hr",
	"img",
	"input",
	"link",
	"meta",
	"param",
	"source",
	"track",
	"wbr",
]);
function attributes(props: any) {
	return Object.entries(props ?? {})
		.filter(([key]) => !key.startsWith("__"))
		.map(([key, value]) => {
			const attribute = find(htmlSchema, key).attribute;
			if (value === undefined || value === null || value === false) return "";
			if (value === true) return ` ${attribute}`;
			return ` ${attribute}="${escape(Array.isArray(value) ? value.join(" ") : value)}"`;
		})
		.join("");
}
export async function renderBody(body: any, decorations: any) {
	async function nodes(children: any[] = []): Promise<string> {
		const out = [];
		for (const node of children) out.push(await render(node));
		return out.join("");
	}
	async function render(node: any): Promise<string> {
		if (node.type === "text") return escape(node.value);
		if (node.type === "comment") return `<!--${node.value}-->`;
		if (node.type === "root") return nodes(node.children);
		const tag = node.tag,
			props = Object.fromEntries(
				Object.entries(node.props ?? {}).map(([key, value]) => [
					find(htmlSchema, key).attribute,
					Array.isArray(value) && value.every((v) => typeof v === "string")
						? value.join(" ")
						: value,
				]),
			) as Record<string, any>;
		if (tag === "style") return ""; // Already hoisted into head by data preparation.
		// Schema UI is omitted. Keep the inert legacy wrapper and child flow
		// emitted by Nuxt MDC so following content retains its original margins.
		if (["mk-schema-viewer", "mk-schema-viewer-item-object"].includes(tag)) {
			decorations.notices.add(tag);
			const name =
				tag === "mk-schema-viewer"
					? "MkSchemaViewer"
					: "MkSchemaViewerItemObject";
			const legacyProps = Object.fromEntries(
				Object.entries(props).map(([key, value]) => [
					key.replace(/^:/, ""),
					value,
				]),
			);
			return `<${name}${attributes(legacyProps)}>${await nodes(node.children)}</${name}>`;
		}
		const named =
			custom[tag] ??
			(Object.values(custom).includes(tag)
				? tag
				: decorations.componentName(tag));
		if (named) {
			const slots: Record<string, string> = {};
			const normal = [];
			for (const child of node.children ?? []) {
				if (child.tag === "template") {
					const name =
						Object.keys(child.props ?? {})
							.find((key) => key.startsWith("#") || key.startsWith("v-slot:"))
							?.replace(/^(#|v-slot:)/, "") ?? "default";
					slots[name] = await nodes(child.children);
				} else normal.push(child);
			}
			if (normal.length) slots.default = await nodes(normal);
			return decorations.render(
				named,
				props,
				slots,
				["MfmPreview", "MiWebEmbed"].includes(named) ||
					!Object.values(custom).includes(named),
			);
		}
		if (/^[A-Z]/.test(tag) || tag.includes("-"))
			throw new Error("Unsupported content component: " + tag);
		const children = await nodes(node.children);
		if (tag === "a" && props.__ignoreMap === undefined)
			return decorations.render("ProseA", props, { default: children });
		if (tag === "table" && props.__ignoreMap === undefined)
			return `<div data-ox-table class="w-full overflow-x-auto !overflow-y-hidden whitespace-nowrap mb-4"><table class="!max-w-none !mb-0 !overflow-visible"${attributes(props)}>${children}</table></div>`;
		if (tag === "img" && props.__ignoreMap === undefined) {
			props.class = ["rounded-lg", props.class].filter(Boolean).join(" ");
			props.loading = "lazy";
			props.alt ??= "";
		}
		let inner = children;
		if (/^h[2-5]$/.test(tag) && props.id && tag !== "h5")
			inner = `<a href="#${escape(props.id)}">${children}</a>`;
		return `<${tag}${attributes(props)}>${voidTags.has(tag) ? "" : inner + `</${tag}>`}`;
	}
	return nodes(body.children);
}
