import { performance } from 'node:perf_hooks';
import { readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { oxContent } from '@ox-content/vite-plugin';
import { prepareSources } from './sources.mjs';

const started = performance.now();
const root = resolve(import.meta.dirname, '../../..');
// fullPages reads source paths relative to the repository root.
process.chdir(root);
const { pages } = await import('../shared/pages.mjs');
const { scopePrefix } = await import('../shared/scope.mjs');
const directory = resolve(root, `.pilot/${scopePrefix}ox-native-theme`);
const srcDir = resolve(directory, 'source');
const outDir = resolve(directory, 'public');
const coverage = await prepareSources(pages, resolve(root, 'content'), srcDir);
const prepared = performance.now();

const ssg = oxContent({
	srcDir,
	outDir,
	docs: false,
	search: false,
	embeds: false,
	highlight: false,
	ssg: {
		clean: true,
		generateOgImage: false,
		lastUpdated: false,
		readerChrome: false,
	},
}).find((plugin) => plugin.name === 'ox-content:ssg');
if (
	!ssg ||
	typeof ssg.config !== 'function' ||
	typeof ssg.closeBundle !== 'function'
)
	throw new Error('Expected Ox Content 3.4.3 SSG script hooks');
// Experimental script entry: use Ox's native default renderer. No custom render
// callback, Vite client build, Vue SSR, Nuxt compatibility layer, or hydration.
ssg.config({}, { command: 'build', mode: 'production' });
await ssg.closeBundle();
const built = performance.now();

for (const page of pages) {
	const file = resolve(outDir, '.' + page.path, 'index.html');
	const html = await readFile(file, 'utf8');
	if (!html.includes('<!DOCTYPE html>') || !html.includes('</html>'))
		throw new Error('Incomplete native HTML: ' + page.path);
}
const output = await readdir(outDir, { recursive: true, withFileTypes: true });
const files = output.filter((entry) => entry.isFile());
let outputBytes = 0;
for (const entry of files)
	outputBytes += (await stat(resolve(entry.parentPath, entry.name))).size;
const validated = performance.now();
const result = {
	mode: 'ox-native-theme',
	oxContent: '3.4.3',
	pages: pages.length,
	...coverage,
	preparationSeconds: (prepared - started) / 1000,
	buildSeconds: (built - prepared) / 1000,
	validationSeconds: (validated - built) / 1000,
	seconds: (validated - started) / 1000,
	outputFiles: files.length,
	outputBytes,
};
await writeFile(
	resolve(directory, 'build.json'),
	JSON.stringify(result, null, 2) + '\n',
);
console.log(JSON.stringify(result));
