import { resolve } from 'node:path';

export const root = resolve(import.meta.dirname, '../../..');
const scope = process.env.HUB_PILOT_PAGES ?? '4';
if (!['4', '30', 'all'].includes(scope))
	throw new Error('HUB_PILOT_PAGES must be 4, 30, or all');
export const outDir = resolve(
	root,
	`.pilot/${scope === 'all' ? 'full/' : scope === '30' ? '30/' : ''}ox-native-theme/public`,
);

export async function loadPages() {
	const { pages } = await import('../shared/pages.mjs');
	if (!pages) throw new Error('The route inventory is unavailable');
	return pages.filter((page) => page.source?.endsWith('.md'));
}
