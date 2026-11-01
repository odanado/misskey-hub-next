import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { loadPages } from "../../ssg/routes.mjs";
import { validateCoverage } from "./coverage.mjs";

const root = resolve(process.argv[2] ?? ".vrt/combined");
const referenceCommit = process.argv[3];
assert.match(referenceCommit ?? "", /^[0-9a-f]{40}$/, "Pass the pinned reference commit");
const reports = [];
for (const file of await readdir(root, { recursive: true })) {
	if (!file.endsWith("/vrt.json")) continue;
	const directory = dirname(resolve(root, file));
	const json = async (name) => JSON.parse(await readFile(resolve(directory, name), "utf8"));
	reports.push({
		manifest: await json("vrt-run.json"),
		summary: await json("vrt.json"),
		rows: (await readFile(resolve(directory, "vrt-rows.jsonl"), "utf8"))
			.split("\n")
			.filter(Boolean)
			.map((line) => JSON.parse(line)),
	});
}
console.table(
	validateCoverage(
		reports,
		(await loadPages()).map((page) => page.path),
		{ referenceCommit },
	),
);
