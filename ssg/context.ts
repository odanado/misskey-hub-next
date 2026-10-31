import {
	createSSRApp,
	createStaticVNode,
	Suspense,
	h,
	provide,
	reactive,
	ref,
	watch,
	type Component,
} from "vue";
import { contextKey, runtimeConfig, translate } from "./runtime";
export function createContext(payload: any) {
	const locale = payload.locale ?? payload.path.split("/")[1];
	const context = {
		...payload,
		staticMarkdownHtml: payload.staticMarkdownHtml ?? "",
		locale: ref(locale),
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
		colorMode: reactive({
			preference: "system",
			value: "light",
			forced: false,
		}),
	};
	if (typeof window !== "undefined") {
		context.colorMode.preference =
			localStorage.getItem("nuxt-color-mode") ?? "system";
		context.colorMode.forced = !!payload.pageMeta?.colorMode;
		const applyTheme = () => {
			context.colorMode.value =
				!payload.pageMeta?.colorMode &&
				context.colorMode.preference === "system"
					? matchMedia("(prefers-color-scheme: dark)").matches
						? "dark"
						: "light"
					: (payload.pageMeta?.colorMode ?? context.colorMode.preference);
			document.documentElement.classList.remove("light", "dark");
			document.documentElement.classList.add(context.colorMode.value);
			document.documentElement.dataset.bsTheme = context.colorMode.value;
		};
		applyTheme();
		watch(
			() => context.colorMode.preference,
			() => {
				localStorage.setItem("nuxt-color-mode", context.colorMode.preference);
				applyTheme();
			},
		);
	}
	return context;
}
export function islandApp(
	component: Component,
	props: any,
	context: any,
	components: Record<string, Component>,
	slots: Record<string, string> = {},
) {
	const app = createSSRApp({
		setup() {
			provide(contextKey, context);
			return () =>
				h(Suspense, null, {
					default: () =>
						h(
							component,
							props,
							Object.fromEntries(
								Object.entries(slots).map(([name, html]) => [
									name,
									() =>
										createStaticVNode(
											html,
											typeof document === "undefined"
												? 1
												: staticNodeCount(html),
										),
								]),
							),
						),
				});
		},
	});
	app.config.throwUnhandledErrorInProduction = true;
	runtimeConfig.public.locales = context.locales;
	app.config.globalProperties.$route = context.route;
	for (const [name, value] of Object.entries(components))
		app.component(name, value);
	app.config.globalProperties.$t = (key: string, params?: any) =>
		translate(context.messages, key, params);
	app.config.globalProperties.$n = (value: number) =>
		new Intl.NumberFormat(context.locale.value).format(value);
	app.config.globalProperties.$d = (value: any) =>
		new Intl.DateTimeFormat(context.locale.value).format(value);
	(app as any).$nuxt = { $config: runtimeConfig, _route: context.route };
	return app;
}
function staticNodeCount(html: string) {
	const template = document.createElement("template");
	template.innerHTML = html;
	return template.content.childNodes.length;
}
