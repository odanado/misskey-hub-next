// Only these components participate in client hydration. No Markdown module graph.
import GNav from '../../../components/g/Nav.vue';
import GNuxtLink from '../../../components/g/NuxtLink.vue';
import DocsAsideNav from '../../../components/docs/AsideNav.vue';
import DocsTocLinks from '../../../components/docs/TocLinks.vue';
import MfmPreview from '../../../components/content/MfmPreview.vue';
import MiWebEmbed from '../../../components/content/MiWebEmbed.vue';
import { ClientOnly, NuxtLink, I18nT, ContentNavigation } from './runtime-bridge.mjs';
export const islands = { GNav, DocsAsideNav, DocsTocLinks, MfmPreview, MiWebEmbed };
export const globals = { ...islands, GNuxtLink, ClientOnly, NuxtLink, I18nT, ContentNavigation };
export function islandProps(name: string, props: any, context: any) {
    if (name === 'DocsAsideNav')
        return { links: context.navigation, ...props };
    if (name === 'DocsTocLinks')
        return { links: context.document.body?.toc?.links ?? [], maxDepth: context.document.maxTocDepth, ...props };
    if (name === 'DocsSteppedGuide')
        return { data: context.document, ...props };
    return props;
}
