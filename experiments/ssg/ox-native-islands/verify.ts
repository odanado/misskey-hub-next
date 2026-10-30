import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { loadPages, outDir } from './routes.ts';

const pages = [{ path: '/' }, ...(await loadPages())];
const assets = new Set<string>();
for (const page of pages) {
	const html = await readFile(
		resolve(outDir, '.' + page.path, 'index.html'),
		'utf8',
	);
	assert.match(html, /<!DOCTYPE html>/i, page.path);
	assert.match(html, /<main>[\s\S]+<\/main>/, 'Missing content: ' + page.path);
	assert.match(html, /<title>[^<]+<\/title>/, 'Missing title: ' + page.path);
	assert.match(html, /rel="stylesheet"/, 'Missing CSS: ' + page.path);
	if (page.path !== '/')
		assert.match(
			html,
			/class="ox-content"[^>]*>[\s\S]+/,
			'Empty Vue Markdown: ' + page.path,
		);
	for (const match of html.matchAll(/href="(\/[^"?#]+\.css)"/g))
		assets.add(match[1]!);
}
for (const href of assets) await access(resolve(outDir, '.' + decodeURI(href)));
console.log(
	JSON.stringify({ renderedPages: pages.length, stylesheets: assets.size }),
);
