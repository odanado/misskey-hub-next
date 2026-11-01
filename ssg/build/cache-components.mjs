import { readFileSync } from "node:fs";
const runtime = readFileSync(new URL("./aside-cache-runtime.mjs", import.meta.url), "utf8");
export function cacheComponents() {
	return {
		name: "misskey-ssg-component-cache",
		enforce: "post",
		transform: {
			order: "post",
			handler(code, id, options) {
				if (!options?.ssr || !id.endsWith("/components/docs/AsideNav.vue")) return;
				if (code.split("export default ").length !== 2)
					throw new Error("Unexpected compiled AsideNav module");
				code =
					code.replace("export default ", "const ssgAsideComponent = ") +
					runtime +
					"\nexport default wrapInactiveAside(ssgAsideComponent);";
				const imported = /import\s*\{\s*isSamePath\s*\}\s*from\s*['"]ufo['"];?/;
				return code.replace(
					imported,
					`import { isSamePath as uncachedSamePath } from 'ufo';
        const samePaths = new Map();
        const isSamePath = (left, right) => {
          let row = samePaths.get(left);
          if (!row) samePaths.set(left, row = new Map());
          if (!row.has(right)) row.set(right, uncachedSamePath(left, right));
          return row.get(right);
        };`,
				);
			},
		},
	};
}
