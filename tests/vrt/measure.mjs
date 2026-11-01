import { readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { spawn, execFileSync } from "node:child_process";
import { cpus, platform, arch } from "node:os";
import assert from "node:assert/strict";
import { loadPages } from "../../ssg/routes.mjs";
import { sourceFingerprint } from "./evidence.mjs";
const directory = ".vrt";
await mkdir(directory, { recursive: true });
const pages = await loadPages(),
	fingerprint = await sourceFingerprint();
const result = {
	startedAt: new Date().toISOString(),
	commit: execFileSync("git", ["rev-parse", "HEAD"], {
		encoding: "utf8",
	}).trim(),
	dirty: !!execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim(),
	node: process.version,
	platform: platform() + "-" + arch(),
	cpu: cpus()[0].model,
	publicUrls: pages.length,
	sourceFingerprint: fingerprint,
	policy:
		"Three sequential fresh PNPM processes, startup through full production build including Crowdin preparation, client JS/CSS, all Markdown/YAML, Ox SSG, public assets and legacy redirects. Output checks outside timer. OS caches retained; external requests follow the configured application behavior; no concurrent VRT or build.",
	runs: [],
};
for (let round = 1; round <= 3; round++) {
	assert.equal(await sourceFingerprint(), fingerprint);
	const log = createWriteStream(directory + "/build-" + round + ".log"),
		start = performance.now();
	const args =
		platform() === "darwin" ? ["/usr/bin/time", "-l", "pnpm", "build"] : ["pnpm", "build"];
	const child = spawn(args[0], args.slice(1), {
		env: { ...process.env, NODE_ENV: "production", TZ: "Asia/Tokyo" },
		stdio: ["ignore", "pipe", "pipe"],
	});
	child.stdout.pipe(log, { end: false });
	child.stderr.pipe(log, { end: false });
	const exitCode = await new Promise((ok, fail) => {
			child.once("error", fail);
			child.once("close", ok);
		}),
		seconds = (performance.now() - start) / 1000;
	await new Promise((ok) => log.end(ok));
	assert.equal(exitCode, 0);
	for (const page of pages)
		assert.ok((await stat(".output/public" + page.path + "index.html")).size > 0, page.path);
	assert.ok((await stat(".output/public/404.html")).size > 0);
	const manifest = JSON.parse(await readFile(".output/public/.vite/manifest.json", "utf8"));
	assert.ok(!Object.keys(manifest).some((key) => key.endsWith(".md")));
	assert.equal(await sourceFingerprint(), fingerprint);
	result.runs.push({
		round,
		seconds,
		exitCode,
		verifiedPublicUrls: pages.length,
	});
	await writeFile(directory + "/benchmark.json", JSON.stringify(result, null, 2) + "\n");
	console.log(result.runs.at(-1));
}
result.medianSeconds = result.runs.map((row) => row.seconds).sort((a, b) => a - b)[1];
result.finishedAt = new Date().toISOString();
result.sourceUnchanged = true;
await writeFile(directory + "/benchmark.json", JSON.stringify(result, null, 2) + "\n");
console.log("Median:", result.medianSeconds);
