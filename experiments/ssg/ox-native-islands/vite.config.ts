import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { oxContentVue } from '@ox-content/vite-plugin-vue';
import { createOxContentCustomHostPlugin } from '@ox-content/vite-plugin';
import { outDir, root } from './routes.ts';

export default defineConfig({
	root: import.meta.dirname,
	publicDir: resolve(root, 'public'),
	plugins: [
		vue(),
		oxContentVue({
			srcDir: resolve(root, 'content'),
			embeds: false,
			containers: true,
		}),
		createOxContentCustomHostPlugin({
			host: resolve(import.meta.dirname, 'host.ts'),
			oxContent: {
				srcDir: resolve(root, 'content'),
				outDir,
				docs: false,
				search: false,
				embeds: false,
				highlight: false,
				containers: true,
				ssg: {
					generateOgImage: false,
					lastUpdated: false,
					readerChrome: false,
				},
			},
			build: { transformHtml: false },
		}),
	],
	build: {
		outDir,
		emptyOutDir: true,
		manifest: true,
		rollupOptions: { input: resolve(import.meta.dirname, 'App.vue') },
	},
});
