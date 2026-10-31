// Custom Host lifecycle from PR #2 (ubugeeei), extended with static HTML and leaf islands.
import { resolve } from 'node:path';
import type { OxContentCustomHostModule } from '@ox-content/vite-plugin';
import { prepareData } from '../shared/data.mjs';
import { head, serialize } from '../nuxt-compat/head.mjs';
import { root } from './routes';
import { createDocumentParser } from './markdown';
import { createContext } from './context';
import { createDecorations } from './decorations';
import { renderBody } from './html';
import { fullTheme } from './full-theme';
export default {
    async routes(host) {
        const pages = await prepareData('ox-native-islands', { parseDocument: createDocumentParser(host) });
        let assets: {
            js: string;
            css: string[];
        } | undefined;
        const inline = Object.assign({}, ...pages.map((p: any) => p.inlineMarkdown ?? {}));
        function inlineFor(value: any, out: any = {}) {
            if (typeof value === 'string' && inline[value])
                out[value] = inline[value];
            else if (Array.isArray(value))
                value.forEach((v) => inlineFor(v, out));
            else if (value && typeof value === 'object')
                Object.values(value).forEach((v) => inlineFor(v, out));
            return out;
        }
        return pages.map((original: any) => {
            const payload = original.fullSite ? { ...original, inlineMarkdown: inlineFor([original.document, original.related]) } : original;
            return ({
                path: payload.path, ...(payload.source ? { inputPath: resolve(root, 'content', payload.source) } : {}),
                async render(ctx) {
                    if (!assets) {
                        const styles = ctx.assets.stylesheets({ modules: [resolve(root, 'experiments/ssg/ox-native-islands/client.ts')] });
                        if (styles.diagnostics.length || !styles.stylesheets.length)
                            throw new Error(JSON.stringify(styles.diagnostics));
                        const entry = Object.values(ctx.assets.clientManifest!).find((e: any) => e.isEntry) as any;
                        if (!entry)
                            throw new Error('Missing islands client');
                        assets = { js: '/' + entry.file, css: styles.stylesheets.map((s) => s.href) };
                    }
                    const context = createContext(payload), ui = createDecorations(context);
                    const body = payload.document.body?.children ? await renderBody(payload.document.body, ui) : '';
                    context.staticMarkdownHtml = body;
                    const content = await fullTheme(payload, body, ui);
                    if (ui.notices.size)
                        console.log('[ox-islands-compat] ' + JSON.stringify({ path: payload.path, components: [...ui.notices] }));
                    // The original /ns page checks children.length before showing
                    // ContentRenderer. Retain only a presence marker, never its AST.
                    const staticPage = payload.kind === 'static' && payload.source?.endsWith('.md');
                    const data = { ...payload, styles: undefined, document: { ...payload.document, body: payload.document.body?.children ? { toc: payload.document.body.toc, ...(staticPage ? { children: [{ type: 'static-html' }] } : {}) } : payload.document.body }, surround: payload.surround.map((p: any) => p ? Object.fromEntries(Object.entries(p).filter(([k]) => k !== 'body')) : null), islands: ui.descriptors, ...(staticPage ? { staticMarkdownHtml: body } : {}) };
                    const lang = payload.locales.find((l: any) => l.code === context.locale.value)?.language ?? 'ja-JP';
                    return { title: payload.document.title, html: `<!DOCTYPE html><html lang="${lang}" class="scroll-pt-32 lg:scroll-pt-20"><head>${head(payload)}${assets.css.map((href) => `<link rel="stylesheet" href="${href}">`).join('')}</head><body><div id="__nuxt">${content}</div><script id="port-data" type="application/json">${serialize(data)}</script><script type="module" src="${assets.js}"></script></body></html>` };
                }
            });
        });
    }
} satisfies OxContentCustomHostModule;
