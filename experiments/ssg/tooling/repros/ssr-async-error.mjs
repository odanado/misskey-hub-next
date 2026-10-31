// Exercises the actual ported async Team page; makes no external request.
import { createServer } from 'vite';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { common, root } from '../../nuxt-compat/vite.mjs';
import { fullSite } from '../../shared/scope.mjs';
import { vueCompiler } from '../../shared/compiler.mjs';
if (!fullSite || process.env.HUB_VUE_COMPILER === 'vize')
	throw new Error('Use HUB_PILOT_PAGES=all HUB_VUE_COMPILER=vue');
const html = await readFile(
	root + '/.pilot/full/ox-ported/public/cn/about-us/team/index.html',
	'utf8',
);
const payload = JSON.parse(
	/<script id="port-data" type="application\/json">([\s\S]*?)<\/script>/.exec(html)?.[1] ?? 'null',
);
if (!payload) throw new Error('Build the full Ox Vue variant first');
const config = common();
const server = await createServer({ ...config, plugins: [...config.plugins, await vueCompiler()] }),
	originalFetch = globalThis.fetch;
let captured;
try {
	globalThis.fetch = async () => {
		throw new Error('diagnostic async fetch rejection');
	};
	const { render } = await server.ssrLoadModule('/experiments/ssg/ox-standalone/server.ts');
	try {
		await render(payload);
	} catch (error) {
		captured = error;
	}
} finally {
	globalThis.fetch = originalFetch;
	await server.close();
}
if (
	!(captured instanceof AggregateError) ||
	!captured.errors.some((error) => error.message === 'diagnostic async fetch rejection')
)
	throw new Error('Async SSR failure was not surfaced');
const result = {
	recordedAt: new Date().toISOString(),
	page: payload.path,
	noNetwork: true,
	passed: true,
	name: captured.name,
	message: captured.message,
	errors: captured.errors.map((error) => ({ name: error.name, message: error.message })),
};
await mkdir('experiments/ssg/results/full/profiling', { recursive: true });
await writeFile(
	'experiments/ssg/results/full/profiling/ssr-error-check.json',
	JSON.stringify(result, null, 2) + '\n',
);
console.log(JSON.stringify(result, null, 2));
process.exit(0);
