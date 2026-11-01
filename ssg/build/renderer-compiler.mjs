import { parentPort, workerData } from "node:worker_threads";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

try {
	const { build } = await import("vite");
	const entry = resolve(workerData.root, "ssg/render.ts");
	await build({
		root: workerData.root,
		configFile: resolve(workerData.root, "vite.config.mts"),
		logLevel: "error",
		build: {
			ssr: entry,
			outDir: workerData.outDir,
			copyPublicDir: false,
			emptyOutDir: false,
			manifest: false,
			minify: false,
			rollupOptions: { input: entry, output: { entryFileNames: "renderer.mjs" } },
		},
	});
	parentPort.postMessage({
		type: "bundle",
		url: pathToFileURL(resolve(workerData.outDir, "renderer.mjs")).href,
	});
} catch (error) {
	parentPort.postMessage({ type: "error", error: error.stack ?? String(error) });
}
parentPort.close();
