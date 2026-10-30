# Astro＋既存MDC

`pnpm pilot:astro-mdc:build`（内部mode: `astro`）。全件は`HUB_PILOT_PAGES=all`。

- [astro.config.mjs](astro.config.mjs): この案のAstro設定。共有factoryへmodeとsrcDirを渡す。
- [src/pages/[...path].astro](src/pages/[...path].astro): `prepareData('astro')`でMDCを選び、公開URLを列挙する。

Astroの公式Vue integrationがSSRと`client:load`を担当する。本文は既存MDC・Shikiを直接利用するため、Astro標準Markdownパーサーの性能比較ではない。

Vue側の互換部品は[nuxt-compat](../nuxt-compat/README.md)、共通Astro設定とHTML文書は[shared/astro](../shared/astro/)を使う。Oxを追加した差分を比較するときは[astro-ox](../astro-ox/README.md)と入口を見比べる。
