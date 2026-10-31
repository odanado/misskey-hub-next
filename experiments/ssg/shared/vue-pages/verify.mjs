import { readFile, writeFile, stat, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { pathsFor } from './workspace.mjs';
export async function verifyVariant(variant) {
  const { workspace, output } = pathsFor(variant);
  const inventory = JSON.parse(await readFile(resolve(workspace, 'experiments/ssg/results/public-url-count.json'), 'utf8')).urls;
  const paths = Object.values(inventory).flat();
  assert.equal(new Set(paths).size, 1991);
  assert.equal((await readdir(output, { recursive: true })).filter(file => file.endsWith('.html')).length, 1991);
  const counts = { staticUrls: 0, ssrVueUrls: 0, clientVueUrls: 0, languageEntryUrls: 0, rawContentUrls: 0 };
  const components = new Set();
  const staticPaths = new Set(inventory.static), languagePaths = new Set(inventory.languageEntry);
  for (const path of paths) {
    const html = await readFile(resolve(output, '.' + path, 'index.html'), 'utf8');
    assert.ok(html.includes('<!DOCTYPE html>') && html.includes('<title>'), path);
    assert.ok(!html.includes('data-diagnostic-ui-omitted') && !html.includes('UI omitted for this diagnostic'), path);
    assert.match(html, /<link rel="stylesheet" href="\/assets\/[^\"]+\.css"/, path);
    if (staticPaths.has(path)) {
      counts.staticUrls++;
      const payload = JSON.parse(/<script id="vue-page-data" type="application\/json">(.*?)<\/script>/s.exec(html)?.[1]);
      components.add(payload.pageFile);
      assert.ok(html.includes('data-original-vue-page="' + payload.pageFile + '"'), path);
      if (payload.pageFile.endsWith('.client.vue')) counts.clientVueUrls++;
      else { counts.ssrVueUrls++; assert.ok(html.split('<script id="vue-page-data"')[0].length > 1000, path); }
    } else if (languagePaths.has(path)) {
      counts.languageEntryUrls++;
      assert.ok(html.includes('data-language-entry') && html.includes('location.replace'), path);
    } else {
      counts.rawContentUrls++;
      assert.ok(html.includes('data-raw-ox-content'), path);
    }
  }
  assert.equal(components.size, 23);
  assert.deepEqual(counts, { staticUrls: 287, ssrVueUrls: 261, clientVueUrls: 26, languageEntryUrls: 233, rawContentUrls: 1471 });
  const manifest = JSON.parse(await readFile(resolve(output, '.vite/manifest.json'), 'utf8'));
  assert.ok(!Object.keys(manifest).some(key => key.endsWith('.md')));
  const js = new Set(Object.values(manifest).map(entry => entry.file).filter(file => file.endsWith('.js')));
  const css = new Set(Object.values(manifest).flatMap(entry => entry.css ?? []));
  assert.ok(js.size && css.size);
  for (const file of js) assert.ok((await stat(resolve(output, file))).size > 0, file);
  // Vize extracts styles into the shared CSS asset and may leave empty CSS
  // chunk placeholders in its manifest. Require every file and real CSS output.
  const cssSizes = await Promise.all([...css].map(async file => (await stat(resolve(output, file))).size));
  assert.ok(cssSizes.some(size => size > 0), 'No generated stylesheet content');
  const result = { ...variant, publicUrls: paths.length, originalVueFiles: components.size, counts, jsFiles: js.size, cssFiles: css.size, output, policy: 'Static output checks only; browser/VRT compatibility is reported separately.' };
  await writeFile(resolve(workspace, 'verification.json'), JSON.stringify(result, null, 2) + '\n');
  console.log('[vue-pages-verify] ' + JSON.stringify(result));
  return result;
}
