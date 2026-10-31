import { resolve } from "node:path";
import { readdirSync } from "node:fs";
import { createUnimport } from "unimport";
import unocss from "unocss/vite";
import svgLoader from "vite-svg-loader";
import autoprefixer from "autoprefixer";
import cssnano from "cssnano";
export const root = resolve(import.meta.dirname, "..");
const runtime = resolve(import.meta.dirname, "runtime.ts");
const prose = resolve(root, "ssg/prose");
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
const composables = [
	"useState",
	"useRoute",
	"useRouter",
	"useRuntimeConfig",
	"useI18n",
	"useColorMode",
	"useGLocalePath",
	"useGSwitchLocalePath",
	"useGAsyncData",
	"queryContent",
	"fetchContentNavigation",
	"useHead",
	"definePageMeta",
	"createError",
	"useScrollspy",
	"useNuxtApp",
	"useAppConfig",
	"defineAppConfig",
	"defineI18nRoute",
	"onBeforeRouteLeave",
	"navigateTo",
	"useFetch",
];
export const aliases = {
	"@": root,
	"~": root,
	assets: resolve(root, "assets"),
	"#imports": runtime,
	bi: resolve(root, "node_modules/bootstrap-icons/icons"),
};
export function plugins() {
	const imports = createUnimport({
		imports: [...names, ...composables].map((name) => ({
			name,
			from: runtime,
		})),
	});
	return [
		{
			name: "site-vue-imports",
			enforce: "pre",
			resolveId(id) {
				if (id === "#imports") return runtime;
				if (id === "#components" || id === "virtual:site-components")
					return "\0virtual:site-components";
				if (id === "virtual:site-prose") return "\0" + id;
			},
			load(id) {
				if (id === "\0virtual:site-components")
					return readdirSync(resolve(root, "components"), { recursive: true })
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
                    return readdirSync(prose).filter(file => file.endsWith(".vue")).map(file =>
                        `export{default as ${file.slice(0,-4)}}from ${JSON.stringify(resolve(prose,file))};`
                    ).join("\n");
			},
			async transform(source, id) {
				if (
					id.includes("?") ||
					!/\.(vue|ts|js|mjs)$/.test(id) ||
					id === runtime ||
					(id.includes("/node_modules/") && !id.endsWith(".vue"))
				)
					return;
				let code = source
					.replaceAll("import.meta.client", "(!import.meta.env.SSR)")
					.replaceAll("import.meta.server", "import.meta.env.SSR")
					.replace(
						/((?:from|import)\s*['"][^'"]+\.svg)(['"])/g,
						"$1?component$2",
					);
				if (id.endsWith(".vue")) {
					const script = /<script\b[^>]*>([\s\S]*?)<\/script>/.exec(code);
					if (!script) return code;
					return code.replace(
						script[0],
						script[0].replace(
							script[1],
							(await imports.injectImports(script[1])).code,
						),
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
export const common = () => ({
	root,
	define: {
		__VUE_I18N_FULL_INSTALL__: true,
		__VUE_I18N_LEGACY_API__: false,
		__INTLIFY_PROD_DEVTOOLS__: false,
		__HUB_PUBLIC_CONFIG__: JSON.stringify({
			baseUrl: process.env.SITE_BASE_URL ?? "https://misskey-hub.net",
			serverListApiBaseUrl:
				process.env.SERVER_LIST_API_BASE_URL ??
				"https://instanceapp.misskey.page",
		}),
	},
	publicDir: resolve(root, "public"),
	css: {
		postcss: { plugins: [autoprefixer(), cssnano({ preset: "default" })] },
	},
	resolve: {
		alias: aliases,
		dedupe: ["vue", "@vue/runtime-core", "@vue/runtime-dom", "@vue/reactivity"],
	},
	plugins: plugins(),
});
