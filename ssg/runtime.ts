declare const __HUB_PUBLIC_CONFIG__: {
	baseUrl: string;
	serverListApiBaseUrl: string;
};
import MDC from "./FullMDC.vue";
export { MDC };
import appConfig from "../app.config";
import packageJson from "../package.json";
import { createRouter, createMemoryHistory } from "vue-router";
import {
	computed,
	defineComponent,
	getCurrentInstance,
	h,
	inject,
	onMounted,
	reactive,
	ref,
	watch,
} from "vue";
export * from "vue";
import { useScrollspy } from "../composables/useScrollSpy";
export { useScrollspy };
export const contextKey = Symbol.for("misskey-hub");
export const useSiteContext = () => inject<any>(contextKey)!;
export const runtimeConfig = {
	app: { baseURL: "/" },
	public: {
		misskeyJsVersion: packageJson.devDependencies["misskey-js"],
		...__HUB_PUBLIC_CONFIG__,
		repositoryUrl: "https://github.com/misskey-dev/misskey-hub-next",
		locales: [],
		mdc: {
			components: { prose: true, map: { code: "ProseCodeInline" } },
			headings: {
				anchorLinks: {
					h1: false,
					h2: true,
					h3: true,
					h4: true,
					h5: false,
					h6: false,
				},
			},
		},
	},
};
export const useRuntimeConfig = () => runtimeConfig;
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
export function useState<T>(key: string, init?: () => T) {
	const context = useSiteContext();
	return (context.state[key] ??= ref(init?.()));
}
export function translate(
	messages: any,
	key: string,
	params?: Record<string, unknown>,
) {
	const value =
		key.split(".").reduce((value, part) => value?.[part], messages) ?? key;
	return typeof value === "string" && params
		? value.replace(/\{(\w+)\}/g, (match, name) =>
				String(params[name] ?? match),
			)
		: value;
}
export const useI18n = () => {
	const context = useSiteContext();
	return {
		locale: context.locale,
		t: (key: string, params?: Record<string, unknown>) =>
			translate(context.messages, key, params),
	};
};
export const useColorMode = () => useSiteContext().colorMode;
export const useGLocalePath = () => {
	const context = useSiteContext();
	return (path: string, targetLocale?: any) => {
		if (
			/^https?:|^x-mi-web:|^\/(ja|en|id|ko|it|pl|fr|th|es|de|cn|tw|ja-ks)\//.test(
				path,
			)
		)
			return path;
		// Nuxt i18n resolves a route object: query slashes are readable, while
		// an already encoded hash is encoded again. Retain the original URLs.
		const [base, hash] = path.split("#");
		const normalized = base.includes("?")
			? decodeURIComponent(base.replace("/?", "?"))
			: base;
		const locale = /^\/blog(?:\/|\?|$)/.test(normalized)
			? "ja"
			: (targetLocale?.value ?? targetLocale ?? context.locale.value);
		return `/${locale}${normalized.startsWith("/") ? normalized : "/" + normalized}${hash === undefined ? "" : "#" + encodeURI(hash)}`;
	};
};
export const useGSwitchLocalePath = () => {
	const context = useSiteContext();
	return (locale: string) =>
		context.route.path.startsWith("/ja/blog/")
			? context.route.path
			: context.route.path.replace(/^\/[a-z-]+\//, `/${locale}/`);
};
export const useGAsyncData = async (key: string, fn: () => any) => {
	const c = useSiteContext();
	c.asyncData ??= {};
	if (!Object.prototype.hasOwnProperty.call(c.asyncData, key))
		c.asyncData[key] = await fn();
	return { data: ref(c.asyncData[key]) };
};
export const queryContent = (...args: any[]) => {
	const context = useSiteContext(),
		filters: any[] = [];
	let fields: string[] | undefined, order: any;
	const query: any = {
		path: args[0],
		where: (value: any) => {
			filters.push(value);
			return query;
		},
		only: (value: string[]) => {
			fields = value;
			return query;
		},
		sort: (value: any) => {
			order = value;
			return query;
		},
	};
	const matches = (item: any, filter: any) =>
		Object.entries(filter).every(([key, value]: any) => {
			const actual = item[key];
			if (value && typeof value === "object") {
				if ("$eq" in value) return actual === value.$eq;
				if ("$ne" in value) return actual !== value.$ne;
				if ("$in" in value) return value.$in.includes(actual);
			}
			return actual === value;
		});
	query.find = async () => {
		let items = [...(context.related ?? [])].filter(
			(item) =>
				(!query.path ||
					item._path === query.path ||
					item._path?.startsWith(query.path.replace(/\/$/, "") + "/")) &&
				filters.every((filter) => matches(item, filter)),
		);
		if (order)
			items.sort((a, b) => {
				for (const [key, direction] of Object.entries(order)) {
					const result = String(a[key] ?? "").localeCompare(
						String(b[key] ?? ""),
					);
					if (result) return result * Number(direction);
				}
				return 0;
			});
		return fields
			? items.map((item) =>
					Object.fromEntries(
						fields.filter((key) => key in item).map((key) => [key, item[key]]),
					),
				)
			: items;
	};
	query.findOne = async () => context.document;
	query.findSurround = async () => context.surround;
	return query;
};
export const fetchContentNavigation = async (_query: unknown) =>
	useSiteContext().navigation;
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
export const createError = (error: any) =>
	Object.assign(new Error(error.statusMessage), error);

export const NuxtLink = defineComponent({
	inheritAttrs: false,
	props: ["to", "href", "target"],
	setup(props, { attrs, slots }) {
		const context = useSiteContext();
		return () => {
			const raw = props.to ?? props.href;
			let href = raw;
			if (
				typeof raw === "string" &&
				!raw.startsWith("/") &&
				!/^[a-z][a-z+.-]*:/i.test(raw)
			) {
				const url = new URL(
					raw,
					"https://misskey-hub.net" + context.route.path,
				);
				href = url.pathname + url.search + url.hash;
			}
			return h(
				"a",
				{
					...attrs,
					href,
					target: props.target,
					rel:
						attrs.rel ??
						(props.target === "_blank" || /^https?:\/\//.test(href)
							? "noopener noreferrer"
							: undefined),
				},
				slots.default?.(),
			);
		};
	},
});
export const ClientOnly = defineComponent({
	setup(_props, { slots }) {
		const mounted = ref(false);
		onMounted(() => {
			mounted.value = true;
		});
		return () => (mounted.value ? slots.default?.() : null);
	},
});
export const I18nT = defineComponent({
	props: ["keypath", "tag", "scope"],
	setup(props, { slots }) {
		const { t } = useI18n();
		return () =>
			h(
				props.tag ?? "span",
				null,
				String(t(props.keypath))
					.split(/(\{[^}]+\})/)
					.flatMap((part) =>
						part.startsWith("{")
							? (slots[part.slice(1, -1)]?.() ?? [])
							: [part],
					),
			);
	},
});

