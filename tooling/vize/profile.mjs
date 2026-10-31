import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { createRequire } from 'node:module';
import { vizeCompatibility } from './compat.mjs';
const require = createRequire(import.meta.url);
function currentProfile() {
  const target = process.env.HUB_COMPILER_PROFILE;
  if (!target) return;
  const registry = globalThis[Symbol.for('hub.compiler.profiles')] ??= new Map();
  if (!registry.has(target)) {
    const profile = { compiler: process.env.HUB_VUE_COMPILER ?? 'vue', instances: [], events: [], api: [] };
    registry.set(target, profile);
    // build.mjs exits after all writes. Synchronous flushing preserves every
    // client + SSR Vite instance even if closeBundle hooks run concurrently.
    process.once('exit', () => {
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, JSON.stringify(profile, null, 2) + '\n');
    });
  }
  return registry.get(target);
}
function timedApi(original, api, details) {
  return function (...args) {
    const profile = currentProfile();
    if (!profile) return original.apply(this, args);
    const startMs = performance.now();
    const finish = (value, failed = false) => {
      profile.api.push({ api, ...details(args), startMs, endMs: performance.now(), failed });
      return value;
    };
    try {
      const value = original.apply(this, args);
      if (value && typeof value.then === 'function') return value.then(result => finish(result), error => { finish(null, true); throw error; });
      return finish(value);
    } catch (error) { finish(null, true); throw error; }
  };
}
export async function createCompiler(compiler) {
  if (compiler === 'vue') {
    const { default: vue } = await import('@vitejs/plugin-vue');
    const stock = require('@vue/compiler-sfc');
    const measured = { ...stock };
    if (currentProfile()) for (const api of ['parse', 'compileScript', 'compileTemplate', 'compileStyleAsync']) {
      measured[api] = timedApi(stock[api], api, args => {
        const options = args[1] ?? args[0];
        return { file: options.filename ?? args[0]?.filename, ssr: !!(options.ssr || options.templateOptions?.ssr) };
      });
    }
    return vue({ compiler: measured, template: { compilerOptions: { isCustomElement: tag => tag.startsWith('model-viewer') } } });
  }
  // The plugin destructures these CommonJS NAPI exports when imported. Install
  // probes first, never patch package files or replace generated Vue output.
  if (currentProfile()) {
    const native = createRequire(require.resolve('@vizejs/vite-plugin'))('@vizejs/native');
    for (const api of ['compileSfc', 'compileSfcBatchWithResults']) {
      if (native[api].hubProfiled) continue;
      const original = native[api];
      native[api] = timedApi(original, api, args => ({
        ssr: !!args[1]?.ssr,
        ...(api === 'compileSfc' ? { file: args[1]?.filename } : { files: args[0].map(file => file.path) }),
      }));
      native[api].hubProfiled = true;
    }
  }
  const { default: vize } = await import('@vizejs/vite-plugin');
  return [vizeCompatibility(), ...vize({
    customElements: ['model-viewer*'],
    scanPatterns: ['components/**/*.vue', 'layouts/**/*.vue', 'pages/**/*.vue', 'ssg/**/*.vue', 'error.vue', 'app.vue'],
    config: false,
  })];
}
// Preserve hook filters/order/context. Hook waits may overlap: report their
// interval union, never sum them and call that elapsed build time.
export function profileCompiler(input) {
  const plugins = [input].flat(Infinity).filter(Boolean);
  const profile = currentProfile();
  if (!profile) return plugins;
  const instance = profile.instances.length;
  profile.instances.push({ plugins: plugins.map(p => p.name) });
  let command;
  const hooks = ['config', 'configResolved', 'buildStart', 'resolveId', 'load', 'transform', 'generateBundle', 'closeBundle'];
  for (const plugin of plugins) for (const hook of hooks) {
    const original = plugin[hook];
    if (!original) continue;
    const handler = typeof original === 'function' ? original : original.handler;
    if (!handler) continue;
    const wrapped = function (...args) {
      if (hook === 'config') command = args[1]?.command;
      const startMs = performance.now();
      const id = hook === 'transform' ? args[1] : ['load', 'resolveId'].includes(hook) ? args[0] : undefined;
      const ssr = this?.environment?.name === 'ssr' || args[2]?.ssr || (hook === 'load' && args[1]?.ssr) || (typeof id === 'string' && id.includes('vize-ssr:'));
      const finish = (result, failed = false) => {
        profile.events.push({ instance, command, plugin: plugin.name, hook, id, ssr: !!ssr, startMs, endMs: performance.now(), returned: result != null, failed });
        return result;
      };
      try {
        const result = handler.apply(this, args);
        if (result && typeof result.then === 'function') return result.then(value => finish(value), error => { finish(null, true); throw error; });
        return finish(result);
      } catch (error) { finish(null, true); throw error; }
    };
    plugin[hook] = typeof original === 'function' ? wrapped : { ...original, handler: wrapped };
  }
  return plugins;
}
