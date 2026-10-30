# Ox Content + Vue SSG

A small TypeScript example using the normal Vite lifecycle and published Ox Content 3.4.3 packages.

- [vite.config.ts](vite.config.ts) combines `vue()`, `oxContentVue()`, and `createOxContentCustomHostPlugin()`.
- [host.ts](host.ts) imports each Markdown file as a Vue component, renders it inside [App.vue](App.vue), and asks Ox to write the static HTML.
- [routes.ts](routes.ts) reuses the existing experiment's route inventory and selects Markdown-backed pages.

There are no manual plugin-hook calls, temporary Markdown copies, custom Markdown renderer, client hydration, or placeholder pages. Vue renders the documents on the server; the HTML includes only the layout stylesheet. Ox's asset helper resolves its emitted filename through Vite's manifest.

## Run

Use Node.js 22.6+ and the root project's pnpm version, from the repository root:

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm pilot:ox-native:check
pnpm pilot:ox-native:build
pnpm pilot:ox-native:verify

# All Markdown-backed routes
HUB_PILOT_PAGES=all pnpm pilot:ox-native:build
HUB_PILOT_PAGES=all pnpm pilot:ox-native:verify
```

The default scope is four articles plus the index. `HUB_PILOT_PAGES=30` selects thirty articles. The full scope renders **1,342 Markdown URLs plus the index**; YAML pages, application-only Vue pages, and locale redirects are outside this example. It is not a complete 1,991-URL migration or a Nuxt/MDC compatibility implementation.

Output goes to `.pilot/ox-native-theme/public/`, or `.pilot/30/ox-native-theme/public/` / `.pilot/full/ox-native-theme/public/` for those scopes. Existing public assets are copied alongside the generated pages.

The host retains relative article links and propagates Vue SSR errors. [verify.ts](verify.ts) checks complete documents, rendered Vue Markdown, titles, and emitted stylesheet files. [Actions](../../../.github/workflows/ox-native-reference.yml) checks TypeScript and 4/30/full builds on Linux.

The sample has its own strict tsconfig; Vite 7's config bundler may still warn about the parent Nuxt tsconfig when Nuxt prepare has not run. Existing performance/VRT reports remain historical records. Compiling articles as Vue modules has a different cost from the native default-theme renderer.
