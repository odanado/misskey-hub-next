import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseFrontmatter } from '@ox-content/napi';
import yaml from 'js-yaml';

export const root = resolve(import.meta.dirname, '../../..');
const scope = process.env.HUB_PILOT_PAGES ?? '4';
if (!['4', '30', 'all'].includes(scope))
	throw new Error('HUB_PILOT_PAGES must be 4, 30, or all');
export const outDir = resolve(
	root,
	`.pilot/${scope === 'all' ? 'full/' : scope === '30' ? '30/' : ''}ox-native-theme/public`,
);

export interface Page {
	path: string;
	title: string;
	locale: string;
	source?: string;
	body?: string;
	kind: 'markdown' | 'guide' | 'section' | 'home';
}
export interface Catalogue {
	pages: Page[];
	excluded: { path: string; reason: string }[];
	inventoryUrls: number;
}
export interface PageView {
	page: Page;
	body: string;
	navigation: { path: string; title: string }[];
}

function titleOf(value: unknown, fallback: string): string {
	return value &&
		typeof value === 'object' &&
		'title' in value &&
		typeof value.title === 'string'
		? value.title
		: fallback;
}

function record(value: unknown): Record<string, unknown> {
	if (!value || typeof value !== 'object' || Array.isArray(value))
		throw new Error('Invalid guide data');
	return value as Record<string, unknown>;
}

function guideMarkdown(value: unknown, path: string): string {
	const data = record(value);
	if (typeof data.body !== 'string' || !Array.isArray(data.guides))
		throw new Error('Unsupported YAML page: ' + path);
	const sections = [`# ${titleOf(data, path)}`, data.body];
	for (const item of data.guides) {
		const guide = record(item);
		if (!Array.isArray(guide.steps))
			throw new Error('Guide has no steps: ' + path);
		sections.push(`## ${titleOf(guide, 'Guide')}`);
		for (const item of guide.steps) {
			const step = record(item);
			sections.push(`### ${titleOf(step, 'Step')}`);
			if (typeof step.description === 'string') sections.push(step.description);
			if (typeof step.image === 'string')
				sections.push(
					`![${titleOf(step, 'Step')}](/img/docs/${path.split('/docs/')[1]}${step.image})`,
				);
		}
	}
	return sections.join('\n\n');
}

export async function loadCatalogue(): Promise<Catalogue> {
	// Reuse the experiment's route mapping; only this boundary consumes its JS model.
	const { pages: inventory } = await import('../shared/pages.mjs');
	if (!inventory) throw new Error('The route inventory is unavailable');
	const pages: Page[] = [
		{ path: '/', title: 'Misskey Hub', locale: 'en', kind: 'home' },
	];
	const excluded: Catalogue['excluded'] = [];
	const seen = new Set(['/']);
	for (const item of inventory) {
		if (item.path === '/') continue;
		if (
			!/^\/(?:[^/]+\/)*$/.test(item.path) ||
			item.path
				.split('/')
				.some((part: string) => part === '.' || part === '..') ||
			seen.has(item.path)
		)
			throw new Error('Invalid or duplicate route: ' + item.path);
		seen.add(item.path);
		if (!item.source) {
			excluded.push({
				path: item.path,
				reason: 'Requires the original Vue page or locale redirect',
			});
			continue;
		}
		const source = item.source;
		const file = resolve(root, 'content', source);
		if (!file.startsWith(resolve(root, 'content') + '/'))
			throw new Error('Invalid content source: ' + source);
		const raw = await readFile(file, 'utf8');
		const kind = source.endsWith('.md')
			? 'markdown'
			: source.endsWith('/_dir.yml')
				? 'section'
				: 'guide';
		const metadata: unknown =
			kind === 'markdown' ? parseFrontmatter(raw).frontmatter : yaml.load(raw);
		const heading = /^#\s+(.+)$/m.exec(raw)?.[1];
		pages.push({
			path: item.path,
			title: titleOf(metadata, item.title || heading || item.path),
			locale:
				'locale' in item && typeof item.locale === 'string'
					? item.locale
					: item.path.split('/')[1] || 'en',
			source,
			kind,
			...(kind === 'guide' ? { body: guideMarkdown(metadata, item.path) } : {}),
		});
	}
	return { pages, excluded, inventoryUrls: inventory.length };
}
