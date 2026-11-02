import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const words = (name: string) => name.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Keep components used exclusively through Nuxt's Lazy prefix out of the eager registry. */
export function componentRegistry(root: string) {
	const sources = ["components", "pages", "layouts"].flatMap((dir) =>
		readdirSync(resolve(root, dir), { recursive: true, encoding: "utf8" })
			.filter((file) => file.endsWith(".vue"))
			.map((file) => ({ file: resolve(root, dir, file), source: readFileSync(resolve(root, dir, file), "utf8") })),
	);
	for (const file of ["app.vue", "error.vue"])
		sources.push({ file: resolve(root, file), source: readFileSync(resolve(root, file), "utf8") });
	const source = sources.map((item) => item.source).join("\n");
	const entries = readdirSync(resolve(root, "components"), { recursive: true, encoding: "utf8" })
		.filter((file) => file.endsWith(".vue"))
		.sort()
		.map((file) => ({
			file: resolve(root, "components", file),
			name: file.replace(/(?:\.(?:client|server|global))?\.vue$/, "")
				.split(/[\/\-]/).map((part) => part[0].toUpperCase() + part.slice(1)).join(""),
			client: file.endsWith(".client.vue"),
		}));
	const lines = [
		'import { defineAsyncComponent as asyncComponent } from "vue";',
		`import { clientComponent } from ${JSON.stringify(resolve(root, "nuxt-compat/components/client-component.ts"))};`,
	];
	for (const { file, name, client } of entries) {
		if (name.startsWith("Lazy")) throw Error(`Reserved Nuxt Lazy prefix in component filename: ${file}`);
		const kebab = words(name);
		const lazy = new RegExp(`\\bLazy${escape(name)}\\b|\\blazy-${escape(kebab)}\\b`).test(source);
		const eager = new RegExp(`\\b${escape(name)}\\b|(?<![\\w-])${escape(kebab)}(?![\\w-])`).test(source);
		const load = `() => import(${JSON.stringify(file)})`;
		if (client) lines.push(`export const ${name} = clientComponent(${load});`);
		else if (lazy && !eager) lines.push(`export const ${name} = asyncComponent(${load});`);
		else lines.push(`import C${name} from ${JSON.stringify(file)}; export { C${name} as ${name} };`);
		lines.push(`export const Lazy${name} = ${client || (lazy && !eager) ? name : `asyncComponent(() => Promise.resolve(C${name}))`};`);
	}
	// These are additional Nuxt delayed-hydration prefixes, not ordinary Lazy.
	// Do not silently render an unknown HTML tag if a future page starts using them.
	for (const item of sources) {
		if (/<(?:Lazy(?:Idle|Visible|Interaction|MediaQuery|If|Never|Time)[A-Z]|lazy-(?:idle|visible|interaction|media-query|if|never|time)-)|\bhydrate-(?:on-|after|when|never)/.test(item.source))
			throw Error(`Nuxt delayed hydration is not implemented by the static host: ${item.file}`);
	}
	return lines.join("\n");
}
