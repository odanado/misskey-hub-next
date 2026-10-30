# Misskey Hub, built with Ox Content and Vue

This reference uses native Markdown rendering inside a Vue server-rendered layout.
Directory pages contain links to their source-backed articles. Follow a link in
the sidebar to read the original repository content.

## Markdown as a Vue component

This overview is imported into the layout as a Vue component through
`oxContentVue()`. The reading controls in the header are rendered on the server;
the client hydrates only those controls. Article bodies stay in the native
Markdown pipeline, so a large collection does not require one Vue module per article.

## Rendering scope

The article pages use Ox's Markdown renderer. Existing Nuxt/MDC components and
application-only routes still need migration work. `coverage.json` lists every
rendered route and every excluded route; no placeholder pages are counted as content.
