# Nuxt互換レイヤー（3方針共通）

元のNuxtページ・レイアウト・コンポーネントを、Nuxtを起動しないVueアプリで再利用するためのラッパー。公式Nuxt Layersの`extends`を使うものではない。

| ファイル | 役割 |
| --- | --- |
| runtime.ts | route、i18n、state、queryContent等の互換API |
| vite.mjs | auto-import、Nuxt固有importの解決、SVG・UnoCSS連携、Nuxt同等のPostCSS処理 |
| PortApp.vue | payload/contextを渡す共有Vueアプリ |
| FullSurface.vue | 全件用に元のpage/layoutを選択する |
| registry.ts | 既存コンポーネントとProse部品の登録 |
| ContentRenderer.vue / FullMDC.vue | MDC AST・YAML内Markdownの表示 |
| head.mjs | 共通のmeta/headと安全なJSON埋め込み |
| styles.ts | 元サイトの共通CSS |
| extended-components.mjs / vize-compat.mjs | 原本を変更しない実験用の互換処理 |

Ox固有のSSRエントリー・クライアント起動は[ox-standalone](../ox-standalone/README.md)が所有する。Astroでは公式integrationのSSR・hydrateを使う。このディレクトリは3案の共通表示境界で、SSG基盤の選択を担当しない。

全件の固定ページ・SEO・クライアント機能は移植途中。runtimeの互換APIは今回の検証に必要な範囲の実装で、Nuxt API全体の互換性は保証しない。
