import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';

// Share the existing public-route inventory, but keep generated source/output
// separate from the Vue pilot. Markdown is unchanged; other routes are explicit
// scaffolds, not implementations of their Vue/YAML pages.
export async function prepareSources(pages, contentDir, srcDir) {
	const planned = new Set();
	for (const page of pages) {
		if (
			!/^\/(?:[^/]+\/)*$/.test(page.path) ||
			page.path.split('/').some((part) => part === '.' || part === '..')
		)
			throw new Error('Invalid route: ' + page.path);
		const file = resolve(srcDir, '.' + page.path, 'index.md');
		if (!file.startsWith(resolve(srcDir) + sep) || planned.has(file))
			throw new Error('Unsafe or duplicate route: ' + page.path);
		planned.add(file);
	}
	await rm(srcDir, { recursive: true, force: true });
	const sources = new Map();
	let markdownRoutes = 0;
	for (const page of pages) {
		let markdown;
		if (page.source?.endsWith('.md')) {
			if (!sources.has(page.source))
				sources.set(
					page.source,
					await readFile(resolve(contentDir, page.source), 'utf8'),
				);
			markdown = sources.get(page.source);
			markdownRoutes++;
		} else {
			markdown =
				`---\ntitle: ${JSON.stringify(page.title || page.path)}\n---\n\n` +
				'# Native SSG route scaffold\n\n' +
				'This route requires a Vue or YAML page implementation.\n';
		}
		const file = resolve(srcDir, '.' + page.path, 'index.md');
		await mkdir(dirname(file), { recursive: true });
		await writeFile(file, markdown);
	}
	return {
		markdownRoutes,
		scaffoldRoutes: pages.length - markdownRoutes,
		markdownSources: sources.size,
	};
}
