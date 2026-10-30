import { resolve } from 'node:path';
import { createSSRApp, h, type Component } from 'vue';
import { renderToString } from 'vue/server-renderer';
import type { OxContentCustomHostModule } from '@ox-content/vite-plugin';
import App from './App.vue';
import { loadPages, root } from './routes.ts';

interface MarkdownModule {
	default: Component;
	frontmatter: { title?: string };
}

export default {
	async routes() {
		const pages = await loadPages();
		return [{ path: '/', source: undefined }, ...pages].map((page) => ({
			path: page.path,
			async render(ctx) {
				const document = page.source
					? ((await ctx.loadModule(
							resolve(root, 'content', page.source),
						)) as MarkdownModule)
					: undefined;
				const app = createSSRApp({
					render: () => h(App, { content: document?.default, pages }),
				});
				const errors: unknown[] = [];
				app.config.errorHandler = (error) => errors.push(error);
				const body = (await renderToString(app)).replace(
					/href="(\.[^"]*)"/g,
					(_match: string, href: string) => {
						const url = new URL(
							href,
							'https://reference.invalid' + page.path.replace(/[^/]+\/$/, ''),
						);
						if (!/\.[^/]+$/.test(url.pathname) && !url.pathname.endsWith('/'))
							url.pathname += '/';
						return `href="${url.pathname}${url.search}${url.hash}"`;
					},
				);
				if (errors.length)
					throw new AggregateError(errors, 'Vue SSR failed: ' + page.path);
				const title =
					document?.frontmatter.title ||
					/<h1[^>]*>([^<]+)/.exec(body)?.[1] ||
					'Misskey Hub';
				const assets = ctx.assets.stylesheets({ modules: ['App.vue'] });
				const head = ctx.assets.document({ sharedStyles: assets.stylesheets });
				const safeTitle = title
					.replaceAll('&', '&amp;')
					.replaceAll('<', '&lt;');
				const locale =
					'locale' in page && typeof page.locale === 'string'
						? page.locale
						: page.path.split('/')[1] || 'en';
				return {
					title,
					html: `<!DOCTYPE html><html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safeTitle}</title>${head.headHtml}</head><body>${body}</body></html>`,
				};
			},
		}));
	},
} satisfies OxContentCustomHostModule;
