<script setup lang="ts">
import { getCurrentInstance, provide, reactive, ref, onMounted, watch, nextTick } from 'vue';
import DocsLayout from '#port-docs-layout';
import FullSurface from '#port-full-surface';
import DocsPage from '../../../pages/docs/[...slug].vue';
import TopIco from 'bi/chevron-up.svg';
import { contextKey, runtimeConfig, translate } from './runtime';
import { configure } from './registry';
const props = defineProps<{ payload: any }>();
const payload = props.payload;
const app = getCurrentInstance()!.appContext.app;
configure(app);
runtimeConfig.public.locales = payload.locales;
const path = payload.path;
const activeLocale = payload.locale ?? path.split('/')[1];
const colorMode = reactive({ preference: 'system', value: 'light', forced: false });
if (import.meta.env.SSR === false) {
	colorMode.preference = localStorage.getItem('nuxt-color-mode') ?? 'system';
	colorMode.value =
		colorMode.preference === 'system'
			? matchMedia('(prefers-color-scheme: dark)').matches
				? 'dark'
				: 'light'
			: colorMode.preference;
}
const scrollPos = ref(0);
const context = {
	...payload,
	locale: ref(activeLocale),
	route: reactive({
		path,
		fullPath: path,
		query: {},
		params: {
			slug:
				payload.kind === 'blog'
					? path.split('/').filter(Boolean).at(-1)
					: path.split('/').slice(3).filter(Boolean),
		},
		meta: {},
	}),
	state: { miHub_global_scrollPos: scrollPos },
	colorMode,
};
provide(contextKey, context);
app.config.globalProperties.$n = (value: any) =>
	new Intl.NumberFormat(
		payload.locales.find((l: any) => l.code === activeLocale)?.language ?? 'ja-JP',
	).format(value);
app.config.globalProperties.$d = (value: any) =>
	new Intl.DateTimeFormat(activeLocale === 'ja-ks' ? 'ja' : activeLocale).format(value);
app.config.globalProperties.$t = (key: string, params?: Record<string, unknown>) =>
	translate(payload.messages, key, params);
(app as any).$nuxt = { $config: runtimeConfig, _route: context.route };
watch(
	() => colorMode.preference,
	(preference) => {
		colorMode.value =
			preference === 'system'
				? matchMedia('(prefers-color-scheme: dark)').matches
					? 'dark'
					: 'light'
				: preference;
		localStorage.setItem('nuxt-color-mode', preference);
		document.documentElement.classList.remove('light', 'dark');
		document.documentElement.classList.add(colorMode.value);
		document.documentElement.dataset.bsTheme = colorMode.value;
	},
);
onMounted(async () => {
	document.documentElement.dataset.pilotMounted = 'true';
	window.addEventListener(
		'scroll',
		() => {
			scrollPos.value = document.body.getBoundingClientRect().y;
		},
		{ passive: true },
	);
	await nextTick();
	const ready = () => {
		if (document.querySelector('.markdown-body h1'))
			document.documentElement.dataset.pilotReady = 'true';
		else requestAnimationFrame(ready);
	};
	ready();
});
function scrollToTop() {
	window.scrollTo({ top: 0, behavior: 'smooth' });
}
</script>
<template>
	<div>
		<noscript
			class="block bg-accent-800 text-white text-center py-1.5 px-3 keep-all relative z-[10005]"
			>Please turn on Javascript from your browser settings.</noscript
		>
		<Suspense
			><FullSurface v-if="payload.fullSite" /><DocsLayout v-else><DocsPage /></DocsLayout
		></Suspense>
		<button
			class="_plainButton"
			:class="[
				scrollPos <= -45 ? 'opacity-75 hover:opacity-100' : 'opacity-0 pointer-events-none',
				$style.scrollToTopButton,
			]"
			@click="scrollToTop"
		>
			<TopIco style="width: 20px; height: 20px" />
		</button>
	</div>
</template>
<style module>
.scrollToTopButton {
	display: grid;
	place-content: center;
	position: fixed;
	z-index: 9999;
	bottom: 32px;
	right: 32px;
	width: 50px;
	height: 50px;
	border-radius: 100%;
	background: #9ad11b;
	color: #000;
}
</style>
