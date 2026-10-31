import { defineComponent, h, Suspense, nextTick } from "vue";
import { createContext, islandApp } from "./context";
import { components, resolveComponent } from "./registry";
export async function createPage(payload: any) {
	const context = createContext(payload),
		Page = await resolveComponent("Page:" + payload.pageFile),
		Layout = await resolveComponent(
			"Layout:" + (payload.pageMeta?.layout ?? "default"),
		);
	context.isHydrating = true;
	const root = defineComponent({
		setup: () => () =>
			h(
				Suspense,
				{
					onResolve: () => {
						context.isHydrating = false;
					},
				},
				{ default: () => h(Layout, null, { default: () => h(Page) }) },
			),
	});
	const app = islandApp(root, {}, context, components),
		errors: unknown[] = [];
	app.config.errorHandler = (error) => errors.push(error);
	app.config.globalProperties.$route = context.route;
	return { app, context, errors };
}
