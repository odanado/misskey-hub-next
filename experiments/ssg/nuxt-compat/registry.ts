import type { App } from 'vue';
import GNav from '#port-nav';
import GFooter from '../../../components/g/Footer.vue';
import GNuxtLink from '../../../components/g/NuxtLink.vue';
import DocsAsideNav from '../../../components/docs/AsideNav.vue';
import DocsTocLinks from '../../../components/docs/TocLinks.vue';
import DocsPrevNext from '../../../components/docs/PrevNext.vue';
import Danger from '../../../components/content/Danger.vue';
import Fukidashi from '../../../components/content/Fukidashi.vue';
import GDetails from '../../../components/content/GDetails.vue';
import MfmPreview from '../../../components/content/MfmPreview.vue';
import MiWebEmbed from '../../../components/content/MiWebEmbed.vue';
import ApiPermissions from '../../../components/content/ApiPermissions.vue';
import MkIndex from '../../../components/content/MkIndex.vue';
import Tip from '../../../components/content/Tip.vue';
import Warning from '../../../components/content/Warning.vue';
import ProseA from '../../../components/content/ProseA.vue';
import ProseImg from '../../../components/content/ProseImg.vue';
import ProseTable from '../../../components/content/ProseTable.vue';
import ContentRenderer from './ContentRenderer.vue';
import { ClientOnly, NuxtLink, I18nT, ContentNavigation } from './runtime';
import * as prose from 'virtual:port-prose';
import * as fullComponents from 'virtual:port-full-components';
import { MDC } from './runtime';
import { defineComponent } from 'vue';
const outsidePilot = defineComponent({
	setup() {
		throw new Error('This component is outside the selected Markdown SSG pilot');
	},
});
export function configure(app: App) {
	if ((app as any).__portConfigured) return;
	(app as any).__portConfigured = true;
	if (Object.keys(fullComponents).length) app.config.throwUnhandledErrorInProduction = true;
	app.component('DocsSteppedGuide', outsidePilot);
	for (const [name, component] of Object.entries(fullComponents))
		app.component(name, component as any);
	app.component('MDC', MDC);
	for (const [name, component] of Object.entries({
		...prose,
		Danger,
		Fukidashi,
		GDetails,
		MfmPreview,
		MiWebEmbed,
		ApiPermissions,
		MkIndex,
		GNav,
		GFooter,
		GNuxtLink,
		DocsAsideNav,
		DocsTocLinks,
		DocsPrevNext,
		Tip,
		Warning,
		ProseA,
		ProseImg,
		ProseTable,
		ContentRenderer,
		ClientOnly,
		NuxtLink,
		I18nT,
		ContentNavigation,
	}))
		app.component(name, component as any);
}
export default configure;
