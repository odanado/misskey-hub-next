// Development host. Production uses the same renderer in a bounded worker pool.
import { resolve } from "node:path";
import { prepareData, withFallbackPage } from "./data.mjs";
import { root } from "./routes.mjs";
import { createDocumentParser } from "./markdown";
import { resolvePageAssets } from "./page-assets.mjs";
import { renderPage } from "./render";
export default {
	async routes(context: any) {
		const pages = withFallbackPage(await prepareData(createDocumentParser(context)));
		let assets: any;
		return pages.map((payload: any) => ({
			path: payload.path,
			...(payload.source ? { inputPath: resolve(root, "content", payload.source) } : {}),
			async render(ctx: any) {
				assets ??= resolvePageAssets(ctx, pages);
				return renderPage(payload, assets, pages);
			},
		}));
	},
};
