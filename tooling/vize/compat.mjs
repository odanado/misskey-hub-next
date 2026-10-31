import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

export function vizeCompatibility() {
  const root = resolve(import.meta.dirname, '../..');
  const original = resolve(root, 'components/g/Nav.vue');
  const staged = resolve(root, '.vrt/vize-compat/Nav.vue');
  // 0.609.0 emits different fragment markers for a conditional template slot
  // in SSR and the client. A real span preserves its appearance and hydration.
  const source = readFileSync(original, 'utf8').replace(/<template v-else>([\s\S]*?)<\/template>/g, '<span v-else>$1</span>');
  mkdirSync(dirname(staged), { recursive: true });
  writeFileSync(staged, source);
  return {
    name: 'site-vize-source-compatibility', enforce: 'pre',
    resolveId(id, importer) {
      if (!id.endsWith('Nav.vue')) return;
      const path = id.startsWith('@/') ? resolve(root, id.slice(2))
        : id.startsWith('.') && importer ? resolve(dirname(importer.split('?')[0]), id) : id;
      if (path === original) return staged;
    },
  };
}
