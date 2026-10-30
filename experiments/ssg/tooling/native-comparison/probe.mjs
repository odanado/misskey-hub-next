// Diagnostic-only instrumentation copied into isolated git-archive checkouts.
import { performance } from 'node:perf_hooks';
const key = Symbol.for('hub.native-comparison');
export const state = (globalThis[key] ??= {
	started: performance.now(), stage: 'client', marks: {}, totals: {}, pages: [],
});
export const now = () => performance.now();
export function mark(name) { state.marks[name] = now() - state.started; }
export function add(name, start, bytes = 0) {
	const ms = now() - start;
	const row = (state.totals[name] ??= { count: 0, ms: 0, maxMs: 0, bytes: 0 });
	row.count++; row.ms += ms; row.maxMs = Math.max(row.maxMs, ms); row.bytes += bytes;
	return ms;
}
export function instrument() {
	let command;
	return {
		name: 'hub-native-diagnostic', enforce: 'pre',
		configResolved(config) {
			command = config.command;
			if (config.command === 'build') mark('configResolved');
			for (const plugin of config.plugins) {
				if (plugin.name === 'hub-native-diagnostic') continue;
				for (const hook of ['transform', ...(config.command === 'build' ? ['closeBundle'] : [])]) {
					const original = plugin[hook];
					if (!original) continue;
					const handler = typeof original === 'function' ? original : original.handler;
					const wrapped = async function (...args) {
						const t = now();
						const kind = args[2]?.ssr ? 'ssr' : 'client';
						const md = String(args[1] ?? '').endsWith('.md');
						const customHost = hook === 'closeBundle' && plugin.name === 'ox-content:custom-host';
						if (customHost) mark('customHostStart');
						try { return await handler.apply(this, args); }
						finally {
							add(`hook.${plugin.name}.${hook}.${kind}${md ? '.md' : ''}`, t);
							if (customHost) mark('customHostEnd');
						}
					};
					plugin[hook] = typeof original === 'function' ? wrapped : { ...original, handler: wrapped };
				}
			}
		},
		buildStart: { order: 'pre', handler() { if (command === 'build') mark('buildStart'); } },
		buildEnd: { order: 'post', handler() { if (command === 'build') mark('graphEnd'); } },
		generateBundle: { order: 'post', handler() { if (command === 'build') mark('generateBundleEnd'); } },
		writeBundle: { order: 'post', handler(_options, bundle) {
			if (command !== 'build') return;
			mark('writeBundleEnd');
			state.bundle = Object.values(bundle).reduce((out, item) => {
				const type = item.type === 'chunk' ? 'js' : item.fileName.endsWith('.css') ? 'css' : 'other';
				const row = (out[type] ??= { files: 0, bytes: 0 });
				row.files++; row.bytes += Buffer.byteLength(item.type === 'chunk' ? item.code : item.source);
				return out;
			}, {});
		} },
	};
}
