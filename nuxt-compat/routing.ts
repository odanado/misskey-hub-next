import { createRouter, createMemoryHistory } from "vue-router";
import { useSiteContext } from "./injection";
export const useRoute = () => useSiteContext().route;
export const useRouter = () => {
	const context = useSiteContext();
	const router = createRouter({
		history: createMemoryHistory(),
		routes: [
			{
				path: "/:locale/docs/:slug(.*)*",
				name: "docs___" + context.locale.value,
				component: {},
			},
		],
	});
	return {
		resolve: (href: string) =>
			router.resolve(href, router.resolve(context.route.path)),
		push: (href: string) => {
			if (typeof window !== "undefined") window.location.href = href;
		},
	};
};
export const onBeforeRouteLeave = (_handler: any) => {};
export const navigateTo = (path: string) => useRouter().push(path);
