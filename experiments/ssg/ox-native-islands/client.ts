import '../nuxt-compat/styles';
import 'virtual:ox-islands-styles';
import 'scroll-hint/css/scroll-hint.css';
import './client.css';
import ScrollHint from 'scroll-hint';
import { nextTick, ref, watch } from 'vue';
import { createContext, islandApp } from './context';
import { islands, globals, islandProps } from './islands';
import * as full from 'virtual:ox-full-registry';
async function start() {
    const payload = JSON.parse(document.querySelector('#port-data')!.textContent!);
    const context = createContext(payload);
    context.state.miHub_docs_asideNav_openState = ref(false);
    watch(context.state.miHub_docs_asideNav_openState, (open) => {
        const aside = document.querySelector('[data-ox-aside]')!, overlay = document.querySelector('[data-ox-overlay]')!;
        aside?.classList.toggle('-translate-x-64', !open);
        aside?.classList.toggle('translate-x-0', !!open);
        overlay?.classList.toggle('opacity-0', !open);
        overlay?.classList.toggle('pointer-events-none', !open);
        overlay?.classList.toggle('opacity-70', !!open);
    });
    document.querySelector('[data-ox-menu]')?.addEventListener('click', () => context.state.miHub_docs_asideNav_openState.value = !context.state.miHub_docs_asideNav_openState.value);
    document.querySelector('[data-ox-overlay]')?.addEventListener('click', () => context.state.miHub_docs_asideNav_openState.value = false);
    for (const element of document.querySelectorAll<HTMLElement>('[data-ox-island]')) {
        const descriptor = payload.islands[Number(element.dataset.oxIsland)];
        const name = descriptor.name as keyof typeof islands;
        const component = islands[name] ?? await full.resolveComponent(name);
        if (!component)
            throw new Error('Missing island: ' + name);
        const app = islandApp(component, islandProps(name, descriptor.props, context), context, { ...full.components, ...globals }, descriptor.slots);
        app.config.idPrefix = 'oxi' + element.dataset.oxIsland;
        app.mount(element);
    }
    for (const table of document.querySelectorAll<HTMLElement>('[data-ox-table]'))
        new ScrollHint(table, { i18n: { scrollable: payload.messages.scrollable ?? 'scrollable' } });
    const top = document.querySelector('[data-ox-top]')!;
    top?.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
    window.addEventListener('scroll', () => {
        const visible = document.body.getBoundingClientRect().y <= -45;
        top?.classList.toggle('opacity-0', !visible);
        top?.classList.toggle('pointer-events-none', !visible);
        top?.classList.toggle('opacity-75', visible);
        top?.classList.toggle('hover:opacity-100', visible);
    }, { passive: true });
    await nextTick();
    document.documentElement.dataset.pilotMounted = 'true';
    document.documentElement.dataset.pilotReady = 'true';
}
void start();
