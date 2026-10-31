// Diagnostic reproductions for the pinned Vize version. This does not change
// the application, install packages, run a build, or update VRT baselines.
import { createRequire } from 'node:module';
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import * as vue from 'vue/compiler-sfc';
import * as vite from 'vite';
const require = createRequire(import.meta.url);
const vizeRequire = createRequire(require.resolve('@vizejs/vite-plugin'));
const native = vizeRequire('@vizejs/native');
async function packageInfo(name, loader = require) {
	let file;
	try {
		file = loader.resolve(name + '/package.json');
	} catch {
		file = loader.resolve(name);
	}
	let dir = dirname(file);
	for (;;) {
		try {
			const pkg = JSON.parse(await readFile(resolve(dir, 'package.json'), 'utf8'));
			if (pkg.name === name)
				return { dir, name, version: pkg.version, peerDependencies: pkg.peerDependencies };
		} catch {}
		const parent = dirname(dir);
		if (parent === dir) throw new Error('Cannot locate package ' + name);
		dir = parent;
	}
}
const [pluginPkg, nativePkg, nuxtPkg, vuePkg, vitePkg] = await Promise.all([
	packageInfo('@vizejs/vite-plugin'),
	packageInfo('@vizejs/native', vizeRequire),
	packageInfo('@vizejs/nuxt'),
	packageInfo('vue'),
	packageInfo('vite'),
]);
const filename = 'VizeIssue.vue',
	id = 'data-v-repro';
const slotSource =
	'<script setup>const show = false</script><template><Link><i v-if="show"/><template v-else>Docs</template></Link></template>';
const slotDescriptor = vue.parse(slotSource, { filename }).descriptor;
const bindings = vue.compileScript(slotDescriptor, { id }).bindings;
const slotVueSsr = vue.compileTemplate({
	source: slotDescriptor.template.content,
	filename,
	id,
	ssr: true,
	ssrCssVars: [],
	compilerOptions: { bindingMetadata: bindings },
});
const slotNativeClient = native.compileSfc(slotSource, { filename, isProd: true, ssr: false });
const slotNativeSsr = native.compileSfc(slotSource, { filename, isProd: true, ssr: true });
const cssCases = [
	{
		name: 'screen-directive',
		source:
			'.docs-root { grid-template-columns: 1fr; } @screen lg { .docs-root { grid-template-columns: 16rem 1fr; } }',
	},
	{
		name: 'screen-media-workaround',
		source:
			'.docs-root { grid-template-columns: 1fr; } @media (min-width:1024px) { .docs-root { grid-template-columns: 16rem 1fr; } }',
	},
	{ name: 'nested-global', source: ':global(html.dark) { .x { color: #f0ffc7; } }' },
	{ name: 'nested-ancestor-workaround', source: 'html.dark { .x { color: #f0ffc7; } }' },
].map((entry) => {
	const sfc = `<template><div class="x"/></template><style scoped>${entry.source}</style>`;
	const nativeSfc = native.compileSfc(sfc, { filename, scopeId: id, isProd: true });
	const vueStyle = vue.compileStyle({ source: entry.source, filename, id, scoped: true });
	return {
		...entry,
		vizeSfcCss: nativeSfc.css,
		vizeVitePipelineCss: native.scopeViteCssForPipeline(entry.source, id),
		vueScopedCss: vueStyle.code,
		errors: { native: nativeSfc.errors, vue: vueStyle.errors.map(String) },
	};
});
const helperFiles = (await readdir(resolve(nuxtPkg.dir, 'dist'))).filter((file) =>
	/^i18n-.*\.mjs$/.test(file),
);
let i18nImport = {
	status: 'not-reproduced',
	message: 'No matching helper that imports parseSync from vite was found',
};
for (const file of helperFiles) {
	const path = resolve(nuxtPkg.dir, 'dist', file),
		source = await readFile(path, 'utf8');
	if (!/import\s*\{\s*parseSync\s*\}\s*from\s*["']vite["']/.test(source)) continue;
	try {
		await import(pathToFileURL(path).href);
		i18nImport = { status: 'import-succeeded', helper: 'dist/' + file };
	} catch (error) {
		i18nImport = {
			status: 'import-failed',
			helper: 'dist/' + file,
			errorName: error.name,
			message: error.message,
		};
	}
	break;
}
const result = {
	recordedAt: new Date().toISOString(),
	environment: { node: process.version, platform: process.platform, arch: process.arch },
	packages: [pluginPkg, nativePkg, nuxtPkg, vuePkg, vitePkg].map(
		({ name, version, peerDependencies }) => ({
			name,
			version,
			...(name === '@vizejs/nuxt' ? { peerDependencies } : {}),
		}),
	),
	scope:
		'Compiler outputs and helper import only. Browser hydration/VRT evidence is recorded separately in compiler-vrt.json.',
	slotFragment: {
		source: slotSource,
		vizeClient: slotNativeClient.code,
		vizeSsr: slotNativeSsr.code,
		vueSsr: slotVueSsr.code,
		errors: {
			client: slotNativeClient.errors,
			ssr: slotNativeSsr.errors,
			vue: slotVueSsr.errors.map(String),
		},
	},
	css: cssCases,
	i18n: { viteExportsParseSync: typeof vite.parseSync === 'function', helperImport: i18nImport },
};
const out = resolve(import.meta.dirname, '../../results/vize-issue-repros.json');
await mkdir(dirname(out), { recursive: true });
await writeFile(out, JSON.stringify(result, null, 2) + '\n');
console.log(
	JSON.stringify(
		{
			output: 'experiments/ssg/results/vize-issue-repros.json',
			versions: result.packages.map(({ name, version }) => ({ name, version })),
			i18n: result.i18n,
			css: result.css.map(({ name, vizeVitePipelineCss }) => ({ name, vizeVitePipelineCss })),
		},
		null,
		2,
	),
);
