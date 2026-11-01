import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { loadPages } from "./routes.mjs";

const pages = await loadPages();
for (const page of pages)
	assert.ok((await stat(".output/public" + page.path + "index.html")).size > 0, page.path);
assert.ok((await stat(".output/public/404.html")).size > 0);
const manifest = JSON.parse(await readFile(".output/public/.vite/manifest.json", "utf8"));
assert.ok(!Object.keys(manifest).some((name) => name.endsWith(".md")));
let publicFiles = 0;
for (const file of await readdir("public", { recursive: true })) {
	const source = resolve("public", file);
	if (!(await stat(source)).isFile()) continue;
	assert.deepEqual(await readFile(resolve(".output/public", file)), await readFile(source), file);
	publicFiles++;
}
console.log(
	JSON.stringify({ publishedPages: pages.length, fallback404: true, publicFiles, manifest: true }),
);
