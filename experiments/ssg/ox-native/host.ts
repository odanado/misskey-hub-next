import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createSSRApp, h } from 'vue';
import { renderToString } from 'vue/server-renderer';
import type { OxContentCustomHostModule } from '@ox-content/vite-plugin';
import App from './App.vue';
import { loadCatalogue, root, type PageView } from './routes.ts';

export default {
	async routes(ctx) {
		const catalogue = await ctx.memo('catalogue', loadCatalogue);
		if (ctx.mode === 'build')
			await writeFile(
				resolve(ctx.outDir, 'coverage.json'),
				JSON.stringify(catalogue, null, 2) + '\n',
			);
		return catalogue.pages.map((page) => ({
			path: page.path,
			...(page.source
				? { inputPath: resolve(root, 'content', page.source) }
				: {}),
			async render(route) {
				const source = page.source;
				const document =
					(page.kind === 'markdown' || page.kind === 'guide') && source
						? await ctx.memo(source, async () => {
								const documentPath = resolve(root, 'content', source);
								return ctx.markdown.render({
									source: page.body ?? (await readFile(documentPath, 'utf8')),
									documentPath,
								});
							})
						: undefined;
				const prefix =
					page.kind === 'home' ? '/' : page.path.replace(/[^/]+\/$/, '');
				const navigation = catalogue.pages.filter(
					(entry) =>
						entry.path !== page.path &&
						entry.path.startsWith(page.kind === 'section' ? page.path : prefix),
				);
				const view: PageView = { page, body: document?.html ?? '', navigation };
				// Nuxt Content resolves relative article links from the source's directory,
				// whereas the public route ends with a slash. Preserve that convention.
				view.body = view.body.replace(
					/(<a\b[^>]*\bhref=")([^"#/:][^"]*)(")/g,
					(_match: string, before: string, href: string, after: string) => {
						if (/^[a-z][a-z\d+.-]*:/i.test(href) || href.startsWith('?'))
							return before + href + after;
						const url = new URL(
							href,
							'https://reference.invalid' + page.path.replace(/[^/]+\/$/, ''),
						);
						if (!/\.[^/]+$/.test(url.pathname) && !url.pathname.endsWith('/'))
							url.pathname += '/';
						return before + url.pathname + url.search + url.hash + after;
					},
				);
				const app = createSSRApp({ render: () => h(App, view) });
				const errors: unknown[] = [];
				app.config.errorHandler = (error) => errors.push(error);
				const body = await renderToString(app);
				if (errors.length)
					throw new AggregateError(errors, 'Vue SSR failed: ' + page.path);
				const assets = route.assets.document({ clientEntries: ['client.ts'] });
				const escape = (value: string) =>
					value.replace(
						/[&<>"']/g,
						(char) =>
							({
								'&': '&amp;',
								'<': '&lt;',
								'>': '&gt;',
								'"': '&quot;',
								"'": '&#39;',
							})[char]!,
					);
				return {
					title: page.title,
					html: `<!DOCTYPE html><html lang="${escape(page.locale)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(page.title)} · Ox Content</title>${assets.headHtml}</head><body>${body}</body></html>`,
				};
			},
		}));
	},
} satisfies OxContentCustomHostModule;
