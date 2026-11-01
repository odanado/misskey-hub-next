import { readFile, readdir, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
const directories = [
	"ssg",
	"plugins",
	"nuxt-compat",
	"components",
	"pages",
	"layouts",
	"composables",
	"assets",
	"content",
	"locales",
	"public",
	"scripts",
	"tests",
];
export async function sourceFingerprint() {
	const paths = [
		"package.json",
		"pnpm-lock.yaml",
		"app.vue",
		"app.config.ts",
		"uno.config.ts",
		"vite.config.mts",
		"tsconfig.json",
		"vercel.json",
	];
	for (const directory of directories)
		for (const file of await readdir(directory, { recursive: true })) {
			if (file.split("/").some((part) => part.startsWith("."))) continue;
			const path = directory + "/" + file;
			if ((await stat(path)).isFile()) paths.push(path);
		}
	const hash = createHash("sha256");
	for (const file of [...new Set(paths)].sort())
		hash
			.update(file)
			.update("\0")
			.update(await readFile(file));
	return hash.digest("hex");
}
