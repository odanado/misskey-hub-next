// Composition from PR #2 by ubugeeei. Ox owns routes/Markdown/output;
// Vue compiles the small auxiliary component registry and client islands.
import { resolve } from "node:path";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { createOxContentCustomHostPlugin } from "@ox-content/vite-plugin/custom-host";
import { common } from "../plugins/index";
import { themeStyles } from "../plugins/theme-styles";
import { createBuildPipeline } from "./build/pipeline.mjs";
import { cacheComponents } from "./build/cache-components.mjs";
import { root, outDir } from "./routes.mjs";
const rendererBuild = process.env.MISSKEY_SSG_RENDERER_BUILD === "1";
const base = common({ ssrOnly: rendererBuild });
const pipeline =
	process.env.MISSKEY_SSG_PARALLEL === "1" && !rendererBuild
		? createBuildPipeline(root)
		: undefined;
export default defineConfig({
	...base,
	root,
	publicDir: resolve(root, "public"),
	plugins: [
		...base.plugins,
		...(rendererBuild ? [cacheComponents()] : []),
		themeStyles,
		vue({
			// Match Vite's separate SSR templates (Vue 3.5 inline templates can
			// shadow a select's v-model with a same-name loop variable).
			...(rendererBuild ? { features: { prodDevtools: true } } : {}),
			template: {
				compilerOptions: {
					isCustomElement: (tag) => tag.startsWith("model-viewer"),
				},
			},
		}),
		...(rendererBuild
			? []
			: [
					createOxContentCustomHostPlugin({
						host: pipeline?.host ?? resolve(import.meta.dirname, "host.ts"),
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
				]),
		...(pipeline
			? [
					{
						name: "misskey-ssg-workers",
						// Finish the public copy before Vite emits generated files, preserving
						// the original collision order while overlapping the copy with bundling.
						generateBundle: {
							order: "pre" as const,
							sequential: true,
							handler: () => pipeline.copyPublic(),
						},
						closeBundle: {
							order: "post" as const,
							sequential: true,
							async handler() {
								try {
									await pipeline.close();
								} finally {
									await pipeline.dispose();
								}
							},
						},
					},
				]
			: []),
	],
	build: {
		outDir,
		emptyOutDir: !pipeline,
		copyPublicDir: !pipeline,
		manifest: true,
		rollupOptions: { input: resolve(import.meta.dirname, "client.ts") },
	},
});
