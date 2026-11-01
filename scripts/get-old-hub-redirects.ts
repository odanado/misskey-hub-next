import { redirects } from "./../assets/data/old-hub-redirects.ts";
import { localesConst, localePathRegex } from "./../assets/data/locales.ts";
import type { LocaleCodes } from "./../assets/data/locales.ts";
import type { PartialRecord } from "./../types/others";
import { joinURL } from "ufo";
import { readFileSync, promises as fsp } from "fs";
import { mkdir, open } from "fs/promises";

// 旧Hub時代の各言語のプレフィックス
const hubLocales: PartialRecord<LocaleCodes, string> = {
	ja: "/",
	en: "/en",
	id: "/id",
	ko: "/ko",
	it: "/it",
	pl: "/pl",
	fr: "/fr",
	cn: "/zh-CN",
	tw: "/zh-TW",
};

export async function generateOldHubRedirects() {
	const out = new Map<string, string>();

	localesConst
		.filter((v) => hubLocales.hasOwnProperty(v.code))
		.forEach((locale) => {
			redirects.forEach((route) => {
				if (route[0].startsWith("/ns") || ["/", "/index.html"].includes(route[0])) return;

				let destination = route[1];

				if (!localePathRegex.test(destination)) {
					destination = joinURL(`/${locale.code}`, destination);
				}

				if (route[0].endsWith(".md")) return;

				out.set(joinURL(hubLocales[locale.code] ?? "/", route[0]), destination);
			});
		});

	function getRedirectHtml(destination: string) {
		return `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="refresh" content="0; url=${destination}">
    <link rel="canonical" href="${destination}">
</head>
<body></body>
</html>`;
	}

	const redirectsDir = "./.output/public";
	if (process.env.CF_PAGES === "1") {
		const template = readFileSync("./public/_redirects_template", "utf8");
		const markdown = redirects
			.filter(([source]) => source.endsWith(".md"))
			.map(([source, target]) => `${source} ${target} 301`);
		await fsp.writeFile(`${redirectsDir}/_redirects`, template + "\n" + markdown.join("\n"));
	}

	const outputs = new Map<string, string>();
	for (const [src, dest] of out.entries()) {
		let srcPath = src;
		if (srcPath.endsWith("/")) srcPath += "index.html";
		else if (srcPath.endsWith(".md")) srcPath = srcPath.slice(0, -3) + ".html";
		const filePath = redirectsDir + srcPath;
		// Distinct legacy URLs can normalize to the same file. The original
		// sequential writer gives its first definition priority.
		if (!outputs.has(filePath)) outputs.set(filePath, dest);
	}
	const entries = [...outputs];
	let cursor = 0;
	await Promise.all(
		Array.from({ length: Math.min(16, entries.length) }, async () => {
			while (cursor < entries.length) {
				const [filePath, destination] = entries[cursor++];
				await mkdir(filePath.substring(0, filePath.lastIndexOf("/")), { recursive: true });
				let file;
				try {
					// Never overwrite a generated page or a pre-existing redirect.
					file = await open(filePath, "wx");
				} catch (error) {
					if ((error as NodeJS.ErrnoException).code === "EEXIST") continue;
					throw error;
				}
				try {
					await file.writeFile(getRedirectHtml(destination));
				} finally {
					await file.close();
				}
			}
		}),
	);
}