export const ContentNavigation = defineComponent({
	props: ["query"],
	setup(props, { slots }) {
		const context = useSiteContext();
		return () => {
			const base = props.query?.path?.replace(/\/$/, "");
			const filter = (nodes: any[]): any[] =>
				nodes
					.filter((node) => node._path !== base || node.children)
					.map((node) => ({
						...node,
						...(node.children ? { children: filter(node.children) } : {}),
					}));
			return slots.default?.({
				navigation: base ? filter(context.navigation) : context.navigation,
			});
		};
	},
});

export function defineAppConfig(config: any) {
	return config;
}
export const useAppConfig = () => appConfig;
export const useNuxtApp = () => ({
	isHydrating: !!useSiteContext().isHydrating,
});
export const defineI18nRoute = (_options: any) => {};
export const onBeforeRouteLeave = (_handler: any) => {};
export const navigateTo = (path: string) => useRouter().push(path);

const fetchPromises = new Map<string, Promise<any>>();
export async function useFetch(url: string) {
	const context = useSiteContext();
	context.fetchCache ??= {};
	if (Object.prototype.hasOwnProperty.call(context.fetchCache, url))
		return {
			data: ref(context.fetchCache[url]),
			pending: ref(false),
			error: ref(null),
		};
	let promise = fetchPromises.get(url);
	if (!promise) {
		promise = fetch(url, { signal: AbortSignal.timeout(15000) }).then(
			(response) => {
				if (!response.ok)
					throw new Error("Full SSG fetch " + response.status + " " + url);
				return response.json();
			},
		);
		fetchPromises.set(url, promise);
	}
	context.fetchCache[url] = await promise;
	return {
		data: ref(context.fetchCache[url]),
		pending: ref(false),
		error: ref(null),
	};
}
