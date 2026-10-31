import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
// Nuxt prefetches home-page CSS even while a pilot docs page is open. Vize
// drops the nested child selector in :global(html.dark) scoped rules, leaking
// those declarations onto html.dark. Native nesting with a normal ancestor
// selector scopes the last child correctly. Keep CSS Module blocks unchanged.
export function prepareVizeNuxtStyles(root) {
	const aliases = {};
	for (const file of ['components/index/desktop.vue', 'components/index/mobile.vue']) {
		const source = resolve(root, file),
			output = resolve(root, '.pilot/vize-compat', file);
		const text = readFileSync(source, 'utf8');
		const patched = text.replace(/<style\b[^>]*\bscoped\b[^>]*>[\s\S]*?<\/style>/g, (block) =>
			block.replaceAll(':global(html.dark)', 'html.dark'),
		);
		if (patched === text)
			throw new Error('Vize scoped global workaround no longer matches ' + file);
		mkdirSync(dirname(output), { recursive: true });
		writeFileSync(output, patched);
		aliases[source] = output;
	}
	return aliases;
}
