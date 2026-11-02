import { useSiteContext } from "./injection";
export const useHead = (input: any) => {
	const c = useSiteContext(),
		value = typeof input === "function" ? input() : input;
	c.head ??= { htmlAttrs: {}, meta: [] };
	Object.assign(c.head.htmlAttrs, value?.htmlAttrs ?? {});
	c.head.meta.push(...(value?.meta ?? []));
	if (typeof document !== "undefined") {
		for (const [key, v] of Object.entries(value?.htmlAttrs ?? {}))
			document.documentElement.setAttribute(
				key,
				String(v) + (key === "class" ? " " + c.colorMode.value : ""),
			);
		for (const meta of value?.meta ?? []) {
			const key = meta.name ? "name" : "property",
				name = meta[key];
			if (!name) continue;
			let element = document.querySelector("meta[" + key + '="' + name + '"]');
			if (!element) {
				element = document.createElement("meta");
				element.setAttribute(key, name);
				document.head.appendChild(element);
			}
			element.setAttribute("content", String(meta.content ?? ""));
		}
	}
};
export const definePageMeta = (meta: any) =>
	Object.assign(useSiteContext().route.meta, meta);
