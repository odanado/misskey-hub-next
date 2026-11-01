import { inject } from "vue";
export const contextKey = Symbol.for("misskey-hub");
export const useSiteContext = () => inject<any>(contextKey)!;
