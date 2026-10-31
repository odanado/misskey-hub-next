import { parseMdc } from "./mdc.mjs";

// Legacy Markdown that differs structurally between MDC and Ox: release notes,
// nested/escaped links, interpolation, adjacent Unicode emphasis, or unclosed HTML.
// Keep these explicit until their source syntax can be migrated independently.
// tests/corpus.test.mjs checks every Markdown source against the original parser.
export const legacyMdcSources = new Set([
	"blog/2023-02-08-contribute-to-earn.md",
	"blog/2023-08-30-conoha.md",
	"ca/docs/2.for-users/3.features/hashtag.md",
	"ca/docs/5.releases.md",
	"cn/docs/2.for-users/3.features/hashtag.md",
	"cn/docs/5.releases.md",
	"de/docs/1.about-misskey.md",
	"de/docs/2.for-users/3.features/hashtag.md",
	"de/docs/5.releases.md",
	"en/docs/2.for-users/3.features/hashtag.md",
	"en/docs/5.releases.md",
	"es/docs/3.for-admin/install/guides/ubuntu-manual.md",
	"es/docs/5.releases.md",
	"fr/docs/2.for-users/3.features/hashtag.md",
	"fr/docs/3.for-admin/install/guides/ubuntu-manual.md",
	"fr/docs/5.releases.md",
	"id/docs/2.for-users/3.features/hashtag.md",
	"id/docs/5.releases.md",
	"it/docs/2.for-users/3.features/hashtag.md",
	"it/docs/3.for-admin/install/guides/ubuntu-manual.md",
	"it/docs/5.releases.md",
	"ja/docs/2.for-users/3.features/hashtag.md",
	"ja/docs/3.for-admin/features/announcement.md",
	"ja/docs/5.releases.md",
	"ko/docs/2.for-users/3.features/hashtag.md",
	"ko/docs/2.for-users/3.features/mfm.md",
	"ko/docs/3.for-admin/install/guides/2.service.md",
	"ko/docs/3.for-admin/install/guides/ubuntu-manual.md",
	"ko/docs/3.for-admin/install/resources/troubleshooting.md",
	"ko/docs/5.releases.md",
	"pl/docs/2.for-users/3.features/hashtag.md",
	"pl/docs/3.for-admin/install/guides/ubuntu-manual.md",
	"pl/docs/5.releases.md",
	"th/docs/2.for-users/3.features/hashtag.md",
	"th/docs/2.for-users/3.features/online-status.md",
	"th/docs/5.releases.md",
	"tw/docs/3.for-admin/install/guides/bash.md",
	"tw/docs/5.releases.md"
]);

export async function parseLegacyDocument(entry) {
	const parsed = await parseMdc(entry.body, entry.source);
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
