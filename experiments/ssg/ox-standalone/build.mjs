import {
	profiling,
	tick,
	elapsed,
	pageTiming,
	checkpoint,
	recordFetch,
	writeProfile,
} from '../tooling/profiling.mjs';
import { build, createServer } from 'vite';
import { vueCompiler, artifactMode } from '../shared/compiler.mjs';
import { oxContent, raw, usePageProps } from '@ox-content/vite-plugin';
import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { performance } from 'node:perf_hooks';
import { common, root } from '../nuxt-compat/vite.mjs';
import { prepareData } from '../shared/data.mjs';
import { documentHtml } from './document.mjs';

const workerStart = tick();
const mode = 'ox-ported';
const outDir = resolve(root, `.pilot/${artifactMode(mode)}/public`);
let phaseStart = tick();
await rm(resolve(root, `.pilot/${mode}/cache`), { recursive: true, force: true });
elapsed('top.workerCleanup', phaseStart);
phaseStart = tick();
const payloads = await prepareData(mode);
elapsed('top.prepareData', phaseStart);
checkpoint('after-data');
phaseStart = tick();
await build({
	...common(),
	plugins: [...common().plugins, await vueCompiler()],
	publicDir: resolve(root, 'public'),
	build: {
		outDir,
		emptyOutDir: true,
		manifest: true,
		rollupOptions: { input: resolve(root, 'experiments/ssg/ox-standalone/client.ts') },
		cssCodeSplit: false,
	},
});
elapsed('top.clientBuildAndPublicCopy', phaseStart);
checkpoint('after-client-build');
phaseStart = tick();
const manifest = JSON.parse(await readFile(resolve(outDir, '.vite/manifest.json'), 'utf8'));
const entry = Object.values(manifest).find((e) => e.isEntry);
const assets = {
	js: '/' + entry.file,
	css: Object.values(manifest)
		.filter((asset) => asset.file.endsWith('.css'))
		.map((asset) => '/' + asset.file),
};
elapsed('top.clientManifestRead', phaseStart);
phaseStart = tick();
const server = await createServer({
	...common(),
	plugins: [...common().plugins, await vueCompiler()],
});
elapsed('top.ssrServerCreate', phaseStart);
phaseStart = tick();
const rendered = new Map();
const originalFetch = globalThis.fetch;
if (profiling)
	globalThis.fetch = async (...args) => {
		const start = tick();
		let status, error;
		try {
			const response = await originalFetch(...args);
			status = response.status;
			return response;
		} catch (cause) {
			error = { name: cause.name, message: cause.message, code: cause.cause?.code };
			throw cause;
		} finally {
			recordFetch({
				url: String(args[0]?.url ?? args[0]),
				status,
				error,
				ms: performance.now() - start,
			});
		}
	};
try {
	const { render } = await server.ssrLoadModule('/experiments/ssg/ox-standalone/server.ts');
	elapsed('top.ssrModuleLoadCompile', phaseStart);
	checkpoint('after-ssr-module');
	for (const payload of payloads) {
		const ssrStart = tick();
		const body = await render(payload);
		const vueSsrMs = elapsed('top.vueSsr', ssrStart);
		const htmlStart = tick();
		const html = documentHtml(payload, body, assets);
		const htmlMs = elapsed('top.documentHtml', htmlStart);
		rendered.set(payload.path, html);
		pageTiming({
			path: payload.path,
			kind: payload.kind,
			locale: payload.locale,
			vueSsrMs,
			htmlMs,
			bodyChars: body.length,
			htmlChars: html.length,
			stylesChars: payload.styles.length,
		});
	}
} finally {
	globalThis.fetch = originalFetch;
	phaseStart = tick();
	await server.close();
	elapsed('top.ssrServerClose', phaseStart);
}
checkpoint('after-render');
phaseStart = tick();
const srcDir = resolve(root, `.pilot/${artifactMode(mode)}/source`);
await rm(srcDir, { recursive: true, force: true });
for (const page of payloads) {
	const file = srcDir + page.path + 'index.md';
	await mkdir(dirname(file), { recursive: true });
	await writeFile(
		file,
		page.source?.endsWith('.md')
			? await readFile(resolve(root, 'content', page.source))
			: '# ' + (page.document.title ?? page.path) + '\n',
	);
}
elapsed('top.prepareOxSourceFiles', phaseStart);
phaseStart = tick();
const ssg = oxContent({
	srcDir,
	outDir,
	docs: false,
	search: false,
	embeds: false,
	highlight: false,
	ssg: {
		extension: '.html',
		clean: false,
		generateOgImage: false,
		lastUpdated: false,
		readerChrome: false,
		render: () => {
			const page = usePageProps();
			const url = page.url.replace(/index\.html$/, '').replace(/index$/, '');
			const html = rendered.get(url);
			if (!html) throw new Error('Unmatched Ox route: ' + page.url);
			return raw(html);
		},
	},
}).find((p) => p.name === 'ox-content:ssg');
elapsed('top.oxPluginCreate', phaseStart);
ssg.config({}, { command: 'build', mode: 'production' });
phaseStart = tick();
await ssg.closeBundle();
elapsed('top.oxSsgCloseBundle', phaseStart);
checkpoint('after-ox-ssg');
phaseStart = tick();
for (const page of payloads) {
	const file = outDir + page.path + 'index.html';
	const html = await readFile(file, 'utf8');
	if (!html.includes('port-data')) throw new Error('Ox custom theme did not render ' + file);
}
elapsed('top.workerValidateHtml', phaseStart);
elapsed('worker.totalMain', workerStart);
checkpoint('after-validation');
await writeProfile(
	process.env.HUB_SSG_PROFILE_FILE ??
		resolve(root, `.pilot/${artifactMode(mode)}/profile-worker.json`),
	{ mode, compiler: process.env.HUB_VUE_COMPILER ?? 'vue', renderedPages: payloads.length },
);
console.log(
	`Ox SSG: ${payloads.length} pages, freshly compiled Vue theme, client hydration, source-built navigation.`,
);
// Vite/UnoCSS's SSR dev loader retains filesystem watchers after server.close().
// All SSG output writes above are awaited; terminate this one-shot CLI worker.
process.exit(0);
