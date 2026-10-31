import assert from 'node:assert/strict';
import { access, readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { loadPages, outDir } from './routes.ts';
const pages = await loadPages();
assert.equal(new Set(pages.map((page) => page.path)).size, pages.length);
const htmlFiles = (await readdir(outDir, { recursive: true })).filter((file) => file.endsWith('.html'));
assert.equal(htmlFiles.length, pages.length, 'Unexpected HTML file count');
const assets = new Set<string>();
for (const page of pages) {
    const html = await readFile(resolve(outDir, '.' + page.path, 'index.html'), 'utf8');
    assert.match(html, /<!DOCTYPE html>/i, page.path);
    assert.match(html, /id="port-data"/, 'Missing document payload: ' + page.path);
    assert.match(html, /<title>[^<]+<\/title>/, 'Missing title: ' + page.path);
    assert.match(html, /rel="stylesheet"/, 'Missing CSS: ' + page.path);
    if (page.source?.endsWith('.md'))
        assert.match(html, /class="[^"]*\bmarkdown-body\b[^"]*"[^>]*>[\s\S]+/, 'Empty Ox HTML: ' + page.path);
    const payload = JSON.parse(/<script id="port-data" type="application\/json">([\s\S]*?)<\/script>/.exec(html)![1]!);
    assert.equal(payload.path, page.path);
    assert.ok(!payload.document.body?.children || ('kind' in page && page.kind === 'static' && payload.document.body.children.every((node: any) => node.type === 'static-html')), 'Client Markdown AST: ' + page.path);
    for (const match of html.matchAll(/(?:href|src)="(\/[^"?#]+\.(?:css|js))"/g))
        assets.add(match[1]!);
}
for (const href of assets)
    await access(resolve(outDir, '.' + decodeURI(href)));
console.log(JSON.stringify({ renderedPages: pages.length, htmlFiles: htmlFiles.length, localCssAndJs: assets.size, clientMarkdownAst: false }));
