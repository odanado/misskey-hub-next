import assert from 'node:assert/strict';
import { access, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { loadCatalogue, outDir } from './routes.ts';

const catalogue = await loadCatalogue();
const assets = new Set<string>();
for (const page of catalogue.pages) {
	const html = await readFile(
		resolve(outDir, '.' + page.path, 'index.html'),
		'utf8',
	);
	assert.match(html, /<!DOCTYPE html>/i, page.path);
	assert.match(html, /<main>[\s\S]+<\/main>/, 'Missing content: ' + page.path);
	assert.match(html, /<title>[^<]+<\/title>/, 'Missing title: ' + page.path);
	assert.match(html, /rel="stylesheet"/, 'Missing CSS: ' + page.path);
	if (page.kind === 'markdown' || page.kind === 'guide')
		assert.match(html, /<article>[\s\S]+<\/article>/, page.path);
	if (page.kind === 'section')
		assert.match(html, /<li>/, 'Empty directory index: ' + page.path);
	for (const match of html.matchAll(
		/(?:src|href)="(\/(?:assets|img\/docs)\/[^"?#]+)"/g,
	))
		assets.add(match[1]!);
}
for (const href of assets) await access(resolve(outDir, '.' + decodeURI(href)));
const home = await readFile(resolve(outDir, 'index.html'), 'utf8');
assert.match(
	home,
	/Markdown as a Vue component/,
	'Vue Markdown overview is empty',
);
assert.match(
	home,
	/aria-label="Reading size"/,
	'Vue reading controls were not SSR-rendered',
);
assert.match(home, />100%<\/output>/, 'Missing SSR reading state');
const result = {
	inventoryUrls: catalogue.inventoryUrls,
	renderedPages: catalogue.pages.length,
	markdownPages: catalogue.pages.filter((page) => page.kind === 'markdown')
		.length,
	guidePages: catalogue.pages.filter((page) => page.kind === 'guide').length,
	directoryPages: catalogue.pages.filter((page) => page.kind === 'section')
		.length,
	excludedRoutes: catalogue.excluded.length,
	validatedAssets: assets.size,
};
await writeFile(
	resolve(outDir, '../verification.json'),
	JSON.stringify(result, null, 2) + '\n',
);
console.log(JSON.stringify(result));
