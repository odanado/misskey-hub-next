import { head, serialize } from '../nuxt-compat/head.mjs';
export function documentHtml(payload, body, assets) {
	const lang =
		payload.locales.find((l) => l.code === (payload.locale ?? payload.path.split('/')[1]))
			?.language ?? 'ja-JP';
	return `<!DOCTYPE html><html lang="${lang}" class="scroll-pt-32 lg:scroll-pt-20"><head>${head(payload)}${assets.css.map((href) => `<link rel="stylesheet" href="${href}">`).join('')}</head><body><div id="__nuxt">${body}</div><script id="port-data" type="application/json">${serialize(payload)}</script><script type="module" src="${assets.js}"></script></body></html>`;
}
