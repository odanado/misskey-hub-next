import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
import { currentProfile, timedApi, profileCompiler } from './profile.mjs';
const require = createRequire(import.meta.url);
const repository = resolve(import.meta.dirname, '../../../../..');
const dependencyRoot = resolve(repository, '.pilot/islands-comparison/vize-deps');
export async function compilerPlugins(root) {
  const compiler = process.env.HUB_VUE_COMPILER ?? 'vue';
  if (!['vue', 'vize'].includes(compiler)) throw Error('Invalid compiler');
  if (compiler === 'vue') {
    const { default: vue } = await import('@vitejs/plugin-vue');
    const stock = require('@vue/compiler-sfc'), measured = { ...stock };
    if (currentProfile()) for (const api of ['parse', 'compileScript', 'compileTemplate', 'compileStyleAsync']) {
      measured[api] = timedApi(stock[api], api, args => {
        const options = args[1] ?? args[0];
        return { file: options.filename ?? args[0]?.filename, ssr: !!(options.ssr || options.templateOptions?.ssr) };
      });
    }
    return profileCompiler(vue({ compiler: measured, template: { compilerOptions: { isCustomElement: tag => tag === 'model-viewer' } } }));
  }
  const vizeRequire = createRequire(resolve(dependencyRoot, 'package.json'));
  const entry = vizeRequire.resolve('@vizejs/vite-plugin');
  const native = createRequire(entry)('@vizejs/native');
  if (currentProfile()) for (const api of ['compileSfc', 'compileSfcBatchWithResults']) {
    if (native[api].hubProfiled) continue;
    native[api] = timedApi(native[api], api, args => ({
      ssr: !!args[1]?.ssr,
      ...(api === 'compileSfc' ? { file: args[1]?.filename } : { files: args[0].map(file => file.path) }),
    }));
    native[api].hubProfiled = true;
  }
  const { default: vize } = await import(pathToFileURL(entry));
  const originalNav = resolve(root, 'components/g/Nav.vue');
  // The existing #1 Vize adapter stages this copy and handles auto imports and
  // CSS Modules. Also route the full registry's ordinary imports to that copy.
  const stagedNav = resolve(root, '.pilot/vize-compat/components/g/Nav.vue');
  const compatibility = {
    name: 'comparison-vize-registry-boundary', enforce: 'pre',
    resolveId(id, importer) {
      if (!id.endsWith('Nav.vue')) return;
      const file = id.startsWith('@/') ? resolve(root, id.slice(2))
        : id.startsWith('.') && importer ? resolve(dirname(importer.split('?')[0]), id) : id;
      if (file === originalNav) return stagedNav;
    },
  };
  // Minimal control has no Nuxt adapter; its CSS Module counter needs the same
  // render-context correction as #1's existing full-site Vize adapter.
  const styles = {
    name: 'comparison-vize-css-module-context', enforce: 'post',
    transform(code, id) {
      if (id.includes('.vue') && /function\s+(?:ssrRender|render)\s*\(\s*_ctx/.test(code))
        return code.replace(/\$setup\.\$style\b/g, '_ctx.$style');
    },
  };
  const packageVersion = JSON.parse(readFileSync(resolve(dirname(entry), '../package.json'), 'utf8')).version;
  if (packageVersion !== '0.609.0') throw Error('Unexpected Vize version: ' + packageVersion);
  return profileCompiler([compatibility, ...vize({config: false, scanPatterns: [], customElements: ['model-viewer*']}), styles]);
}
