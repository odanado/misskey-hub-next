import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
// Vize's full-site SSR can emit $setup.$style without returning a $style
// setup binding. Vue exposes the same CSS module on the render context.
export function repairVizeCssModuleReferences(code, id) {
	if (
		!id.includes('.vue') ||
		!code.includes('$setup.$style') ||
		!/function\s+(?:ssrRender|render)\s*\(\s*_ctx/.test(code)
	)
		return code;
	console.log('[full-vize-compat] CSS module render context: ' + id);
	return code.replace(/\$setup\.\$style\b/g, '_ctx.$style');
}
// Keep authored components untouched. These input-level compatibility copies
// are compiled by Vize; they do not reuse Vue compiler output or Nuxt HTML.
export function prepareVizeComponents(root) {
	const aliases = {};
	for (const file of ['components/g/Nav.vue', 'layouts/docs.vue']) {
		const source = resolve(root, file),
			output = resolve(root, '.pilot/vize-compat', file);
		const text = readFileSync(source, 'utf8');
		// Vize 0.607.0 omits SSR fragment anchors for a conditional <template>
		// inside a slot. An inline span preserves layout and hydrates consistently.
		// Expand UnoCSS @screen before native style scoping: otherwise the rule
		// inside the media query loses its scope selector and its specificity.
		const patched = file.endsWith('Nav.vue')
			? text.replace(/<template v-else>([\s\S]*?)<\/template>/g, '<span v-else>$1</span>')
			: text.replace('@screen lg {', '@media (min-width: 1024px) {');
		if (patched === text) throw new Error('Vize workaround no longer matches ' + file);
		mkdirSync(dirname(output), { recursive: true });
		writeFileSync(output, patched);
		aliases[source] = output;
		aliases['@/' + file] = output;
	}
	return aliases;
}
