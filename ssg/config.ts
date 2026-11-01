// Composition from PR #2 by ubugeeei. Ox owns routes/Markdown/output;
// Vue compiles the small auxiliary component registry and client islands.
import { resolve } from "node:path";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { createOxContentCustomHostPlugin } from "@ox-content/vite-plugin";
import { common } from "../plugins/index.mjs";
import { themeStyles } from "../plugins/theme-styles";
import { root, outDir } from "./routes.mjs";
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
