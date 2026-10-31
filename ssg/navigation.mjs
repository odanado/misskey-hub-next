// Port of Nuxt Content v2's MIT-licensed navigation builder. Operates on fresh
// source metadata only; no Nuxt cache, generated page, or baseline snapshot.
import { generatePath, pathMeta } from "./path-meta.mjs";
const collator = new Intl.Collator(undefined, {
	numeric: true,
	sensitivity: "base",
});
const title = (part) =>
	part
		.split(/[\s-]/)
		.map((s) => s.charAt(0).toUpperCase() + s.slice(1))
		.join(" ");
const pick = (item) => ({
	title: item.title,
	...(item.date !== undefined ? { date: item.date } : {}),
	...(item.description !== undefined ? { description: item.description } : {}),
	...(item.navigation && typeof item.navigation === "object"
		? item.navigation
		: {}),
});
export function createNavigation(contents, configurations) {
	const nav = [];
	for (const content of [...contents].sort((a, b) =>
		a._path.localeCompare(b._path),
	)) {
		const parts = content._path.slice(1).split("/");
		const make = () => ({
			title: content.title,
			_path: content._path,
			_file: content._file,
			children: [],
			...pick(content),
		});
		const item = make();
		const isIndex = /([1-9][0-9]*\.)?index.md/.test(
			content._id.split(":").at(-1),
		);
		if (isIndex) {
			const config = configurations[item._path];
			if (config?.navigation === false) continue;
			if (content._path !== "/") item.children.push(make());
			if (config) Object.assign(item, pick(config));
		}
		if (parts.length === 1) {
			nav.push(item);
			continue;
		}
		let nodes = nav;
		for (let index = 0; index < parts.length - 1; index++) {
			const path = "/" + parts.slice(0, index + 1).join("/");
			const config = configurations[path];
			if (config?.navigation === false) {
				nodes = [];
				break;
			}
			let parent = nodes.find((n) => n._path === path);
			if (!parent) {
				parent = {
					title: title(parts[index]),
					_path: path,
					_file: content._file,
					children: [],
					...(config ? pick(config) : {}),
				};
				nodes.push(parent);
			}
			nodes = parent.children;
		}
		nodes.push(item);
	}
	function sort(nodes) {
		nodes.forEach((n) => {
			n._file = n._file.split(".").slice(0, -1).join(".");
		});
		nodes.sort((a, b) => collator.compare(a._file, b._file));
		for (const node of nodes) {
			if (node.children.length) sort(node.children);
			else delete node.children;
			delete node._file;
		}
		return nodes;
	}
	return sort(nav);
}
export function metadata(source, fields) {
	return pathMeta.transform(
		{ ...fields, _id: "content:" + source.replaceAll("/", ":") },
		{ defaultLocale: "" },
	);
}
export const sourceOrder = (a, b) => collator.compare(a._stem, b._stem);
