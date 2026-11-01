import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import yaml from "js-yaml";
import { localesConst } from "../assets/data/locales.ts";
import { pathMeta } from "../nuxt-compat/path-meta.ts";
export const root = resolve(import.meta.dirname, "..");
export const outDir = resolve(root, ".output/public");
export async function loadPages() {
	const documents = new Map(),
		directories = new Map();
	for (const source of (
		await readdir(resolve(root, "content"), { recursive: true })
	).filter(
		(f) =>
			/\.(md|ya?ml)$/.test(f) && !f.split("/").some((p) => p.startsWith(".")),
	)) {
		const raw = await readFile(resolve(root, "content", source), "utf8");
		const front = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(raw);
		const fields = source.endsWith(".md")
			? front
				? (yaml.load(front[1]) ?? {})
				: {}
			: (yaml.load(raw) ?? {});
		const item = pathMeta.transform(
			{ ...fields, _id: "content:" + source.replaceAll("/", ":") },
			{ defaultLocale: "" },
		);
		if (item._draft) continue;
		if (item._partial && item._path.endsWith("/_dir"))
			directories.set(item._path.slice(0, -5), source);
		else if (!item._partial) documents.set(item._path, source);
	}
	const routes = new Map();
	const add = (page) => {
		if (routes.has(page.path))
			throw Error("Duplicate public route: " + page.path);
		routes.set(page.path, page);
	};
	for (const locale of localesConst) {
		const code = locale.code === "ja-ks" ? "ja" : locale.code;
		const docs = new Map(
			[...directories, ...documents].filter(([path]) =>
				path.startsWith("/" + code + "/docs/"),
			),
		);
		for (const [path, source] of docs)
			add({
				path: path.replace("/" + code + "/", "/" + locale.code + "/") + "/",
				source,
				locale: locale.code,
				kind: "docs",
				pageFile: "pages/docs/[...slug].vue",
			});
	}
	for (const [path, source] of documents)
		if (path.startsWith("/blog/"))
			add({
				path: "/ja" + path + "/",
				source,
				locale: "ja",
				kind: "blog",
				pageFile: "pages/blog/[slug].vue",
			});
	for (const file of (
		await readdir(resolve(root, "pages"), { recursive: true })
	).filter(
		(f) =>
			f.endsWith(".vue") && !f.includes("slug") && !/-ignore\.vue$/.test(f),
	)) {
		const path =
			"/" +
			file
				.replace(/(index)?(\.(server|client))?\.vue$/, "")
				.replace(/\.vue$/, "");
		const suffix = path.endsWith("/") ? path : path + "/";
		if (suffix === "/ns/")
			add({
				path: suffix,
				source: documents.get("/ns"),
				locale: "ja",
				kind: "static",
				pageFile: "pages/" + file,
			});
		else
			for (const locale of localesConst)
				add({
					path: "/" + locale.code + suffix,
					locale: locale.code,
					kind: "static",
					pageFile: "pages/" + file,
				});
	}
	for (const page of [...routes.values()].filter((page) =>
		page.path.startsWith("/ja/"),
	))
		add({ path: page.path.slice(3), locale: "ja", kind: "languageEntry" });
	return [...routes.values()].sort((a, b) => a.path.localeCompare(b.path));
}
