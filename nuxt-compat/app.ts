import { createSSRApp, createStaticVNode, Suspense, h, provide, type Component } from "vue";
import { contextKey, useSiteContext } from "./injection";
import { runtimeConfig } from "./config";
export function islandApp(
	component: Component,
	props: any,
	context: any,
	components: Record<string, Component>,
	slots: Record<string, string> = {},
) {
	let readyResolve: any;
	const ready = new Promise<void>((resolve) => {
		readyResolve = resolve;
	});
	const app = createSSRApp({
		setup() {
			provide(contextKey, context);
			return () =>
				h(
					Suspense,
					{ onResolve: readyResolve },
					{
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
					},
				);
		},
	});
	app.use(context.i18n);
	(app as any).whenReady = ready;
	app.config.throwUnhandledErrorInProduction = true;
	runtimeConfig.public.locales = context.locales;
	app.config.globalProperties.$route = context.route;
	for (const [name, value] of Object.entries(components))
		app.component(name, value);
	(app as any).$nuxt = { $config: runtimeConfig, _route: context.route };
	return app;
}
function staticNodeCount(html: string) {
	const template = document.createElement("template");
	template.innerHTML = html;
	return template.content.childNodes.length;
}
export const useNuxtApp = () => ({
	isHydrating: !!useSiteContext().isHydrating,
});
export const createError = (error: any) =>
	Object.assign(new Error(error.statusMessage), error);
