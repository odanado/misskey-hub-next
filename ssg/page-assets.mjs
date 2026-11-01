import { resolve } from "node:path";
import { root } from "./routes.mjs";

export function resolvePageAssets(context, pages) {
	if (context.mode === "serve") return { js: "/ssg/client.ts", css: [] };
	const client = resolve(root, "ssg/client.ts");
	const styles = (modules) => {
		const result = context.assets.stylesheets({ modules });
		if (result.diagnostics.length || !result.stylesheets.length)
			throw new Error("Missing page CSS: " + JSON.stringify(result.diagnostics));
		return result.stylesheets.map((style) => style.href);
	};
	const entry = Object.values(context.assets.clientManifest).find((value) => value.isEntry);
	if (!entry) throw new Error("Missing client entry");
	const css = styles([client]);
	const byPage = Object.fromEntries(
		[
			...new Set(
				pages.filter((page) => page.kind !== "docs" && page.pageFile).map((page) => page.pageFile),
			),
		].map((file) => [file, styles([client, resolve(root, file)])]),
	);
	return { js: "/" + entry.file, css, pages: byPage };
}
