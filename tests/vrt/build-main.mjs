import { readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { execFileSync } from "node:child_process";
import { loadPages } from "../../ssg/routes.mjs";
const root = resolve(import.meta.dirname, "../..");
const baseline = process.env.VRT_BASELINE_DIR ?? resolve(root, ".vrt/main");
try {
	await stat(resolve(baseline, ".git"));
} catch (error) {
	if (process.env.VRT_BASELINE_DIR) throw error;
	execFileSync(
		"git",
		[
			"worktree",
			"add",
			"--detach",
			baseline,
			process.env.VRT_BASELINE_REF ??
				"origin/codex/ox-native-islands-production",
		],
		{ cwd: root, stdio: "inherit" },
	);
}
if (resolve(baseline) === root)
	throw Error("The baseline must be an independent checkout");
try {
	await stat(resolve(baseline, "node_modules"));
} catch {
	execFileSync("pnpm", ["install", "--frozen-lockfile"], {
		cwd: baseline,
		stdio: "inherit",
	});
}
const directory = resolve(baseline),
	config = resolve(directory, "nuxt.config.ts");
const pkg = JSON.parse(
	await readFile(resolve(directory, "package.json"), "utf8"),
);
const isOx = pkg.scripts?.build === "node ssg/build.mjs";
const original = isOx ? null : await readFile(config, "utf8");
const pages = await loadPages(),
	output = resolve(root, ".vrt");
await mkdir(output, { recursive: true });
await writeFile(
	resolve(output, "routes.json"),
	JSON.stringify(pages, null, 2) + "\n",
);
const module = resolve(output, "baseline-module.ts");
await writeFile(
	module,
	`export default function(_options,nuxt){nuxt.options.plugins.push(${JSON.stringify(resolve(import.meta.dirname, "ready.mjs"))});nuxt.options.routeRules={};nuxt.options.nitro.prerender={routes:${JSON.stringify(pages.map((p) => p.path))},crawlLinks:false,failOnError:true,concurrency:1,ignore:[route=>!${JSON.stringify(pages.map((p) => p.path))}.some(p=>route===p||route===p+'_payload.json')&&!['/api/','/__nuxt_island/','/_i18n/'].some(p=>route.startsWith(p))]};}`,
);
const modified = original?.replace(
	"modules: [",
	"modules: [" + JSON.stringify(module) + ",",
);
if (!isOx) {
	if (modified === original) throw Error("Cannot instrument Nuxt baseline");
	await writeFile(config, modified);
}
try {
	const log = createWriteStream(resolve(output, "baseline-build.log"));
	const start = performance.now();
	const child = spawn("pnpm", isOx ? ["build"] : ["exec", "nuxt", "generate"], {
		cwd: directory,
		env: { ...process.env, NODE_ENV: "production", TZ: "Asia/Tokyo" },
		stdio: ["ignore", "pipe", "pipe"],
	});
	child.stdout.pipe(log, { end: false });
	child.stderr.pipe(log, { end: false });
	const code = await new Promise((ok, fail) => {
		child.once("error", fail);
		child.once("close", ok);
	});
	await new Promise((ok) => log.end(ok));
	if (code !== 0)
		throw Error(
			"Baseline build failed: " + resolve(output, "baseline-build.log"),
		);
	const baselineCommit = execFileSync("git", ["rev-parse", "HEAD"], {
		cwd: directory,
		encoding: "utf8",
	}).trim();
	const result = {
		baselineCommit,
		finishedAt: new Date().toISOString(),
		seconds: (performance.now() - start) / 1000,
		urls: pages.length,
		baselineDirectory: directory,
	};
	await writeFile(
		resolve(output, "baseline-build.json"),
		JSON.stringify(result, null, 2) + "\n",
	);
	console.log(result);
} finally {
	if (!isOx) await writeFile(config, original);
}
