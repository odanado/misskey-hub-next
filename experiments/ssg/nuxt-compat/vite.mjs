import { resolve, dirname } from 'node:path';
import { createRequire } from 'node:module';
import { readdirSync } from 'node:fs';
import { createUnimport } from 'unimport';
import unocss from 'unocss/vite';
import svgLoader from 'vite-svg-loader';
import { compiler } from '../shared/compiler.mjs';
import { expanded, fullSite } from '../shared/scope.mjs';
import { prepareTimeComponent } from './extended-components.mjs';
import { prepareVizeComponents, repairVizeCssModuleReferences } from './vize-compat.mjs';
const require = createRequire(import.meta.url);
export const root = resolve(import.meta.dirname, '../../..');
const contentDist = dirname(require.resolve('@nuxt/content'));
const mdcDist = dirname(require.resolve('@nuxtjs/mdc'));
const runtime = resolve(root, 'experiments/ssg/nuxt-compat/runtime.ts');
const vueNames = [
	'ref',
	'shallowRef',
	'reactive',
	'computed',
	'watch',
	'watchEffect',
	'onMounted',
	'onUnmounted',
	'onBeforeMount',
	'onBeforeUnmount',
	'nextTick',
	'useTemplateRef',
	'onDeactivated',
	'onActivated',
	'useId',
	'unref',
	'toRef',
	'toRefs',
	'onServerPrefetch',
	'provide',
	'inject',
	'toRaw',
	'markRaw',
	'shallowReactive',
	'readonly',
];
const runtimeNames = [
	'useState',
	'useRoute',
	'useRouter',
	'useRuntimeConfig',
	'useI18n',
	'useColorMode',
	'useGLocalePath',
	'useGSwitchLocalePath',
	'useGAsyncData',
	'queryContent',
	'fetchContentNavigation',
	'useHead',
	'definePageMeta',
	'createError',
	'useScrollspy',
	'useNuxtApp',
	'useAppConfig',
	'defineAppConfig',
	'defineI18nRoute',
	'onBeforeRouteLeave',
	'navigateTo',
	'useFetch',
];
export const unoOptions = () => ({
	configFile: resolve(root, 'uno.config.ts'),
	content: {
		filesystem: [
			resolve(root, 'components/**/*.vue'),
			resolve(root, 'layouts/**/*.vue'),
			resolve(root, 'pages/**/*.vue'),
			resolve(root, 'experiments/ssg/**/*.vue'),
		],
	},
});
export function plugins(includeUno = true) {
	const imports = createUnimport({
		imports: [...vueNames, ...runtimeNames].map((name) => ({ name, from: runtime })),
	});
	return [
		{
			name: 'port-nuxt-boundaries',
			enforce: 'pre',
			resolveId(id) {
				if (fullSite && id === '#components') return '\0virtual:port-full-components';
				if (id === '#port-full-surface')
					return resolve(
						root,
						'experiments/ssg/nuxt-compat/' + (fullSite ? 'FullSurface.vue' : 'EmptySurface.vue'),
					);
				if (id === 'virtual:port-full-components') return '\0' + id;
				if (id === '#port-time') return timeComponent;
				if (id === '#port-nav' || id === '#port-docs-layout') {
					const file = resolve(
						root,
						id === '#port-nav' ? 'components/g/Nav.vue' : 'layouts/docs.vue',
					);
					return vizeAliases[file] ?? file;
				}
				if (id === '#imports') return runtime;
				if (id === 'virtual:port-prose') return '\0' + id;
			},
			load(id) {
				if (id === '\0virtual:port-full-components')
					return fullSite
						? readdirSync(resolve(root, 'components'), { recursive: true })
								.filter((file) => file.endsWith('.vue'))
								.map((file) => {
									const name = file
										.replace(/(?:\.(?:client|server))?\.vue$/, '')
										.split(/[\/\-]/)
										.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
										.join('');
									return `export {default as ${name}} from ${JSON.stringify(resolve(root, 'components', file))};`;
								})
								.join('\n')
						: '';
				if (id !== '\0virtual:port-prose') return;
				const prose = resolve(mdcDist, 'runtime/components/prose');
				const files = readdirSync(prose).filter(
					(file) =>
						file.endsWith('.vue') &&
						!['ProseA.vue', 'ProseImg.vue', 'ProseTable.vue'].includes(file),
				);
				const entries = files.map((file) => [file.slice(0, -4), resolve(prose, file)]);
				for (const name of ['ProsePre', 'ProseCode', 'ProseCodeInline']) {
					const entry = [name, resolve(contentDist, `runtime/components/Prose/${name}.vue`)];
					const index = entries.findIndex((e) => e[0] === name);
					if (index >= 0) entries[index] = entry;
					else entries.push(entry);
				}
				return entries
					.map(([name, file]) => `export { default as ${name} } from ${JSON.stringify(file)};`)
					.join('\n');
			},
			async transform(source, id) {
				if (
					id.includes('?') ||
					!/\.(vue|ts|js)$/.test(id) ||
					id === runtime ||
					(id.includes('/node_modules/') && !id.endsWith('.vue'))
				)
					return;
				let code = (
					expanded && id.endsWith('/components/mk/Mfm.ts')
						? source.replace('@/components/mk/Time.vue', '#port-time')
						: source
				)
					.replaceAll('import.meta.client', '(!import.meta.env.SSR)')
					.replaceAll('import.meta.server', 'import.meta.env.SSR')
					// Astro also handles .svg imports. Keep these original Vue icons on
					// vite-svg-loader's explicit component path.
					.replace(/((?:from|import)\s*['"][^'"]+\.svg)(['"])/g, '$1?component$2');
				if (id.endsWith('.vue')) {
					const match = /<script\b[^>]*>([\s\S]*?)<\/script>/.exec(code);
					if (!match) return code;
					const injected = await imports.injectImports(match[1]);
					return code.replace(match[0], match[0].replace(match[1], injected.code));
				}
				return (await imports.injectImports(code)).code;
			},
		},
		...(compiler === 'vize'
			? [
					{
						name: 'port-vize-boundaries',
						enforce: 'post',
						configResolved(config) {
							if (!config.plugins.some((plugin) => plugin.name === 'vite-plugin-vize'))
								throw new Error('Vize compiler missing');
							console.log('[pilot-compiler] vize: native SFC compiler with port boundary imports');
						},
						async transform(source, id) {
							if (!id.includes('.vue') || /(?:style|\.css)(?:\?|$)/.test(id)) return;
							if (fullSite) source = repairVizeCssModuleReferences(source, id);
							const code = source
								.replaceAll('import.meta.client', '(!import.meta.env.SSR)')
								.replaceAll('import.meta.server', 'import.meta.env.SSR')
								.replace(/((?:from|import)\s*['"][^'"]+\.svg)(['"])/g, '$1?component$2');
							return (await imports.injectImports(code)).code;
						},
					},
				]
			: []),
		...(includeUno ? [unocss(unoOptions())] : []),
		svgLoader({
			defaultImport: 'component',
			svgoConfig: {
				plugins: [{ name: 'preset-default', params: { overrides: { removeViewBox: false } } }],
			},
		}),
	];
}
const timeComponent = expanded ? prepareTimeComponent(root) : null;
const vizeAliases = compiler === 'vize' ? prepareVizeComponents(root) : {};
export const aliases = {
	'@': root,
	'~': root,
	assets: resolve(root, 'assets'),
	'#imports': runtime,
	bi: resolve(root, 'node_modules/bootstrap-icons/icons'),
};
export const common = () => ({
	root,
	configFile: false,
	resolve: {
		alias: aliases,
		dedupe: ['vue', '@vue/runtime-core', '@vue/runtime-dom', '@vue/reactivity'],
	},
	plugins: plugins(),
	define: { __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: 'true' },
	logLevel: 'warn',
	server: { middlewareMode: true, hmr: false, ws: false, watch: null },
	ssr: { noExternal: ['@nuxtjs/mdc'] },
});
