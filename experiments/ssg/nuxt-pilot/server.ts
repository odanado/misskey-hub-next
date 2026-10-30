import { queryCollection } from '#pilot-collections';
import { parseContent } from '#content/server';
import { compileHast } from '#pilot-mdc-compiler';
import { generateToc } from '#pilot-mdc-toc';
import { generatePath } from '#pilot-path-meta';
import { nativeDocument } from '../shared/content/ox-native.mjs';

// Fresh raw Markdown comes from Ox, never from Nuxt's parsed-content cache.
// Promise memoization also shares in-flight compilation across prerender requests.
const compiled = new Map<string, Promise<unknown>>();
export default defineEventHandler(async (event) => {
	const path = event.path
		.split('?')[0]
		.replace(/^\/api\/ox-pilot/, '')
		.replace(/\.json$/, '');
	const entry = await queryCollection('pilot').path(path).first();
	if (!entry) throw createError({ statusCode: 404, statusMessage: 'Not a pilot page' });
	const compile = () =>
		useRuntimeConfig().pilotMode === 'query'
			? parseContent(`content:${entry.source.replaceAll('/', ':')}`, entry.body)
			: nativeDocument(entry, (code) => parseContent('content:pilot-snippet.md', code), {
					compileHast,
					generateToc,
					generatePath,
				});
	if (!compiled.has(path)) compiled.set(path, compile());
	return compiled.get(path);
});
