import { build } from 'vite';
// Use Vite's normal build lifecycle, including Custom Host's awaited writer.
await build({ configFile: new URL('./vite.config.ts', import.meta.url).pathname });
// The shared UnoCSS/SSR development loader retains watchers after closeBundle.
// All Vite output writes have finished; do not include an idle watcher in SSG time.
process.exit(0);
