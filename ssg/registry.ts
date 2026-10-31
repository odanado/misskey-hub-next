import { defineAsyncComponent, defineComponent, h } from "vue";
import * as original from "virtual:site-components";
import * as prose from "virtual:site-prose";
import {
	ClientOnly,
	NuxtLink,
	I18nT,
	ContentNavigation,
	MDC,
	useSiteContext,
} from "./runtime";
import AppControls from "../app.vue";
import MkMfm from "../components/mk/Mfm";
import ProseA from "../components/content/ProseA.vue";
import ProseImg from "../components/content/ProseImg.vue";
import ProseTable from "../components/content/ProseTable.vue";
import StaticContent from "./StaticContent.vue";
import Default from "../layouts/default.vue";
import Landing from "../layouts/landing.vue";
import Tools from "../layouts/tools.vue";
import Slim from "../layouts/slim.vue";
import Blank from "../layouts/blank.vue";
const aliases = Object.fromEntries(
	Object.entries(original)
		.filter(([name]) => name.startsWith("Content"))
		.map(([name, value]) => [name.slice(7), value]),
);
export const components = {
	AppControls,
	...original,
	...prose,
	...aliases,
	MkMfm,
	MDC,
	ProseA,
	ProseImg,
	ProseTable,
	ClientOnly,
	NuxtLink,
	I18nT,
	ContentNavigation,
	ContentRenderer: StaticContent,
};
const layouts = {
	default: Default,
	landing: Landing,
	tools: Tools,
	slim: Slim,
	blank: Blank,
};
const files = import.meta.glob([
	"../pages/**/*.vue",
	"!../pages/docs/*slug*.vue",
]);
const cache = new Map<string, any>();
export async function resolveComponent(name: string) {
	if (name.startsWith("Layout:"))
		return layouts[name.slice(7) as keyof typeof layouts];
	if (!name.startsWith("Page:"))
		return components[name as keyof typeof components];
	const file = name.slice(5),
		load = files["../" + file];
	if (!load) throw Error("Unmapped Vue page: " + file);
	if (!cache.has(file)) {
		if (file.endsWith(".client.vue")) {
			const Page = defineAsyncComponent(
				async () => ((await load()) as any).default,
			);
			cache.set(
				file,
				defineComponent({
					setup: () => () => h(ClientOnly, null, { default: () => h(Page) }),
				}),
			);
		} else cache.set(file, ((await load()) as any).default);
	}
	return cache.get(file);
}
