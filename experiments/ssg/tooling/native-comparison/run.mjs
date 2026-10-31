// Invoked with cwd = isolated checkout. Outputs diagnostics, never changes source.
import { writeFile, readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { state, mark } from './probe.mjs';
let session;
if (process.env.HUB_COMPARE_CPU === '1') {
	state.fetches = [];
	const fetch = globalThis.fetch;
	globalThis.fetch = async (...args) => {
		const start = performance.now();
		try {
			const response = await fetch(...args);
			state.fetches.push({ url: String(args[0]), status: response.status, ms: performance.now() - start });
			return response;
		} catch (error) {
			state.fetches.push({ url: String(args[0]), error: String(error), ms: performance.now() - start });
			throw error;
		}
	};
	const { Session } = await import('node:inspector');
	session = new Session(); session.connect();
	await new Promise((ok, fail) => session.post('Profiler.enable', (e) => e ? fail(e) : ok()));
	await new Promise((ok, fail) => session.post('Profiler.start', (e) => e ? fail(e) : ok()));
}
try {
	const { build } = await import('vite');
	await build({ configFile: resolve('experiments/ssg/ox-native/vite.config.ts') });
	mark('buildComplete');
	if (session) {
		const { profile } = await new Promise((ok, fail) => session.post('Profiler.stop', (e, r) => e ? fail(e) : ok(r)));
		await writeFile(process.env.HUB_COMPARE_CPU_FILE, JSON.stringify(profile));
		session.disconnect();
	}
	const { outDir } = await import(resolve('experiments/ssg/ox-native/routes.ts'));
	const files = (await readdir(outDir, { recursive: true })).filter((f) => f.endsWith('.html'));
	let htmlBytes = 0;
	for (const f of files) htmlBytes += (await readFile(resolve(outDir, f))).length;
	state.output = { htmlFiles: files.length, htmlBytes };
	state.legacy = globalThis[Symbol.for('hub.native-legacy')]?.();
	const result = {
		...state, resourceUsage: process.resourceUsage(), node: process.version,
		policy: 'Diagnostic run; inclusive async hook totals overlap; host page operations sequential; output enumeration outside buildComplete.',
	};
	// One JSON row per page keeps large diagnostic diffs readable.
	const pages = result.pages;
	const json = JSON.stringify({ ...result, pages: '__HUB_NATIVE_PAGE_ROWS__' }, null, 2)
		.replace('"__HUB_NATIVE_PAGE_ROWS__"', '[\n' + pages.map((page) => '    ' + JSON.stringify(page)).join(',\n') + '\n  ]');
	await writeFile(process.env.HUB_COMPARE_OUTPUT, json + '\n');
	process.exit(0); // Shared compatibility loader keeps watchers after awaited build.
} catch (error) { console.error(error); process.exit(1); }
