import { reactive, ref } from "vue";
import { createI18n } from "vue-i18n";
import { createColorMode } from "./color-mode";
export function createContext(payload: any) {
	const locale = payload.locale ?? payload.path.split("/")[1];
	const i18n = createI18n({
		legacy: false,
		locale,
		fallbackLocale: ["en", "ja"],
		messages: { [locale]: payload.messages },
	});
	const context = {
		i18n,
		...payload,
		staticMarkdownHtml: payload.staticMarkdownHtml ?? "",
		locale: i18n.global.locale,
		state: { miHub_global_scrollPos: ref(0) } as Record<string, any>,
		route: reactive({
			path: payload.path,
			fullPath:
				payload.path +
				(typeof location === "undefined"
					? ""
					: location.search + location.hash),
			query:
				typeof location === "undefined"
					? {}
					: Object.fromEntries(new URLSearchParams(location.search)),
			params: {
				slug:
					payload.kind === "blog"
						? payload.path.split("/").filter(Boolean).at(-1)
						: payload.path.split("/").slice(3).filter(Boolean),
			},
			meta: {
				...payload.pageMeta,
				__isDocsIndexPage: /index\.md$/.test(payload.source ?? ""),
			},
		}),
		colorMode: createColorMode(payload.pageMeta),
	};
	return context;
}
