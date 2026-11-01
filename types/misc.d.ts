import type { FunctionalComponent, SVGAttributes } from 'vue';
export {};
declare module '*.svg' {
 const component: FunctionalComponent<SVGAttributes>;
 export default component;
}
