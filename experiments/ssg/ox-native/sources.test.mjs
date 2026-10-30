import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { prepareSources } from './sources.mjs';

test('preserves Markdown aliases, marks scaffold routes, and removes stale sources', async (t) => {
	const directory = await mkdtemp(resolve(tmpdir(), 'hub-native-sources-'));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const contentDir = resolve(directory, 'content');
	const srcDir = resolve(directory, 'source');
	await mkdir(contentDir);
	await mkdir(srcDir);
	const original = '---\ntitle: 日本語\n---\n\n::example\nKeep raw MDC.\n::\n';
	await writeFile(resolve(contentDir, 'note.md'), original);
	await writeFile(resolve(srcDir, 'stale.md'), '# Stale');
	const coverage = await prepareSources(
		[
			{ path: '/ja/docs/note/', source: 'note.md' },
			{ path: '/ja-ks/docs/note/', source: 'note.md' },
			{ path: '/en/', title: 'A "quoted" title' },
			{ path: '/', source: 'index.yml' },
		],
		contentDir,
		srcDir,
	);
	assert.deepEqual(coverage, {
		markdownRoutes: 2,
		scaffoldRoutes: 2,
		markdownSources: 1,
	});
	for (const path of ['ja', 'ja-ks'])
		assert.equal(
			await readFile(resolve(srcDir, `${path}/docs/note/index.md`), 'utf8'),
			original,
		);
	assert.match(
		await readFile(resolve(srcDir, 'en/index.md'), 'utf8'),
		/Native SSG route scaffold/,
	);
	await assert.rejects(readFile(resolve(srcDir, 'stale.md')), {
		code: 'ENOENT',
	});
});

test('rejects unsafe and duplicate routes before replacing generated sources', async (t) => {
	const directory = await mkdtemp(resolve(tmpdir(), 'hub-native-sources-'));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const srcDir = resolve(directory, 'source');
	await mkdir(srcDir);
	const sentinel = resolve(srcDir, 'keep.md');
	await writeFile(sentinel, '# Keep');
	for (const pages of [
		[{ path: '/../' }],
		[{ path: '/a/../' }],
		[{ path: '/a/../../' }],
		[{ path: '/a/' }, { path: '/a/' }],
	])
		await assert.rejects(prepareSources(pages, directory, srcDir));
	assert.equal(await readFile(sentinel, 'utf8'), '# Keep');
});
