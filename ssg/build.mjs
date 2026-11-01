import { copyFile, rm } from "node:fs/promises";
import { resolve } from "node:path";
const root = resolve(import.meta.dirname, "..");
const started = performance.now(),
	stages = { node: process.version };
const mark = (name) => {
	stages[name] = performance.now() - started;
};
try {
	process.loadEnvFile(resolve(root, ".env"));
} catch (error) {
	if (error.code !== "ENOENT") throw error;
}
process.env.NODE_ENV = "production";
// Bound native pools while Markdown and renderer preparation share the CPU.
process.env.ROLLDOWN_WORKER_THREADS ??= "4";
process.env.RAYON_NUM_THREADS ??= "4";
process.env.MISSKEY_SSG_PARALLEL = "1";
process.env.TZ ??= "Asia/Tokyo";
// Prepare the original Crowdin data while Vite loads. Native TypeScript loading
// avoids starting a separate Vite dev server for these two build-only scripts.
const vite = import("vite");
void vite.catch(() => {});
const { fetchCrowdinMembers } = await import("../scripts/fetch-crowdin.ts");
await fetchCrowdinMembers();
mark("crowdinReady");
const { createBuildPipeline } = await import("./build/pipeline.mjs");
const pipeline = createBuildPipeline(root);
mark("pipelineStarted");
try {
	const { build } = await vite;
	mark("viteReady");
	await build({ root, configFile: resolve(root, "vite.config.mts") });
	mark("siteBuilt");
	const { generateOldHubRedirects } = await import("../scripts/get-old-hub-redirects.ts");
	mark("redirectsLoaded");
	await generateOldHubRedirects();
	mark("redirectsWritten");
	await copyFile(
		resolve(root, ".output/public/404/index.html"),
		resolve(root, ".output/public/404.html"),
	);
	await rm(resolve(root, ".output/public/404"), { recursive: true });
	mark("complete");
} finally {
	await pipeline.dispose();
}
if (process.env.MISSKEY_SSG_PROFILE === "1") console.log("[ssg-build] " + JSON.stringify(stages));
