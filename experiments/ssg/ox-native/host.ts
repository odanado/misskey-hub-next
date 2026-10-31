// Host lifecycle based on PR #2 by ubugeeei; compatibility uses shared wrappers.
import { resolve } from 'node:path';
import { createSSRApp } from 'vue';
import { renderToString } from 'vue/server-renderer';
import type { OxContentCustomHostModule } from '@ox-content/vite-plugin';
import App from './App.vue';
import { configure } from './runtime-bridge.mjs';
import { prepareData, documentHtml } from './data-bridge.mjs';
import { root } from './routes.ts';
export default {
	async routes() {
		const pages = await prepareData('ox-native');
		return pages.map((payload) => ({
			path: payload.path,
			...(payload.source ? { inputPath: resolve(root, 'content', payload.source) } : {}),
			async render(ctx) {
				const markdown = payload.source?.endsWith('.md')
					? ((await ctx.loadModule(resolve(root, 'content', payload.source))) as { default: any })
					: null;
				const app = createSSRApp(App, { payload });
				configure(app);
				if (markdown) app.provide(Symbol.for('ox-native-markdown'), markdown.default);
				const errors: unknown[] = [];
				app.config.errorHandler = (error) => errors.push(error);
				const body = await renderToString(app);
				if (errors.length)
					throw new AggregateError(errors, 'Ox native SSR failed: ' + payload.path);
				const stylesheet = ctx.assets.stylesheets({
					modules: [resolve(root, 'experiments/ssg/ox-native/client.ts')],
				});
				if (!stylesheet.stylesheets.length) throw new Error('Native stylesheet manifest is empty');
				if (stylesheet.diagnostics.length) throw new Error(JSON.stringify(stylesheet.diagnostics));
				const manifest = ctx.assets.clientManifest!;
				const entry = Object.values(manifest).find((entry: any) => entry.isEntry) as any;
				if (!entry) throw new Error('Native client missing');
				return {
					title: payload.document.title,
					html: documentHtml(payload, body, {
						js: '/' + entry.file,
						css: stylesheet.stylesheets.map((style) => style.href),
					}),
				};
			},
		}));
	},
} satisfies OxContentCustomHostModule;
