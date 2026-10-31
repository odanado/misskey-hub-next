import { build, createServer } from "vite";
import { resolve } from "node:path";
const root = resolve(import.meta.dirname, "..");
try {
	process.loadEnvFile(resolve(root, ".env"));
} catch (error) {
	if (error.code !== "ENOENT") throw error;
}
process.env.NODE_ENV = "production";
process.env.TZ ??= "Asia/Tokyo";
// Crowdin data and legacy redirects remain part of the production build.
const loader = await createServer({
	configFile: false,
	root,
	server: { middlewareMode: true, watch: null },
	appType: "custom",
});
try {
	const { fetchCrowdinMembers } = await loader.ssrLoadModule(
		"/scripts/fetch-crowdin.ts",
	);
	await fetchCrowdinMembers();
	await build({ root, configFile: resolve(root, "vite.config.mts") });
	const { generateOldHubRedirects } = await loader.ssrLoadModule(
		"/scripts/get-old-hub-redirects.ts",
	);
	await generateOldHubRedirects();
} finally {
	await loader.close();
}

// Vue auxiliary components may own timers; all awaited build writes are complete.
process.exit(0);
