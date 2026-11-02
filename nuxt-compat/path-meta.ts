import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
const require = createRequire(import.meta.url);
const contentDist = dirname(require.resolve("@nuxt/content"));
export const { generatePath, default: pathMeta } = await import(
	resolve(contentDist, "runtime/transformers/path-meta.js")
);
