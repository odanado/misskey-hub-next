# Ox Content + Vue SSG reference

A TypeScript/Vue reference using published Ox Content 3.4.3 packages and the
normal Vite lifecycle. Start with [vite.config.ts](vite.config.ts):

```ts
plugins: [
	vue(),
	oxContentVue({ srcDir: contentDir, embeds: false }),
	createOxContentCustomHostPlugin({
		host: './host.ts',
		oxContent: { srcDir: contentDir, outDir, search: false, embeds: false },
	}),
];
```

`oxContentVue()` compiles the Markdown overview into a Vue component.
`createOxContentCustomHostPlugin()` owns route rendering, manifest assets,
development serving, and static HTML output. The low-level host plugin is used
instead of the `oxContentCustomHost()` convenience wrapper because the Vue
integration already owns Markdown module transformation.

Article bodies use `ctx.markdown.render()` and are placed inside the Vue layout.
This keeps large collections in the native Markdown pipeline without compiling
one Vue module per article. Aliased sources are rendered once per build through
`ctx.memo()`. Reading controls are server-rendered Vue and hydrated individually;
the static article does not need a hydration payload.

## Run

Use Node.js 22.6+ and the pnpm version in the root `package.json`.
Run from the repository root:

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm pilot:ox-native:check

# Four articles plus the reference home page
pnpm pilot:ox-native:build
pnpm pilot:ox-native:verify

# Thirty articles, or the full source-backed catalogue
HUB_PILOT_PAGES=30 pnpm pilot:ox-native:build
HUB_PILOT_PAGES=30 pnpm pilot:ox-native:verify
HUB_PILOT_PAGES=all pnpm pilot:ox-native:build
HUB_PILOT_PAGES=all pnpm pilot:ox-native:verify

# Development: the same host and Vue components
pnpm pilot:ox-native:dev
```

No Nuxt prepare step or prebuilt Vue pilot output is required. Use the repository's
normal install command with scripts enabled when developing the original Nuxt app.
Vite 7 may warn about the parent Nuxt tsconfig during config bundling; the sample
has its own strict [tsconfig.json](tsconfig.json).

Build output is `.pilot/ox-native-theme/public/`, prefixed with `30/` or `full/`
under `.pilot/` for those scopes. Static files are copied from the existing
`public/` directory. Vite's manifest supplies the emitted CSS and JavaScript URLs.

## Files

- [vite.config.ts](vite.config.ts): Vue, Ox Vue, and the custom-host plugin.
- [host.ts](host.ts): native Markdown, cached source rendering, Vue SSR, assets,
  and propagation of SSR errors.
- [routes.ts](routes.ts): reuse the existing URL mapping, read source titles,
  and adapt YAML guides to Markdown.
- [App.vue](App.vue): the real server-rendered layout and section indexes.
- [overview.md](overview.md): a Markdown component imported via `oxContentVue()`.
- [ReadingTools.vue](ReadingTools.vue) / [client.ts](client.ts): selective Vue hydration.
- [verify.ts](verify.ts): check each rendered URL, article/index content,
  server-rendered controls, and emitted CSS/JS files.

## Coverage

`coverage.json` records every rendered and excluded route. Markdown retains its
original source. `_dir.yml` becomes a titled index of its articles; stepped YAML
guides render their body, groups, step descriptions, and images. Application-only
Vue pages and locale redirects remain listed as excluded routes. They do not
produce placeholder HTML.

The layout is a small reference design, not a port of Misskey Hub's Nuxt theme.
Raw MDC is processed by Ox and does not reproduce all Nuxt/MDC components.
Guide content is rendered, but the original guide selector/layout behavior is
not ported. Existing [ox-standalone](../ox-standalone/README.md) remains the example
that reuses the Nuxt compatibility layer and existing Vue pages.

[Actions](../../../.github/workflows/ox-native-reference.yml) runs strict TypeScript
checking and 4/30/full builds with output verification. Coverage and verification
JSON are uploaded as artifacts. Historical performance and VRT reports are untouched;
the previous 1.8s default-native-theme measurement has a different rendering scope.
