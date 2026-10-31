import { scopePrefix } from '../shared/scope.mjs';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
export function prepareTimeComponent(root) {
	const source = readFileSync(resolve(root, 'components/mk/Time.vue'), 'utf8');
	const patched = source.replace(
		'const { locale } = useI18n();',
		'const { locale, t: $t } = useI18n();',
	);
	if (patched === source) throw new Error('Time translation capture no longer matches');
	const dir = resolve(root, '.pilot/' + scopePrefix + 'components');
	mkdirSync(dir, { recursive: true });
	const path = resolve(dir, 'Time.vue');
	writeFileSync(path, patched);
	return path;
}
