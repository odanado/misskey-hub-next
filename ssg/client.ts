import "./styles";
import { docClasses } from "virtual:ox-islands-styles";
import "scroll-hint/css/scroll-hint.css";
import "./client.css";
import ScrollHint from "scroll-hint";
import { nextTick, ref, watch } from "vue";
import { createContext } from "../nuxt-compat/context";
import { islandApp } from "../nuxt-compat/app";
import { islands, globals, islandProps } from "./islands";
import * as registry from "../nuxt-compat/components";
import { createPage } from "../nuxt-compat/page";
async function start() {
	const payload = JSON.parse(
		document.querySelector("#site-data")!.textContent!,
	);
	let context: any, pageApp: any;
	if (payload.mode === "page") {
		const page = await createPage(payload);
		context = page.context;
		pageApp = page;
	} else {
		context = createContext(payload);
		if (payload.document._TYPE_ !== "STEPPED_GUIDE")
			document
				.querySelector("[data-doc-grid]")
				?.classList.add(docClasses.docsLayoutWithAsideToc);
		context.state.miHub_docs_asideNav_openState = ref(false);
		watch(context.state.miHub_docs_asideNav_openState, (open) => {
			const aside = document.querySelector("[data-ox-aside]"),
				overlay = document.querySelector("[data-ox-overlay]");
			aside?.classList.toggle("-translate-x-64", !open);
			aside?.classList.toggle("translate-x-0", !!open);
			overlay?.classList.toggle("opacity-0", !open);
			overlay?.classList.toggle("pointer-events-none", !open);
			overlay?.classList.toggle("opacity-70", !!open);
		});
		document
			.querySelector("[data-ox-menu]")
			?.addEventListener(
				"click",
				() =>
					(context.state.miHub_docs_asideNav_openState.value =
						!context.state.miHub_docs_asideNav_openState.value),
			);
		document
			.querySelector("[data-ox-overlay]")
			?.addEventListener(
				"click",
				() => (context.state.miHub_docs_asideNav_openState.value = false),
			);
	}
	for (const element of document.querySelectorAll<HTMLElement>(
		"[data-ox-island]",
	)) {
		const descriptor = payload.islands[Number(element.dataset.oxIsland)],
			name = descriptor.name as keyof typeof islands;
		const component = islands[name] ?? (await registry.resolveComponent(name));
		if (!component) throw Error("Missing island: " + name);
		const app = islandApp(
			component,
			islandProps(name, descriptor.props, context),
			context,
			{ ...registry.components, ...globals },
			descriptor.slots,
		);
		app.config.idPrefix = "oxi" + element.dataset.oxIsland;
		app.mount(element);
		await (app as any).whenReady;
	}
	if (pageApp) {
		pageApp.app.mount("#vue-page-root");
		await pageApp.ready;
		await nextTick();
		if (pageApp.errors.length)
			throw new AggregateError(pageApp.errors, "Page hydration failed");
	}
	for (const table of document.querySelectorAll<HTMLElement>("[data-ox-table]"))
		new ScrollHint(table, {
			i18n: { scrollable: payload.messages.scrollable ?? "scrollable" },
		});
	const update = () => {
		const y = document.body.getBoundingClientRect().y;
		context.state.miHub_global_scrollPos.value = y;
		const top = document.querySelector("[data-ox-top]");
		top?.classList.toggle("opacity-0", y > -45);
		top?.classList.toggle("pointer-events-none", y > -45);
		top?.classList.toggle("opacity-75", y <= -45);
		top?.classList.toggle("hover:opacity-100", y <= -45);
	};
	document
		.querySelector("[data-ox-top]")
		?.addEventListener("click", () =>
			window.scrollTo({ top: 0, behavior: "smooth" }),
		);
	window.addEventListener("scroll", update, { passive: true });
	window.addEventListener("resize", update, { passive: true });
	watch(
		() => context.route.meta.title,
		(title) => {
			document.title =
				payload.pageFile === "pages/index.vue"
					? payload.messages._seo.siteNameLong
					: (title ?? payload.document.title) + " | Misskey";
		},
		{ immediate: true },
	);
	await nextTick();
	document.documentElement.dataset.siteReady = "true";
}
void start();
