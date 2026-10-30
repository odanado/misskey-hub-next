// Run with HUB_PILOT_PAGES=30 node experiments/ssg/tooling/repros/markdown-compat.mjs.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseFrontmatter } from '@ox-content/napi';
import { parseMdc, parseOx } from '../../shared/content/markdown.mjs';
import { expanded } from '../../shared/scope.mjs';

assert.ok(expanded, 'Use HUB_PILOT_PAGES=30 to exercise MDC component islands');
function contract(document) {
	const result = { headings: [], examples: [], previews: [], footnotes: [] };
	function walk(node) {
		if (/^h[1-6]$/.test(node.tag)) result.headings.push(node.props.id);
		if (node.tag === 'pre') result.examples.push(node.props.code);
		if (node.tag === 'mfm-preview') result.previews.push(node.props.text);
		if (node.tag === 'a' && /footnote/.test(JSON.stringify(node.props)))
			result.footnotes.push(node.props.href);
		node.children?.forEach(walk);
	}
	walk(document.body);
	return result;
}
const cases = [
	...['ja', 'en'].map((locale) => `${locale}/docs/2.for-users/3.features/mfm.md`),
	'ja/docs/3.for-admin/install/resources/nginx.md',
	'ja/docs/3.for-admin/features/managing-emojis.md',
	'ja/docs/3.for-admin/install/guides/ubuntu-manual.md',
];
for (const source of cases) {
	const raw = await readFile(`content/${source}`, 'utf8');
	const { frontmatter, content } = parseFrontmatter(raw);
	const reference = await parseMdc(raw, source);
	const candidate = await parseOx({ source, path: '/regression', frontmatter, body: content });
	assert.deepEqual(contract(candidate), contract(reference), source);
	assert.equal(candidate.description, reference.description, source + ' description');
	assert.equal(candidate._pilotParsing.fullMdcFallback, false);
	console.log('PASS ' + source);
}
