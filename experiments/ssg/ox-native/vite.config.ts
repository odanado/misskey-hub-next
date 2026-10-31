import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { oxContentVue } from '@ox-content/vite-plugin-vue';
import { createOxContentCustomHostPlugin } from '@ox-content/vite-plugin';
import { common, markdownCompatibility } from './vite-bridge.mjs';
import { outDir, root, loadPages } from './routes.ts';

export default defineConfig(async () => {
	const pages = await loadPages();
	const [input, output] = markdownCompatibility(root);
	const boundary = {
		name: 'ox-native-boundaries',
		enforce: 'pre' as const,
		resolveId(id: string, importer?: string) {
			if (id === 'virtual:ox-native-documents') return '\0' + id;
			if (id === './ContentRenderer.vue' && importer?.endsWith('/nuxt-compat/registry.ts'))
				return resolve(import.meta.dirname, 'ContentRenderer.vue');
		},
		load(id: string) {
			if (id === '\0virtual:ox-native-documents')
				return (
					'export default {' +
					[...new Set(pages.map((page) => page.source).filter((source) => source?.endsWith('.md')))]
						.map(
							(source) =>
								JSON.stringify(source) +
								':()=>import(' +
								JSON.stringify(resolve(root, 'content', source!)) +
								')',
						)
						.join(',') +
					'};'
				);
		},
	};
	return {
		...common(),
		root,
		publicDir: resolve(root, 'public'),
		plugins: [
			...common().plugins,
			boundary,
			vue(),
			input,
			oxContentVue({
				srcDir: resolve(root, 'content'),
				embeds: false,
				containers: true,
				ssg: false,
				search: false,
				docs: false,
			}),
			output,
			createOxContentCustomHostPlugin({
				host: resolve(import.meta.dirname, 'host.ts'),
				oxContent: {
					srcDir: resolve(root, 'content'),
					outDir,
					docs: false,
					search: false,
					embeds: false,
					highlight: false,
					ssg: { generateOgImage: false, lastUpdated: false, readerChrome: false },
				},
				build: { transformHtml: false },
			}),
		],
		build: {
			outDir,
			emptyOutDir: true,
			manifest: true,
			cssCodeSplit: true,
			rollupOptions: { input: resolve(import.meta.dirname, 'client.ts') },
		},
	};
});
