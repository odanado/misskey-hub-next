import { resolve, dirname } from "node:path";
import { createRequire } from "node:module";
import { readdirSync } from "node:fs";
import { createUnimport } from "unimport";
import unocss from "unocss/vite";
import svgLoader from "vite-svg-loader";
import type { PluginOption } from "vite";
const require = createRequire(import.meta.url);
export const root = resolve(import.meta.dirname, "..");
const compat = resolve(root, "nuxt-compat");
const importsEntry = resolve(compat, "imports.ts");
const mdc = dirname(require.resolve("@nuxtjs/mdc")),
	content = dirname(require.resolve("@nuxt/content"));
const names = [
	"ref",
	"shallowRef",
	"reactive",
	"computed",
	"watch",
	"watchEffect",
	"onMounted",
	"onUnmounted",
	"onBeforeMount",
	"onBeforeUnmount",
	"nextTick",
	"useTemplateRef",
	"onDeactivated",
	"onActivated",
	"useId",
	"unref",
	"toRef",
	"toRefs",
	"onServerPrefetch",
	"provide",
	"inject",
	"toRaw",
	"markRaw",
	"shallowReactive",
	"readonly",
];
const composables = {
	config: ["useRuntimeConfig", "useAppConfig", "defineAppConfig"],
	routing: ["useRoute", "useRouter", "onBeforeRouteLeave", "navigateTo"],
	state: ["useState"],
	i18n: ["useI18n", "useGLocalePath", "useGSwitchLocalePath", "defineI18nRoute"],
	"color-mode": ["useColorMode"],
	"async-data": ["useGAsyncData"],
	content: ["queryContent", "fetchContentNavigation"],
	head: ["useHead", "definePageMeta"],
	app: ["useNuxtApp", "createError"],
	fetch: ["useFetch"],
};
export const aliases = {
	"@": root,
	"~": root,
	assets: resolve(root, "assets"),
	"#imports": importsEntry,
	bi: resolve(root, "node_modules/bootstrap-icons/icons"),
};
export function plugins(): PluginOption[] {
	const imports = createUnimport({
		imports: [
			...names.map((name) => ({ name, from: "vue" })),
			...Object.entries(composables).flatMap(([module, names]) =>
				names.map((name) => ({ name, from: resolve(compat, module + ".ts") })),
			),
			{ name: "useScrollspy", from: resolve(root, "composables/useScrollSpy.ts") },
		],
	});
	return [
		{
			name: "site-vue-imports",
			enforce: "pre",
			resolveId(id) {
				if (id === "#imports") return importsEntry;
				if (id === "#components" || id === "virtual:site-components")
					return "\0virtual:site-components";
				if (id === "virtual:site-prose") return "\0" + id;
			},
			load(id) {
				if (id === "\0virtual:site-components")
					return readdirSync(resolve(root, "components"), {
						recursive: true,
						encoding: "utf8",
					})
						.filter((f) => f.endsWith(".vue"))
						.map((file) => {
							const name = file
								.replace(/(?:\.(?:client|server))?\.vue$/, "")
								.split(/[\/\-]/)
								.map((part) => part[0].toUpperCase() + part.slice(1))
								.join("");
							return (
								"export{default as " +
								name +
								"}from " +
								JSON.stringify(resolve(root, "components", file)) +
								";"
							);
						})
						.join("\n");
				if (id === "\0virtual:site-prose")
					return [...readdirSync(resolve(mdc, "runtime/components/prose")), "ProseCodeInline.vue"]
						.filter(
							(file) =>
								file.endsWith(".vue") &&
								!["ProseA.vue", "ProseImg.vue", "ProseTable.vue"].includes(file),
						)
						.map((file) => {
							const name = file.slice(0, -4);
							const path = ["ProsePre", "ProseCode", "ProseCodeInline"].includes(name)
								? resolve(content, "runtime/components/Prose", file)
								: resolve(mdc, "runtime/components/prose", file);
							return "export{default as " + name + "}from " + JSON.stringify(path) + ";";
						})
						.join("\n");
			},
			async transform(source, id) {
				if (
					id.includes("?") ||
					!/\.(vue|ts|js|mjs)$/.test(id) ||
					id.startsWith(compat + "/") ||
					(id.includes("/node_modules/") && !id.endsWith(".vue"))
				)
					return;
				let code = source
					.replaceAll("import.meta.client", "(!import.meta.env.SSR)")
					.replaceAll("import.meta.server", "import.meta.env.SSR")
					.replace(/((?:from|import)\s*['"][^'"]+\.svg)(['"])/g, "$1?component$2");
				if (id.endsWith(".vue")) {
					const script = /<script\b[^>]*>([\s\S]*?)<\/script>/.exec(code);
					if (!script) return code;
					return code.replace(
						script[0],
						script[0].replace(script[1], (await imports.injectImports(script[1])).code),
					);
				}
				return (await imports.injectImports(code)).code;
			},
		},
		unocss({
			configFile: resolve(root, "uno.config.ts"),
			content: {
				filesystem: [
					"components/**/*.vue",
					"layouts/**/*.vue",
					"pages/**/*.vue",
					"ssg/**/*.vue",
					"nuxt-compat/**/*.vue",
					"error.vue",
				].map((path) => resolve(root, path)),
			},
		}),
		svgLoader({
			defaultImport: "component",
			svgoConfig: {
				plugins: [
					{
						name: "preset-default",
						params: { overrides: { removeViewBox: false } },
					},
				],
			},
		}),
	];
}
export const common = ({ ssrOnly = false }: { ssrOnly?: boolean } = {}) => ({
	root,
	define: {
		__VUE_I18N_FULL_INSTALL__: true,
		__VUE_I18N_LEGACY_API__: false,
		__INTLIFY_PROD_DEVTOOLS__: false,
		__HUB_PUBLIC_CONFIG__: JSON.stringify({
			baseUrl: process.env.SITE_BASE_URL ?? "https://misskey-hub.net",
			serverListApiBaseUrl:
				process.env.SERVER_LIST_API_BASE_URL ?? "https://instanceapp.misskey.page",
		}),
	},
	publicDir: resolve(root, "public"),
	css: {
		postcss: {
			plugins: ssrOnly
				? []
				: [require("autoprefixer")(), require("cssnano")({ preset: "default" })],
		},
	},
	resolve: {
		alias: aliases,
		dedupe: ["vue", "@vue/runtime-core", "@vue/runtime-dom", "@vue/reactivity"],
	},
	plugins: plugins(),
});
