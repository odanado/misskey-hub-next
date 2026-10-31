// Opt-in diagnostics only; normal builds do not record events or page rows.
import { performance } from 'node:perf_hooks';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
export const profiling = process.env.HUB_SSG_PROFILE === '1';
const phases = new Map(),
	pages = [],
	fetches = [],
	checkpoints = [];
export const tick = () => (profiling ? performance.now() : 0);
export function elapsed(name, start) {
	if (!profiling) return 0;
	const ms = performance.now() - start,
		row = phases.get(name) ?? { count: 0, totalMs: 0, maxMs: 0 };
	row.count++;
	row.totalMs += ms;
	row.maxMs = Math.max(row.maxMs, ms);
	phases.set(name, row);
	return ms;
}
export function pageTiming(row) {
	if (profiling) pages.push(row);
}
export function checkpoint(name) {
	if (profiling)
		checkpoints.push({ name, uptimeSeconds: process.uptime(), ...process.memoryUsage() });
}
export function recordFetch(row) {
	if (profiling) fetches.push(row);
}
export async function writeProfile(file, extra = {}) {
	if (!profiling) return;
	const result = {
		recordedAt: new Date().toISOString(),
		node: process.version,
		pid: process.pid,
		scope:
			'wall-clock phase totals; nested phases inclusive and not additive; per-page Vue SSR and document HTML timing',
		...extra,
		phases: Object.fromEntries(phases),
		pages,
		fetches,
		checkpoints,
		resourceUsage: process.resourceUsage(),
	};
	await mkdir(dirname(file), { recursive: true });
	await writeFile(file, JSON.stringify(result, null, 2) + '\n');
	console.log('[ssg-profile] ' + file);
}
