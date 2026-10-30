import { tick, elapsed } from '../tooling/profiling.mjs';
const escape = (value) =>
	String(value ?? '')
		.replaceAll('&', '&amp;')
		.replaceAll('"', '&quot;')
		.replaceAll('<', '&lt;');
export const serialize = (data) => {
	const start = tick();
	const json = JSON.stringify(data);
	elapsed('html.jsonStringify', start);
	const escapeStart = tick();
	const escaped = json.replaceAll('<', '\\u003c');
	elapsed('html.escapeSerializedJson', escapeStart);
	return escaped;
};
export const themeScript = `(()=>{const p=localStorage.getItem('nuxt-color-mode')||'system';const t=p==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):p;document.documentElement.classList.add(t);document.documentElement.dataset.bsTheme=t})()`;
export function head(payload) {
	const doc = payload.document;
	const description = doc.description || payload.messages._seo.defaultDescription;
	const title = doc.title + ' | Misskey';
	// Preserve the current Nuxt i18n canonical suffix during this comparison.
	// The English double trailing slash is a pre-existing, separate SEO issue.
	const canonical =
		'https://misskey-hub.net' + payload.path + (payload.path.startsWith('/ja/') ? '' : '/');
	const locale = payload.path.split('/')[1];
	const graph = {
		'@context': 'https://schema.org',
		'@graph': [
			{
				'@type': 'Organization',
				'@id': 'https://misskey-hub.net/#Organization',
				name: 'Misskey',
				url: 'https://misskey-hub.net/',
				sameAs: ['https://ja.wikipedia.org/wiki/Misskey'],
				logo: { '@type': 'ImageObject', url: 'https://misskey-hub.net/img/icons/icon-256x256.png' },
			},
			{
				'@type': 'WebSite',
				'@id': 'https://misskey-hub.net/#WebPage',
				name: locale.includes('ja') ? '【Misskeyプロジェクト公式】Misskey Hub' : 'Misskey',
				inLanguage: locale,
				url: 'https://misskey-hub.net' + payload.path,
				publisher: { '@type': 'Organization', '@id': 'https://misskey-hub.net/#Organization' },
				headline: title,
				description,
			},
		],
	};
	return `<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)}</title>
<meta name="description" content="${escape(description)}"><link rel="canonical" href="${canonical}">
<meta property="og:title" content="${escape(title)}"><meta property="og:description" content="${escape(description)}"><meta property="og:site_name" content="Misskey"><meta property="og:image" content="https://misskey-hub.net/img/og/misskey-hub-screenshot-l.png">
<meta name="theme-color" content="#9ad11b"><meta name="twitter:card" content="summary_large_image">
<link rel="stylesheet" href="/fonts/fonts.css"><link rel="icon" href="/favicon.ico"><link rel="apple-touch-icon" href="/img/icons/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Capriola&family=Nunito:ital,wght@0,400;0,700;1,400;1,700&display=swap">
${payload.locales.map((locale) => `<link rel="alternate" hreflang="${locale.language}" href="https://misskey-hub.net${payload.path.replace(/^\/[a-z-]+\//, '/' + locale.code + '/')}">`).join('')}
${payload.styles ? `<style>${payload.styles}</style>` : ''}<script type="application/ld+json">${serialize(graph)}</script><script>${themeScript}</script>`;
}
