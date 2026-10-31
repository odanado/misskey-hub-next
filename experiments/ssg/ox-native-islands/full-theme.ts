import { theme } from './theme';
import { escape } from './html';
// The full inventory adds YAML guides and original Vue page bodies. Ox still
// owns the document; layout controls/page-specific logic are bounded islands.
export async function fullTheme(payload: any, body: string, ui: any) {
    if (!payload.fullSite || payload.kind === 'docs')
        return theme(payload, body, ui);
    if (payload.kind === 'languageEntry')
        return `<div><p>Please enable Javascript to see this page properly.</p>${payload.locales.map((l: any) => `<a href="/${l.code}${payload.path}">${escape(l.name)}</a>`).join('')}</div>`;
    let content: string;
    if (payload.kind === 'blog') {
        const t = (key: string) => key.split('.').reduce((value: any, key) => value?.[key], payload.messages);
        const back = await ui.render('GNuxtLink', { to: '/ja/blog/', class: 'text-xl font-bold hover:opacity-70' }, { default: escape(t('_blog.back')) });
        const date = payload.document.date ? new Intl.DateTimeFormat(payload.locale === 'ja-ks' ? 'ja' : payload.locale).format(new Date(payload.document.date)) : '';
        content = `<div><div class="mx-auto container max-w-screen-md relative px-6 py-12"><p class="text-center mb-4">${escape(t('_blog.title'))}</p><h1 class="text-center font-bold text-2xl lg:text-3xl mb-4">${escape(payload.document.title)}</h1><p class="text-center">${escape(date)}</p></div><div class="bg-white dark:bg-neutral-950 pb-12 pt-6 px-6"><div class="mx-auto container max-w-screen-md markdown-body">${body}</div><div class="text-center mt-6">${await ui.render('GSocialShare', { url: 'https://misskey-hub.net' + payload.path }, {}, true)}${back}</div></div></div>`;
    }
    else
        content = await ui.render('Page:' + payload.pageFile, {}, {}, true);
    const layout = payload.pageFile?.includes('/tools/') ? 'tools' : payload.pageFile === 'pages/index.vue' ? 'landing' : payload.pageFile === 'pages/ns.vue' ? 'slim' : 'default';
    return ui.render('Layout:' + layout, {}, { default: content }, true);
}
