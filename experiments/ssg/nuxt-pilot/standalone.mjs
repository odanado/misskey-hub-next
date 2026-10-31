import { oxContent } from '@ox-content/vite-plugin';
import { mkdir, readFile, writeFile, rm, cp } from 'node:fs/promises';
import { dirname } from 'node:path';
import { pages } from '../shared/pages.mjs';
import { performance } from 'node:perf_hooks';

// Deliberately run Ox's own SSG. This does not reuse Nuxt-rendered HTML or a
// frozen baseline shell, which would hide the real cost of leaving Nuxt.
const start = performance.now();
const srcDir = '.pilot/standalone/source';
const outDir = '.pilot/standalone/public';
await rm(srcDir, { recursive: true, force: true });
await rm(outDir, { recursive: true, force: true });
for (const page of pages) {
	const file = `${srcDir}${page.path}index.md`;
	await mkdir(dirname(file), { recursive: true });
	await writeFile(file, await readFile(`content/${page.source}`));
}
// Invoke the published plugin's build lifecycle without upgrading Nuxt's Vite.
const plugins = oxContent({
	srcDir,
	outDir,
	docs: false,
	search: false,
	embeds: false,
	ssg: { extension: '', generateOgImage: false, lastUpdated: false, clean: false },
});
const ssg = plugins.find((plugin) => plugin.name === 'ox-content:ssg');
ssg.config({}, { command: 'build', mode: 'production' });
await ssg.closeBundle();
// Ox's extensionless output is a file. Serve it at the original trailing-slash
// URL using a directory index, just as the Nuxt pilot does.
for (const page of pages) {
	const extensionless = `${outDir}${page.path.replace(/\/$/, '')}`;
	let html;
	try {
		html = await readFile(extensionless, 'utf8');
	} catch {
		try {
			html = await readFile(extensionless + '/index', 'utf8');
		} catch {
			html = await readFile(extensionless + '/index.html', 'utf8');
		}
	}
	if (!html.includes(page.title)) throw new Error(`Standalone SSG missing ${page.path}`);
	const dest = `${outDir}${page.path}index.html`;
	if (extensionless !== dest) {
		try {
			await rm(extensionless);
		} catch {}
		await mkdir(dirname(dest), { recursive: true });
		await writeFile(dest, html);
	}
}
await cp(
	'public/img/docs/for-users/features/hashtag',
	`${outDir}/img/docs/for-users/features/hashtag`,
	{ recursive: true },
);
await writeFile(
	'.pilot/standalone/timing.json',
	JSON.stringify(
		{
			seconds: (performance.now() - start) / 1000,
			note: 'Ox default shell; not feature-equivalent to Nuxt',
		},
		null,
		2,
	) + '\n',
);
console.log(
	'Standalone SSG finished. Compare with VRT; this variant has no Nuxt shell or hydration.',
);
