import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, mkdir, writeFile, rm, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "vite";
import vue from "@vitejs/plugin-vue";
import { componentRegistry } from "../plugins/component-registry.ts";

test("Nuxt Lazy components resolve, defer module loading, and retain SSR output", async () => {
	await mkdir(resolve(".vrt"), { recursive: true });
	const root = await mkdtemp(resolve(".vrt/components-"));
	try {
		for (const dir of ["components", "pages", "layouts", "nuxt-compat/components"])
			await mkdir(resolve(root, dir), { recursive: true });
		for (const file of ["app.vue", "error.vue"])
			await writeFile(resolve(root, file), "<template><div /></template>");
		await writeFile(resolve(root, "pages/index.vue"), "<template><LazyDemo /><lazy-other /></template>");
		await writeFile(resolve(root, "nuxt-compat/components/client-component.ts"),
			await readFile(new URL("../nuxt-compat/components/client-component.ts", import.meta.url), "utf8"));
		await writeFile(resolve(root, "components/Demo.vue"), '<script>globalThis.__lazyDemoLoads = (globalThis.__lazyDemoLoads || 0) + 1; export default {}</script><template><p>3D placeholder resolved</p></template>');
		await writeFile(resolve(root, "components/Other.vue"), '<template><p>kebab resolved</p></template>');
		await writeFile(resolve(root, "components/Browser.client.vue"), '<script>throw Error("Client-only component executed on server")</script><template><p>browser only</p></template>');
		await writeFile(resolve(root, "components/Shared.global.vue"), '<template><p>global resolved</p></template>');
		await writeFile(resolve(root, "entry.ts"), `
			import { createSSRApp, defineComponent, h, resolveComponent } from 'vue';
			import { renderToString } from 'vue/server-renderer';
			import * as components from 'virtual:site-components';
			export const beforeLoad = globalThis.__lazyDemoLoads || 0;
			export async function render(name) {
				const app = createSSRApp(defineComponent({ setup: () => () => h(resolveComponent(name)) }));
				for (const [key,value] of Object.entries(components)) app.component(key,value);
				return renderToString(app);
			}
		`);
		const code = componentRegistry(root);
		await build({
			configFile: false, root, logLevel: "error",
			plugins: [vue(), {
				name: "fixture-components",
				resolveId: (id) => id === "virtual:site-components" ? "\0components" : null,
				load: (id) => id === "\0components" ? code : null,
			}],
			build: { ssr: resolve(root, "entry.ts"), outDir: resolve(root, "dist"), minify: false },
		});
		const fixture = await import(pathToFileURL(resolve(root, "dist/entry.js")).href);
		assert.equal(fixture.beforeLoad, 0, "Lazy-only module must not execute before rendering");
		assert.match(await fixture.render("LazyDemo"), /<p>3D placeholder resolved<\/p>/);
		assert.match(await fixture.render("lazy-other"), /<p>kebab resolved<\/p>/);
		assert.match(await fixture.render("Demo"), /3D placeholder resolved/);
		assert.equal(await fixture.render("Browser"), "<!---->");
		assert.equal(await fixture.render("LazyBrowser"), "<!---->");
		assert.match(await fixture.render("Shared"), /global resolved/);
		await writeFile(resolve(root, "pages/index.vue"), "<template><LazyVisibleDemo /></template>");
		assert.throws(() => componentRegistry(root), /delayed hydration/);
	} finally {
		delete globalThis.__lazyDemoLoads;
		await rm(root, { recursive: true, force: true });
	}
});
