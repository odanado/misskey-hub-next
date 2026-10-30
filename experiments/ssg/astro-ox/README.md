# Astro＋Ox Content

`pnpm pilot:astro-ox:build`（内部mode: `astro-ox`）。全件は`HUB_PILOT_PAGES=all`。

- [astro.config.mjs](astro.config.mjs): この案のAstro設定。
- [src/pages/[...path].astro](src/pages/[...path].astro): `prepareData('astro-ox')`でOxを選び、公開URLを列挙する。

Astro＋MDCと同じVue表示・Astro SSGを維持し、原稿の収集・本文変換をOx N-APIへ替える案。MDC構文・コードハイライトには既存MDCを併用する。HTMLファイルの最終生成はAstroが担当する。

Ox Built-in SSGを使う[ox-standalone](../ox-standalone/README.md)との違いはSSGの起動・出力基盤。本文エンジンと互換部品は共通で、パーサーの独自コピーは持たない。
