import { readFile, writeFile } from 'node:fs/promises';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

import { artifactPath } from '../shared/scope.mjs';
const mode = process.argv[2];
const artifact = artifactPath(mode);
const report = JSON.parse(await readFile(`.pilot/${artifact}/vrt/results.json`, 'utf8'));
const tests = [];
async function collect(suite) {
	for (const spec of suite.specs ?? [])
		for (const test of spec.tests) {
			const result = test.results.at(-1);
			const screenshots = [];
			for (const attachment of result.attachments ?? []) {
				if (!attachment.name.endsWith('-actual.png')) continue;
				const expected = result.attachments.find(
					(a) => a.name === attachment.name.replace('-actual.png', '-expected.png'),
				);
				if (!expected) continue;
				const a = PNG.sync.read(await readFile(attachment.path));
				const b = PNG.sync.read(await readFile(expected.path));
				const equalSize = a.width === b.width && a.height === b.height;
				screenshots.push({
					name: attachment.name,
					actual: [a.width, a.height],
					expected: [b.width, b.height],
					differentPixels: equalSize
						? pixelmatch(a.data, b.data, null, a.width, a.height, { threshold: 0, includeAA: true })
						: null,
				});
			}
			tests.push({
				title: spec.title,
				project: test.projectName,
				status: result.status,
				screenshots,
			});
		}
	for (const child of suite.suites ?? []) await collect(child);
}
for (const suite of report.suites) await collect(suite);
const result = {
	mode,
	passed: tests.filter((t) => t.status === 'passed').length,
	failed: tests.filter((t) => t.status !== 'passed').length,
	tests,
};
await writeFile(`.pilot/${artifact}/vrt/summary.json`, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ mode, passed: result.passed, failed: result.failed }));
