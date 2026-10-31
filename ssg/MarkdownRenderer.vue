<script lang="ts">
// A local Vue adapter for the Ox document tree, used by existing YAML/fixed
// pages. Ordinary Markdown stays static HTML and is never hydrated as a page.
import { computed, defineComponent, h, resolveComponent, Text } from "vue";
import { useSiteContext } from "./runtime";
import { contentComponents } from "./component-names.mjs";
import { find, html } from "property-information";
const prose = new Map(
	[
		"p",
		"a",
		"blockquote",
		"pre",
		"em",
		"h1",
		"h2",
		"h3",
		"h4",
		"h5",
		"h6",
		"hr",
		"img",
		"ul",
		"ol",
		"li",
		"strong",
		"table",
		"thead",
		"tbody",
		"td",
		"th",
		"tr",
		"script",
	].map((tag) => [tag, "Prose" + tag[0].toUpperCase() + tag.slice(1)]),
);
prose.set("code", "ProseCodeInline");
const pascal = (tag: string) =>
	tag
		.split("-")
		.map((part) => part[0].toUpperCase() + part.slice(1))
		.join("");
export default defineComponent({
	name: "SiteMarkdown",
	props: {
		value: { type: [String, Object], required: true },
		tag: { type: [String, Boolean], default: "div" },
	},
	setup(props) {
		const context = useSiteContext();
		const body = computed(() =>
			typeof props.value === "string"
				? context.inlineMarkdown?.[props.value]
				: ((props.value as any)?.body ?? props.value),
		);
		if (typeof props.value === "string" && !body.value)
			throw Error(
				"Inline Markdown was not compiled: " + props.value.slice(0, 100),
			);
		function render(node: any): any {
			if (node.type === "text") return h(Text, node.value);
			if (node.tag === "binding")
				return h(Text, node.props?.defaultValue ?? "");
			const attributes = Object.fromEntries(
				Object.entries(node.props ?? {})
					.filter(([k]) => k !== "__ignoreMap")
					.map(([k, v]) => [
						find(html, k).attribute,
						Array.isArray(v) && v.every((x) => typeof x === "string")
							? v.join(" ")
							: v,
					]),
			);
			const name =
				node.props?.__ignoreMap !== undefined
					? node.tag
					: (prose.get(node.tag) ??
						contentComponents[node.tag] ??
						(node.tag.includes("-") ? pascal(node.tag) : node.tag));
			const component = /^[A-Z]/.test(name) ? resolveComponent(name) : name;
			const slots: Record<string, any[]> = { default: [] };
			for (const child of node.children ?? []) {
				if (child.tag === "template") {
					const name =
						Object.keys(child.props ?? {})
							.find((k) => k.startsWith("#") || k.startsWith("v-slot:"))
							?.replace(/^(#|v-slot:)/, "") ?? "default";
					slots[name] ??= [];
					slots[name].push(...child.children);
				} else slots.default.push(child);
			}
			const children = Object.fromEntries(
				Object.entries(slots)
					.filter(([, nodes]) => nodes.length)
					.map(([name, nodes]) => [name, () => nodes.map(render)]),
			);
			return h(
				component,
				attributes,
				typeof component === "string" ? (children.default?.() ?? []) : children,
			);
		}
		return () => {
			if (!body.value) return null;
			const children = () => body.value.children.map(render);
			return props.tag === false
				? children()
				: h(props.tag as string, null, { default: children });
		};
	},
});
</script>
