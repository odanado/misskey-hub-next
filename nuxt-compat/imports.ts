// Compatibility entry for explicit #imports consumers; implementations live in role modules.
export * from "vue";
export * from "./config";
export * from "./routing";
export * from "./state";
export * from "./i18n";
export * from "./async-data";
export * from "./content";
export * from "./head";
export * from "./fetch";
export { contextKey, useSiteContext } from "./injection";
export { useColorMode } from "./color-mode";
export { useNuxtApp, createError } from "./app";
export { useScrollspy } from "../composables/useScrollSpy";
export { ClientOnly } from "./components/ClientOnly";
export { NuxtLink } from "./components/NuxtLink";
export { ContentNavigation } from "./components/ContentNavigation";
export { default as MDC } from "./components/MDC.vue";
