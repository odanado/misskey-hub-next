import { defineNuxtModule } from 'nuxt/kit';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { createRequire } from 'node:module';
import { pages, modes } from '../shared/pages.mjs';
import { artifactMode } from '../shared/compiler.mjs';
import { expanded, fullSite } from '../shared/scope.mjs';
import { prepareTimeComponent } from '../nuxt-compat/extended-components.mjs';
import {
	prepareVizeComponents,
	repairVizeCssModuleReferences,
} from '../nuxt-compat/vize-compat.mjs';
import { prepareVizeNuxtStyles } from './vize-nuxt-styles.mjs';

export default defineNuxtModule({
	meta: { name: 'hub-ox-content-pilot' },
	async setup(_, nuxt) {
		const mode = process.env.HUB_CONTENT_PILOT!;
		if (!modes.includes(mode)) throw new Error(`Unknown pilot mode: ${mode}`);
		const root = nuxt.options.rootDir;
		if (process.env.HUB_VUE_COMPILER === 'vize') {
			if (fullSite) {
				// Keep auto-imported router hooks on the ESM entry. The CJS entry
				// otherwise requires Vue's nonexistent ESM default during Nitro SSG.
				const routerEsm = resolve(
					dirname(createRequire(import.meta.url).resolve('vue-router/package.json')),
					'dist/vue-router.mjs',
				);
				nuxt.options.alias['vue-router'] = routerEsm;
				nuxt.hook('imports:extend', (imports) => {
					for (const item of imports)
						if (
							['onBeforeRouteLeave', 'onBeforeRouteUpdate', 'useLink'].includes(item.name) &&
							/(?:^|\/)vue-router(?:\/|$)/.test(item.from)
						)
							item.from = routerEsm;
				});
			}
			if (fullSite) {
				nuxt.options.vite.plugins ??= [];
				nuxt.options.vite.plugins.push({
					name: 'pilot-vize-css-module-render-context',
					enforce: 'post',
					transform(code, id) {
						return repairVizeCssModuleReferences(code, id);
					},
				});
			}
			if (expanded) {
				const time = prepareTimeComponent(root);
				nuxt.options.vite.plugins ??= [];
				nuxt.options.vite.plugins.push({
					name: 'pilot-time-i18n',
					enforce: 'pre',
					resolveId(id) {
						if (id === '#port-time') return time;
					},
					transform(code, id) {
						if (id.endsWith('/components/mk/Mfm.ts'))
							return code.replace('@/components/mk/Time.vue', '#port-time');
					},
				});
			}
			const aliases = { ...prepareVizeComponents(root), ...prepareVizeNuxtStyles(root) };
			nuxt.hook('components:extend', (components) => {
				for (const component of components)
					if (aliases[component.filePath]) component.filePath = aliases[component.filePath];
			});
			nuxt.hook('app:resolve', (app) => {
				for (const layout of Object.values(app.layouts))
					if (aliases[layout.file]) layout.file = aliases[layout.file];
			});
		}
		if (process.env.HUB_VUE_COMPILER === 'vize')
			nuxt.hook('vite:configResolved', (config) => {
				if (!config.plugins.flat(Infinity).some((plugin) => plugin?.name === 'vite-plugin-vize'))
					throw new Error('Vize compiler missing');
				console.log('[pilot-compiler] vize: Nuxt transform bridge, native SFC compiler');
			});
		const artifact = artifactMode(mode);
		nuxt.options.plugins.push(resolve(root, 'experiments/ssg/nuxt-pilot/ready.ts'));
		const generated = resolve(root, '.pilot/generated');
		mkdirSync(generated, { recursive: true });
		// Identical route scope, cache policy and prerender settings for every Nuxt variant.
		nuxt.options.routeRules = {};
		nuxt.options.nitro.prerender = {
			routes: pages.map((page) => page.path),
			crawlLinks: false,
			failOnError: true,
			concurrency: 1,
			ignore: [
				(route) =>
					!pages.some((page) => route === page.path || route === `${page.path}_payload.json`) &&
					!['/api/', '/__nuxt_island/', '/_i18n/'].some((prefix) => route.startsWith(prefix)),
			],
		};
		nuxt.options.nitro.output = {
			dir: resolve(root, `.pilot/${artifact}/output`),
			publicDir: resolve(root, `.pilot/${artifact}/public`),
		};
		if (mode === 'baseline') return;
		const { generateCollectionsVirtualModule, resolveCollectionsOptions } = await import(
			'@ox-content/vite-plugin'
		);
		const collections = await generateCollectionsVirtualModule(root, {
			srcDir: 'content',
			extensions: ['md'],
			frontmatter: true,
			collections: resolveCollectionsOptions({
				pilot: { source: pages.map((p) => p.source), include: ['body'] },
			}),
		} as any);
		writeFileSync(resolve(generated, 'collections.mjs'), collections);
		nuxt.options.nitro.alias ??= {};
		nuxt.options.nitro.alias['#pilot-collections'] = resolve(generated, 'collections.mjs');
		const contentRequire = createRequire(createRequire(import.meta.url).resolve('@nuxt/content'));
		const mdcDist = dirname(contentRequire.resolve('@nuxtjs/mdc'));
		nuxt.options.nitro.alias['#pilot-mdc-compiler'] = resolve(
			mdcDist,
			'runtime/parser/compiler.js',
		);
		nuxt.options.nitro.alias['#pilot-mdc-toc'] = resolve(mdcDist, 'runtime/parser/toc.js');
		nuxt.options.nitro.alias['#pilot-path-meta'] = resolve(
			dirname(createRequire(import.meta.url).resolve('@nuxt/content')),
			'runtime/transformers/path-meta.js',
		);
		nuxt.options.nitro.handlers ??= [];
		nuxt.options.nitro.handlers.push({
			route: '/api/ox-pilot/**',
			handler: resolve(root, 'experiments/ssg/nuxt-pilot/server.ts'),
		});
		nuxt.options.nitro.prerender.routes!.push(
			...pages.map((p) => `/api/ox-pilot${p.path.replace(/\/$/, '')}.json`),
		);
		// Transform the real page in place so its CSS module identity stays identical.
		// The plugin is absent in normal builds, and falls back outside the four routes.
		nuxt.options.vite.plugins ??= [];
		nuxt.options.vite.plugins.push({
			name: 'hub-pilot-page-query',
			enforce: 'pre',
			transform(code, id) {
				if (id.includes('?') || !id.endsWith('/pages/docs/[...slug].vue')) return;
				const query =
					"queryContent<MiDocsParsedContent>(`/${locale.value === 'ja-ks' ? 'ja' : locale.value}/docs/${slugs.join('/')}`).findOne()";
				if (!code.includes(query))
					throw new Error('Pilot query replacement no longer matches the docs page');
				const paths = JSON.stringify(pages.map((p) => p.path.replace(/\/$/, '')));
				const path = "`/${locale.value === 'ja-ks' ? 'ja' : locale.value}/docs/${slugs.join('/')}`";
				return code.replace(
					query,
					`(${paths}.includes(${path}) ? $fetch<MiDocsParsedContent>('/api/ox-pilot' + ${path} + '.json') : ${query})`,
				);
			},
		});
		nuxt.options.runtimeConfig.pilotMode = mode;
	},
});
