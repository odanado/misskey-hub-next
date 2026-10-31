// Ox Content owns the route list, Markdown pipeline and output lifecycle.
import { resolve } from "node:path";
import { prepareData } from "./data.mjs";
import { head, serialize } from "./head.mjs";
import { root } from "./routes.mjs";
import { createDocumentParser } from "./markdown";
import { createContext } from "./context";
import { createDecorations } from "./decorations";
import { renderBody, escape } from "./html";
import { theme } from "./theme";
import { createPage } from "./page";
import { renderToString } from "vue/server-renderer";
const browserCopy = (value: any): any => {
	if (Array.isArray(value)) return value.map(browserCopy);
	if (!value || typeof value !== "object") return value;
	const copy = Object.fromEntries(
		Object.entries(value).map(([key, item]) => [key, browserCopy(item)]),
	);
	if (value.html !== undefined && value.body?.children)
		copy.body = { toc: value.body.toc, children: [{ type: "static-html" }] };
	return copy;
};
export default {
	async routes(host: any) {
		const pages = await prepareData(createDocumentParser(host));
		let assets: any;
		return pages.map((payload: any) => ({
			path: payload.path,
			...(payload.source
				? { inputPath: resolve(root, "content", payload.source) }
				: {}),
			async render(ctx: any) {
				if (ctx.mode === "serve") assets = { js: "/ssg/client.ts", css: [] };
				if (!assets) {
					const styles = ctx.assets.stylesheets({
						modules: [resolve(import.meta.dirname, "client.ts")],
					});
					if (styles.diagnostics.length || !styles.stylesheets.length)
						throw Error("Missing page CSS");
					const entry = Object.values(ctx.assets.clientManifest).find(
						(e: any) => e.isEntry,
					) as any;
					if (!entry) throw Error("Missing client entry");
					assets = {
						js: "/" + entry.file,
						css: styles.stylesheets.map((s: any) => s.href),
					};
				}
				if (payload.kind === "languageEntry") {
					const available = pages.filter(
						(p: any) =>
							p.path.endsWith(payload.path) && p.kind !== "languageEntry",
					);
					const targets = Object.fromEntries(
						available
							.filter((p: any) => p.path === "/" + p.locale + payload.path)
							.map((p: any) => [p.locale, p.path]),
					);
					const script = `(()=>{const t=${serialize(targets)};const d=Object.fromEntries(document.cookie.split('; ').map(v=>v.split(/=(.*)/s).map(decodeURIComponent)));const l=d.i18n_redirected||navigator.language.split('-')[0];location.replace((t[l]||t.ja||Object.values(t)[0])+location.search+location.hash)})()`;
					return {
						title: "Misskey Hub",
						html: `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><script>${script}</script></head><body><noscript>Please enable Javascript to see this page properly.</noscript><noscript>${Object.entries(
							targets,
						)
							.map(([code, path]) => `<a href="${path}">${escape(code)}</a>`)
							.join(", ")}</noscript></body></html>`,
					};
				}
				const inline = payload.inlineMarkdown;
				const selected: any = {};
				const pick = (value: any) => {
					if (typeof value === "string" && inline?.[value])
						selected[value] = inline[value];
					else if (Array.isArray(value)) value.forEach(pick);
					else if (value && typeof value === "object")
						Object.values(value).forEach(pick);
				};
				pick(payload.document);
				payload.inlineMarkdown = selected;
				const context = createContext(payload),
					ui = createDecorations(context);
				const body = payload.document.body?.children
					? await renderBody(payload.document.body, ui)
					: "";
				context.staticMarkdownHtml = body;
				payload.document.html = body;
				let content: string,
					mode: string,
					htmlClass = "scroll-pt-32 lg:scroll-pt-20",
					data: any;
				if (payload.kind === "docs") {
					content = await theme(payload, body, ui);
					mode = "islands";
					data = browserCopy({
						...payload,
						styles: undefined,
						document: {
							...payload.document,
							body: payload.document.body?.children
								? { toc: payload.document.body.toc }
								: payload.document.body,
						},
						surround: payload.surround.map((item: any) =>
							item
								? Object.fromEntries(
										Object.entries(item).filter(([key]) => key !== "body"),
									)
								: null,
						),
						islands: ui.descriptors,
					});
				} else {
					for (const item of payload.related ?? [])
						if (item.body?.children && !item.html)
							item.html = await renderBody(item.body, ui);
					payload.staticMarkdownHtml = body;
					const page = await createPage(payload);
					const pageHtml = await renderToString(page.app);
					if (page.errors.length)
						throw new AggregateError(
							page.errors,
							"Vue page failed: " + payload.path,
						);
					content = `<div id="vue-page-root">${pageHtml}</div>`;
					mode = "page";
					htmlClass = page.context.head?.htmlAttrs.class ?? "";
					payload.document.title =
						page.context.route.meta.title ??
						(payload.pageFile === "pages/index.vue"
							? payload.messages._seo.siteNameLong
							: payload.document.title);
					payload.document.description =
						page.context.route.meta.description ?? payload.document.description;
					payload.document.graph = page.context.route.meta.graph;
					payload.document.thumbnail = page.context.route.meta.thumbnail;
					context.route.meta = page.context.route.meta;
					data = browserCopy({
						...payload,
						pageMeta: { ...payload.pageMeta, ...page.context.route.meta },
						styles: undefined,
						asyncData: page.context.asyncData,
						fetchCache: page.context.fetchCache,
					});
				}
				const controls = await ui.render("AppControls", {}, {}, true);
				if (payload.kind !== "docs")
					content = (await ui.render("GNoScript")) + content;
				data.islands = ui.descriptors;
				const lang =
					payload.locales.find((l: any) => l.code === payload.locale)
						?.language ?? "ja-JP";
				const pageStyles =
					ctx.mode === "build" && payload.kind !== "docs" && payload.pageFile
						? ctx.assets.stylesheets({
								modules: [
									resolve(import.meta.dirname, "client.ts"),
									resolve(root, payload.pageFile),
								],
							})
						: null;
				if (pageStyles?.diagnostics.length)
					throw Error(JSON.stringify(pageStyles.diagnostics));
				const css = (
					pageStyles?.stylesheets.map((style: any) => style.href) ?? assets.css
				)
					.map((href: string) => `<link rel="stylesheet" href="${href}">`)
					.join("");
				return {
					title: payload.document.title,
					html: `<!DOCTYPE html><html lang="${lang}" class="${escape(htmlClass)}"><head>${head(payload)}${css}</head><body><div id="__nuxt">${content}${controls}</div><script id="site-data" type="application/json">${serialize({ ...data, mode })}</script><script type="module" src="${assets.js}"></script></body></html>`,
				};
			},
		}));
	},
};
