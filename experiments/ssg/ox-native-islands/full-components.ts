// Included only in all-URL builds. Original Vue page bodies remain bounded
// islands inside Ox documents; ordinary Markdown never enters this registry.
import { defineAsyncComponent, defineComponent, h } from 'vue';
import * as original from 'virtual:port-full-components';
import * as prose from 'virtual:port-prose';
import { ClientOnly, MDC } from './runtime-bridge.mjs';
import ProseA from '../../../components/content/ProseA.vue';
import ProseImg from '../../../components/content/ProseImg.vue';
import ProseTable from '../../../components/content/ProseTable.vue';
import StaticContent from './StaticContent.vue';
import Default from '../../../layouts/default.vue';
import Slim from '../../../layouts/slim.vue';
import Tools from '../../../layouts/tools.vue';
import Landing from '../../../layouts/landing.vue';
const files = import.meta.glob(['../../../pages/**/*.vue', '!../../../pages/docs/[...slug].vue', '!../../../pages/blog/*slug*']);
export const components = { ...original, ...prose, MDC, ProseA, ProseImg, ProseTable, ContentRenderer: StaticContent };
const layouts = { default: Default, slim: Slim, tools: Tools, landing: Landing };
const pageCache = new Map<string, any>();
export async function resolveComponent(name: string) {
    if (name.startsWith('Layout:'))
        return layouts[name.slice(7) as keyof typeof layouts];
    if (name.startsWith('Page:')) {
        const file = name.slice(5), load = files['../../../' + file];
        if (!load)
            throw new Error('Unmapped Vue page body: ' + file);
        if (!pageCache.has(file)) {
            if (file.endsWith('.client.vue')) {
                const Page = defineAsyncComponent(async () => (await load() as any).default);
                pageCache.set(file, defineComponent({ setup: () => () => h(ClientOnly, null, { default: () => h(Page) }) }));
            }
            else
                pageCache.set(file, (await load() as any).default);
        }
        return pageCache.get(file);
    }
    return components[name as keyof typeof components];
}
