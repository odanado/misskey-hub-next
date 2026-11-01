import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, writeFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

// Build the unmodified PR head separately; never instrument or rewrite its source.
const commit = process.argv[2];
assert.match(commit ?? "", /^[0-9a-f]{40}$/, "Pass the full reference commit SHA");
const directory = resolve(process.argv[3] ?? ".vrt/reference");
const root = resolve(import.meta.dirname, "../..");
const output = resolve(root, ".vrt");
await mkdir(output, { recursive: true });
execFileSync("git", ["fetch", "https://github.com/odanado/misskey-hub-next.git", commit], {
	cwd: root,
	stdio: "inherit",
});
execFileSync("git", ["worktree", "add", "--detach", directory, commit], {
	cwd: root,
	stdio: "inherit",
});
execFileSync("pnpm", ["install", "--frozen-lockfile"], { cwd: directory, stdio: "inherit" });
const startedAt = new Date().toISOString();
const start = performance.now();
execFileSync("pnpm", ["build"], {
	cwd: directory,
	stdio: "inherit",
	env: { ...process.env, NODE_ENV: "production", TZ: "Asia/Tokyo" },
});
const seconds = (performance.now() - start) / 1000;
process.chdir(directory);
const { loadPages } = await import(pathToFileURL(resolve(directory, "ssg/routes.mjs")).href);
const pages = await loadPages();
for (const page of pages)
	assert.ok(
		(await stat(resolve(directory, ".output/public/" + page.path + "index.html"))).size > 0,
		page.path,
	);
assert.ok((await stat(resolve(directory, ".output/public/404.html"))).size > 0);
const { sourceFingerprint } = await import(
	pathToFileURL(resolve(directory, "tests/vrt/evidence.mjs")).href
);
const receipt = {
	commit,
	baselineDirectory: directory,
	sourceFingerprint: await sourceFingerprint(),
	node: process.version,
	publicUrls: pages.length,
	startedAt,
	finishedAt: new Date().toISOString(),
	seconds,
	policy:
		"One unmodified full PNPM production build; install and output checks excluded from timer. VRT reference is the pinned PR head before optimization.",
};
await writeFile(resolve(output, "reference-build.json"), JSON.stringify(receipt, null, 2) + "\n");
console.log(receipt);
