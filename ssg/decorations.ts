// Build-only reuse of existing components. Ordinary Markdown nodes are HTML.
import { renderToString } from "vue/server-renderer";
import GFooter from "../components/g/Footer.vue";
import DocsPrevNext from "../components/docs/PrevNext.vue";
import Tip from "../components/content/Tip.vue";
import Warning from "../components/content/Warning.vue";
import Danger from "../components/content/Danger.vue";
import GDetails from "../components/content/GDetails.vue";
import Fukidashi from "../components/content/Fukidashi.vue";
import MiWebEmbed from "../components/content/MiWebEmbed.vue";
import ApiPermissions from "../components/content/ApiPermissions.vue";
import MkIndex from "../components/content/MkIndex.vue";
import ProseA from "../components/content/ProseA.vue";
import ExtIcon from "bi/box-arrow-up-right.svg?component";
import AsideIcon from "bi/text-indent-left.svg?component";
import TopIcon from "bi/chevron-up.svg?component";
import { islandApp } from "../nuxt-compat/app";
import { globals, islands, islandProps } from "./islands";
import * as full from "../nuxt-compat/components";
const components = {
	...full.components,
	...globals,
	GFooter,
	DocsPrevNext,
	Tip,
	Warning,
	Danger,
	GDetails,
	Fukidashi,
	MiWebEmbed,
	ApiPermissions,
	MkIndex,
	ProseA,
	ExtIcon,
	AsideIcon,
	TopIcon,
};
const normalize = (name: string) =>
	name.replace(/[^a-z0-9]/gi, "").toLowerCase();
const componentNames = new Map(
	Object.keys(full.components).map((name) => [normalize(name), name]),
);
export function createDecorations(context: any) {
	const descriptors: any[] = [];
	const notices = new Set<string>();
	async function render(
		name: string,
		props: any = {},
		slots: Record<string, string> = {},
		hydrate = false,
	) {
		const component =
			components[name as keyof typeof components] ??
			(await full.resolveComponent(name));
		if (!component) throw new Error("Unsupported island/component: " + name);
		const app = islandApp(
			component,
			islandProps(name, props, context),
			context,
			name === "ProseA"
				? { GNuxtLink: globals.GNuxtLink, NuxtLink: globals.NuxtLink }
				: components,
			slots,
		);
		if (hydrate) app.config.idPrefix = "oxi" + descriptors.length;
		const errors: unknown[] = [];
		app.config.errorHandler = (error) => errors.push(error);
		const html = await renderToString(app);
		if (errors.length)
			throw new AggregateError(errors, "Decoration failed: " + name);
		if (!hydrate) return html;
		const id =
			descriptors.push({
				name,
				props,
				...(Object.keys(slots).length ? { slots } : {}),
			}) - 1;
		return `<ox-island style="display:contents" data-ox-island="${id}">${html}</ox-island>`;
	}
	return {
		render,
		descriptors,
		notices,
		componentName: (tag: string) => componentNames.get(normalize(tag)),
	};
}
