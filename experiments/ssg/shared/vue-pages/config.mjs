import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { defineConfig } from 'vite';
import { createOxContentCustomHostPlugin } from '@ox-content/vite-plugin';
import { compilerPlugins } from '../../tooling/islands-comparison/compiler-benchmark/compiler.mjs';
import { pathsFor, selectVariant } from './workspace.mjs';

export async function createVariantConfig(variant) {
  selectVariant(variant);
  const paths = pathsFor(variant), root = paths.workspace;
  const native = resolve(root, 'experiments/ssg/ox-native-islands');
  const { common } = await import(pathToFileURL(resolve(native, 'vite-bridge.mjs')));
  const { cssPlugins } = await import(pathToFileURL(resolve(root, 'experiments/ssg/tooling/islands-comparison/vue-css/styles.mjs')));
  const base = common();
  return defineConfig({
    ...base, root, publicDir: resolve(root, 'public'),
    plugins: [
      ...base.plugins,
      ...cssPlugins(root, { includeUno: false }),
      ...await compilerPlugins(root, { compiler: variant.compiler, dependencyRoot: paths.directory }),
      createOxContentCustomHostPlugin({
        host: resolve(native, 'host.ts'),
        oxContent: {
          srcDir: resolve(root, 'content'), outDir: paths.output,
          docs: false, search: false, embeds: false, highlight: false, containers: true,
          ssg: { generateOgImage: false, lastUpdated: false, readerChrome: false },
        },
        build: { transformHtml: false },
      }),
    ],
    build: {
      outDir: paths.output, emptyOutDir: true, manifest: true,
      rollupOptions: { input: resolve(native, 'pages-client.ts') },
    },
  });
}
