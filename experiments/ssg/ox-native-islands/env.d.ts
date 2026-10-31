declare module '*.vue' {
    import type { Component } from 'vue';
    const component: Component;
    export default component;
}
declare module '*.svg?component' {
    import type { Component } from 'vue';
    const component: Component;
    export default component;
}
declare module 'virtual:ox-islands-styles' {
    export const docClasses: Record<string, string>;
    export const layoutScope: string;
}
declare module 'virtual:ox-full-registry' {
    import type { Component } from 'vue';
    export const components: Record<string, Component>;
    export function resolveComponent(name: string): Promise<Component | undefined>;
}
declare module 'virtual:port-full-components' {
    import type { Component } from 'vue';
    const components: Record<string, Component>;
    export = components;
}
declare module 'virtual:port-prose' {
    import type { Component } from 'vue';
    const components: Record<string, Component>;
    export = components;
}
