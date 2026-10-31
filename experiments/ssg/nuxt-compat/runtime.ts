import MDC from './FullMDC.vue';
export { MDC };
import appConfig from '../../../app.config';
import packageJson from '../../../package.json';
import { createRouter, createMemoryHistory } from 'vue-router';
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
} from 'vue';
export * from 'vue';
import { useScrollspy } from '../../../composables/useScrollSpy';
export { useScrollspy };
export const contextKey = Symbol.for('misskey-hub-port');
export const usePortContext = () => inject<any>(contextKey)!;
export const runtimeConfig = {
	app: { baseURL: '/' },
	public: {
		misskeyJsVersion: packageJson.devDependencies['misskey-js'],
		baseUrl: 'https://misskey-hub.net',
		repositoryUrl: 'https://github.com/misskey-dev/misskey-hub-next',
		locales: [],
		mdc: {
			components: { prose: true, map: { code: 'ProseCodeInline' } },
			headings: { anchorLinks: { h1: false, h2: true, h3: true, h4: true, h5: false, h6: false } },
		},
	},
};
export const useRuntimeConfig = () => runtimeConfig;
export const useRoute = () => usePortContext().route;
export const useRouter = () => {
	const context = usePortContext();
	const router = createRouter({
		history: createMemoryHistory(),
		routes: [
			{ path: '/:locale/docs/:slug(.*)*', name: 'docs___' + context.locale.value, component: {} },
		],
	});
	return {
		resolve: (href: string) => router.resolve(href, router.resolve(context.route.path)),
		push: (href: string) => {
			if (typeof window !== 'undefined') window.location.href = href;
		},
	};
};
export function useState<T>(key: string, init?: () => T) {
	const context = usePortContext();
	return (context.state[key] ??= ref(init?.()));
}
export function translate(messages: any, key: string, params?: Record<string, unknown>) {
	const value = key.split('.').reduce((value, part) => value?.[part], messages) ?? key;
	return typeof value === 'string' && params
		? value.replace(/\{(\w+)\}/g, (match, name) => String(params[name] ?? match))
		: value;
}
export const useI18n = () => {
	const context = usePortContext();
	return {
		locale: context.locale,
		t: (key: string, params?: Record<string, unknown>) => translate(context.messages, key, params),
	};
};
export const useColorMode = () => usePortContext().colorMode;
export const useGLocalePath = () => {
	const context = usePortContext();
	return (path: string) => {
		if (/^https?:|^x-mi-web:|^\/(ja|en|id|ko|it|pl|fr|th|es|de|cn|tw|ja-ks)\//.test(path))
			return path;
		// Nuxt i18n resolves a route object: query slashes are readable, while
		// an already encoded hash is encoded again. Retain the original URLs.
		const [base, hash] = path.split('#');
		const normalized = base.includes('?') ? decodeURIComponent(base.replace('/?', '?')) : base;
		return `/${context.locale.value}${normalized.startsWith('/') ? normalized : '/' + normalized}${hash === undefined ? '' : '#' + encodeURI(hash)}`;
	};
};
export const useGSwitchLocalePath = () => {
	const context = usePortContext();
	return (locale: string) => context.route.path.replace(/^\/[a-z-]+\//, `/${locale}/`);
};
export const useGAsyncData = async (_key: string, fn: () => any) => ({ data: ref(await fn()) });
export const queryContent = (...args: any[]) => {
	const context = usePortContext();
	const query = {
		path: args[0],
		where: () => query,
		only: () => query,
		sort: () => query,
		find: async () => context.related ?? [],
		findOne: async () => context.document,
		findSurround: async () => context.surround,
	};
	return query;
};
export const fetchContentNavigation = async (_query: unknown) => usePortContext().navigation;
export const useHead = (_head: unknown) => {};
export const definePageMeta = (_meta: unknown) => {};
export const createError = (error: any) => Object.assign(new Error(error.statusMessage), error);

export const NuxtLink = defineComponent({
	inheritAttrs: false,
	props: ['to', 'href', 'target'],
	setup(props, { attrs, slots }) {
		const context = usePortContext();
		return () => {
			const raw = props.to ?? props.href;
			let href = raw;
			if (typeof raw === 'string' && !raw.startsWith('/') && !/^[a-z][a-z+.-]*:/i.test(raw)) {
				const url = new URL(raw, 'https://misskey-hub.net' + context.route.path);
				href = url.pathname + url.search + url.hash;
			}
			return h(
				'a',
				{
					...attrs,
					href,
					target: props.target,
					rel:
						attrs.rel ??
						(props.target === '_blank' || /^https?:\/\//.test(href)
							? 'noopener noreferrer'
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
	props: ['keypath', 'tag', 'scope'],
	setup(props, { slots }) {
		const { t } = useI18n();
		return () =>
			h(
				props.tag ?? 'span',
				null,
				String(t(props.keypath))
					.split(/(\{[^}]+\})/)
					.flatMap((part) =>
						part.startsWith('{') ? (slots[part.slice(1, -1)]?.() ?? []) : [part],
					),
			);
	},
});

export const ContentNavigation = defineComponent({
	props: ['query'],
	setup(props, { slots }) {
		const context = usePortContext();
		return () => {
			const base = props.query?.path?.replace(/\/$/, '');
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
export const useNuxtApp = () => ({ isHydrating: false });
export const defineI18nRoute = (_options: any) => {};
export const onBeforeRouteLeave = (_handler: any) => {};
export const navigateTo = (path: string) => useRouter().push(path);

const fetchPromises = new Map<string, Promise<any>>();
export async function useFetch(url: string) {
	let promise = fetchPromises.get(url);
	if (!promise) {
		promise = fetch(url, { signal: AbortSignal.timeout(15000) }).then((response) => {
			if (!response.ok) throw new Error('Full SSG fetch ' + response.status + ' ' + url);
			return response.json();
		});
		fetchPromises.set(url, promise);
	}
	return { data: ref(await promise), pending: ref(false), error: ref(null) };
}
