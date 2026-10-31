const escape = (value) =>
	String(value ?? "")
		.replaceAll("&", "&amp;")
		.replaceAll('"', "&quot;")
		.replaceAll("<", "&lt;");
export const serialize = (data) => {
	const json = JSON.stringify(data);

	const escaped = json.replaceAll("<", "\\u003c");

	return escaped;
};
export const themeScript = (forced) =>
	`(()=>{const p=${JSON.stringify(forced)}||localStorage.getItem('nuxt-color-mode')||'system';const t=p==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):p;document.documentElement.classList.add(t);document.documentElement.dataset.bsTheme=t})()`;
export function head(payload) {
	const doc = payload.document;
	const description =
		doc.description || payload.messages._seo.defaultDescription;
	const title =
		payload.pageFile === "pages/index.vue"
			? payload.messages._seo.siteNameLong
			: doc.title
				? doc.title + " | Misskey"
				: payload.messages._seo.siteNameLong;
	const canonical = "https://misskey-hub.net" + payload.path;
	const locales =
		payload.kind === "blog"
			? payload.locales.filter((locale) => locale.code === "ja")
			: payload.path === "/ns/"
				? []
				: payload.locales;
	const locale = payload.locale;
	const google = locale === "cn" ? "cn" : "com";
	const graph = {
		"@context": "https://schema.org",
		"@graph": [
			{
				"@type": "Organization",
				"@id": "https://misskey-hub.net/#Organization",
				name: "Misskey",
				url: "https://misskey-hub.net/",
				sameAs: ["https://ja.wikipedia.org/wiki/Misskey"],
				logo: {
					"@type": "ImageObject",
					url: "https://misskey-hub.net/img/icons/icon-256x256.png",
				},
			},
			{
				"@type": "WebSite",
				"@id": "https://misskey-hub.net/#WebPage",
				name: locale.includes("ja")
					? "【Misskeyプロジェクト公式】Misskey Hub"
					: "Misskey",
				inLanguage: locale,
				url: "https://misskey-hub.net" + payload.path,
				publisher: {
					"@type": "Organization",
					"@id": "https://misskey-hub.net/#Organization",
				},
				headline: title,
				description,
			},
			...(doc.graph ?? []),
		],
	};
	return `<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)}</title>
<meta name="description" content="${escape(description)}"><link rel="canonical" href="${canonical}">
<meta property="og:title" content="${escape(title)}"><meta property="og:description" content="${escape(description)}"><meta property="og:site_name" content="Misskey"><meta property="og:image" content="${escape(doc.thumbnail || "https://misskey-hub.net/img/og/misskey-hub-screenshot-l.png")}">
<meta name="theme-color" content="#9ad11b"><meta name="twitter:card" content="summary_large_image">
<link rel="stylesheet" href="/fonts/fonts.css"><link rel="icon" href="/favicon.ico"><link rel="apple-touch-icon" href="/img/icons/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.${google}"><link rel="preconnect" href="https://fonts.gstatic.${google}"><link rel="stylesheet" href="https://fonts.googleapis.${google}/css2?family=Capriola&family=Nunito:ital,wght@0,400;0,700;1,400;1,700&display=swap">
${locales.map((locale) => `<link rel="alternate" hreflang="${locale.language}" href="https://misskey-hub.net${payload.path.replace(/^\/[a-z-]+\//, "/" + locale.code + "/")}">`).join("")}
${payload.locale === "ja-ks" ? '<meta name="robots" content="noindex">' : ""}${payload.styles ? `<style>${payload.styles}</style>` : ""}<script type="application/ld+json">${serialize(graph)}</script><script>${themeScript(payload.pageMeta?.colorMode)}</script>`;
}
