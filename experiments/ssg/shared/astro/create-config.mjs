import { defineConfig } from 'astro/config';
import vue from '@astrojs/vue';
import uno from 'unocss/astro';
import { resolve } from 'node:path';
import { root, aliases, plugins, unoOptions, cssOptions } from '../../nuxt-compat/vite.mjs';
import { compiler, artifactMode, vueCompiler } from '../compiler.mjs';
export function createAstroConfig({ mode, srcDir }) {
	if (!['astro', 'astro-ox'].includes(mode)) throw new Error('Unknown Astro strategy: ' + mode);
	const artifact = artifactMode(mode);
	const compilerIntegration = {
		name: 'pilot-vue-compiler',
		hooks: {
			'astro:config:setup': async ({ updateConfig }) => {
				if (compiler === 'vize')
					updateConfig({
						vite: { plugins: await vueCompiler({ template: { transformAssetUrls: false } }) },
					});
			},
			'astro:config:done': ({ config }) => {
				if (compiler === 'vize')
					config.vite.plugins = config.vite.plugins
						.flat(Infinity)
						.filter((plugin) => plugin?.name !== 'vite:vue');
			},
		},
	};
	return defineConfig({
		root,
		srcDir,
		output: 'static',
		site: 'https://misskey-hub.net',
		trailingSlash: 'always',
		publicDir: resolve(root, 'public'),
		outDir: resolve(root, `.pilot/${artifact}/public`),
		cacheDir: resolve(root, `.pilot/${artifact}/cache`),
		integrations: [
			vue({ appEntrypoint: resolve(root, 'experiments/ssg/nuxt-compat/registry.ts') }),
			uno({ ...unoOptions(), injectEntry: false }),
			compilerIntegration,
		],
		vite: {
			css: cssOptions(),
			define: { __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: 'true' },
			resolve: {
				alias: aliases,
				dedupe: ['vue', '@vue/runtime-core', '@vue/runtime-dom', '@vue/reactivity'],
			},
			plugins: [
				...plugins(false),
				{
					name: 'port-unocss-environments',
					enforce: 'pre',
					async buildStart() {
						// UnoCSS 66 predates Astro 6's separate prerender/client environments.
						// Rebind its CSS hooks to the active environment rather than a completed
						// prerender environment whose Vite CSS cache has already been disposed.
						const config = this.environment.config;
						const scan = config.plugins.find(
							(plugin) => plugin.name === 'unocss:global:build:scan',
						);
						if (scan?.configResolved) await scan.configResolved(config);
					},
				},
			],
			ssr: { noExternal: ['@nuxtjs/mdc'] },
			logLevel: 'warn',
		},
		build: { format: 'directory', concurrency: 1 },
		devToolbar: { enabled: false },
	});
}
