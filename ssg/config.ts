// Composition from PR #2 by ubugeeei. Ox owns routes/Markdown/output;
// Vue compiles the small auxiliary component registry and client islands.
import { resolve, relative } from "node:path";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { parse, compileStyle } from "@vue/compiler-sfc";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { createOxContentCustomHostPlugin } from "@ox-content/vite-plugin";
import { common } from "./plugins.mjs";
import { root, outDir } from "./routes.mjs";
const require = createRequire(import.meta.url);
const styles = [
	"layouts/docs.vue",
	"pages/docs/[...slug].vue",
	"components/g/Footer.vue",
	"components/content/Tip.vue",
	"components/content/Warning.vue",
	"components/content/Danger.vue",
	"components/content/GDetails.vue",
	"components/content/Fukidashi.vue",
	"components/content/MiWebEmbed.vue",
	"components/content/ApiPermissions.vue",
	"components/content/MkIndex.vue",
	relative(
		root,
		require.resolve("@nuxt/content").replace(/[^/]+$/, "") +
			"runtime/components/Prose/ProsePre.vue",
	),
];
const themeStyles = {
	name: "ox-islands-theme-styles",
	resolveId(id: string) {
		if (
			[
				"virtual:ox-islands-styles",
				"virtual:ox-static-theme.css",
				"virtual:ox-full-registry",
			].includes(id)
		)
			return "\0" + id;
	},
	load(id: string) {
		if (id === "\0virtual:ox-full-registry")
			return `export * from ${JSON.stringify(resolve(import.meta.dirname, "registry.ts"))};`;
		if (
			![
				"\0virtual:ox-islands-styles",
				"\0virtual:ox-static-theme.css",
			].includes(id)
		)
			return;
		let code = "import 'virtual:ox-static-theme.css';\n",
			staticCss = "";
		for (const file of styles) {
			const path = resolve(root, file),
				source = readFileSync(path, "utf8");
			const { descriptor } = parse(source, { filename: path });
			const hash = createHash("sha256")
				.update(file + source)
				.digest("hex")
				.slice(0, 8);
			if (file === "layouts/docs.vue")
				code +=
					"export const layoutScope=" +
					JSON.stringify("data-v-" + hash) +
					";\n";
			for (const [index, style] of descriptor.styles.entries()) {
				if (!style.module) {
					const result = compileStyle({
						source: style.content,
						filename: path,
						id: "data-v-" + hash,
						scoped: !!style.scoped,
					});
					if (result.errors.length)
						throw new Error(JSON.stringify(result.errors));
					staticCss += result.code + "\n";
					continue;
				}
				const request =
					path +
					"?vue&type=style&index=" +
					index +
					(style.scoped ? "&scoped=" + hash : "") +
					(style.module ? "&module=true" : "") +
					"&lang." +
					(style.module ? "module." : "") +
					(style.lang ?? "css");
				code +=
					(file === "pages/docs/[...slug].vue"
						? "import docClasses from "
						: "import ") +
					JSON.stringify(request) +
					";\n";
			}
		}
		if (id === "\0virtual:ox-static-theme.css") return staticCss;
		return {
			code: code + "export {docClasses};",
			moduleSideEffects: "no-treeshake" as const,
		};
	},
	// These CSS modules decorate server-owned HTML, so client JS has no component
	// reference that would otherwise keep their styles alive during tree shaking.
	transform(code: string, id: string) {
		if (
			styles.some((file) =>
				id.startsWith(resolve(root, file) + "?vue&type=style"),
			)
		)
			return { code, moduleSideEffects: "no-treeshake" as const };
	},
};
const base = common();
export default defineConfig({
	...base,
	root,
	publicDir: resolve(root, "public"),
	plugins: [
		...base.plugins,
		themeStyles,
		vue({
			template: {
				compilerOptions: {
					isCustomElement: (tag) => tag.startsWith("model-viewer"),
				},
			},
		}),
		createOxContentCustomHostPlugin({
			host: resolve(import.meta.dirname, "host.ts"),
			oxContent: {
				srcDir: resolve(root, "content"),
				outDir,
				docs: false,
				search: false,
				embeds: false,
				highlight: false,
				containers: true,
				ssg: {
					generateOgImage: false,
					lastUpdated: false,
					readerChrome: false,
				},
			},
			build: { transformHtml: false },
		}),
	],
	build: {
		outDir,
		emptyOutDir: true,
		manifest: true,
		rollupOptions: { input: resolve(import.meta.dirname, "client.ts") },
	},
});
