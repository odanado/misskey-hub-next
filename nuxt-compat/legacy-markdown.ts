import { parseMdc } from "./mdc.ts";

export { legacyMdcSources } from "./legacy-sources.ts";

export async function parseLegacyDocument(entry: any, parse = parseMdc) {
	const parsed = await parse(entry.body, entry.source);
	return {
		...parsed,
		...entry.frontmatter,
		title: entry.frontmatter.title ?? parsed.title,
		description: entry.frontmatter.description ?? parsed.description,
		_path: entry.path,
		_file: entry.source,
		_parsing: { engine: "mdc", fullMdcFallback: true },
	};
}
