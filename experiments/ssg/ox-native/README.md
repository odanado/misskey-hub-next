# Ox native：公式Vueプラグイン＋Custom Host

[PR #2](https://github.com/odanado/misskey-hub-next/pull/2)（ubugeeei氏、参照head `c52b733`）のViteプラグイン構成を土台に、既存表示・操作の互換層を接続した比較案。**Vue SSRを使う**。Nuxt・Astroは起動しない。

## 入口と処理

- [vite.config.ts](vite.config.ts): `vue()`、`oxContentVue()`、`createOxContentCustomHostPlugin()`を登録。Viteの通常のbuild lifecycleがコンパイル・SSG・HTML保存を実行する。
- [host.ts](host.ts): Markdownを`ctx.loadModule()`でVueコンポーネントとして読み込み、共通の[PortApp](../nuxt-compat/PortApp.vue)と既存Vue部品をSSRする。CSSはOxのmanifest helperで解決し、SSR例外を収集して失敗させる。
- [markdown-compat.mjs](markdown-compat.mjs): 公式Vueプラグインの変換前にMDCコンポーネント/コードの島を抽出し、その変換結果のHTMLを共通のMDC ASTへ橋渡しする。通常のMarkdown本文は公式プラグインが変換する。
- [Markdown.vue](Markdown.vue) / [ContentRenderer.vue](ContentRenderer.vue): 共通のMDCRendererを使い、既存の注記・表・リンク・MFM等を描画する。
- [client.ts](client.ts): そのページのMarkdownモジュールを遅延読み込みしてhydrateする。元サイトのメニュー・目次・テーマ保持・MFM・表の操作を保つ。
- [data-bridge.mjs](data-bridge.mjs): 本文がコンパイル済みMarkdownモジュールにあるので、ページ用JSONへ本文ASTを重複して埋め込まない。SSG HTMLには実際の本文を描画する。TOCと本文の有無の条件は残す。

[ox-standalone](../ox-standalone/README.md)のようなSSGフックの手動呼び出しや、一時Markdownへのコピーは行わない。ビルド用workerはViteの処理完了後に終了する。共通UnoCSS/SSR loaderが保持するwatcherの待機時間をSSG時間に混ぜないためであり、HTML書き込みはVite側でawaitされる。

## PR #2との違いと制約

PR #2は最小構成の静的記事テーマで、Markdown由来1,342 URL＋索引を対象とする。既存レイアウト・MDC互換・ブラウザーhydration・VRT一致は対象外。PR記載の約3.97秒はM2 Max / Node 26の別条件であり、こちらの1,991 URLの時間と直接比較しない。

この実験は従来の全公開1,991 URLを対象にし、YAML・固定Vueページ・言語エントリーも共通互換層へ渡す。既存の3案に残る全件用query条件等の不足は共有する。30ページ専用のVRT合格は、全件生成時や全URLの表示一致を保証しない。

既存表示を保つため、最小の3ファイル構成に互換処理が加わっている。**独自のMarkdown互換処理が不要になったという結果ではない。** Vueプラグイン3.4.3の生成JS内の`rawHtml`を読む部分は内部出力形式への依存で、形式が変わったらビルドを失敗させる。更新時には公開transform hook等への置き換えを検討する。

OxのVue変換では脚注定義が本文中へ出るため、互換層で末尾のsemantic endnotesへ正規化する。コードハイライトとMDCの島には従来のMDC/Shikiを使う。メタデータ準備も共通の一括manifest・既存parserを再利用し、本文変換が重複する箇所が残る。

`pilot:ox-native:check`は新規TSと宣言された連携境界の型検査であり、既存Nuxt全体のstrict typecheckを保証するものではない。

## 実行

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm pilot:ox-native:check
pnpm pilot:ox-native:30:verify

# 同じ描画コードで30ページVRTが合格した場合だけ実行可能
pnpm pilot:full:measure --modes=ox-native,ox-ported --runs=3 --output-dir=experiments/ssg/results/ox-native/2026-10-30/final
HUB_PILOT_PAGES=all pnpm pilot:ox-native:verify
```

30ページは日英×PC/モバイル×明暗の120テスト・144画像を、固定済みの元Nuxt基準に比較する。RGBA完全一致・意味情報・操作・JS例外・hydration等を確認し、基準の264ファイルのハッシュが不変であることを保存する。フルSSG計測前にその合格記録と描画コードの指紋を照合する。**全件VRTは実行しない。**

結果は`experiments/ssg/results/ox-native/2026-10-30/`、生成物は`.pilot/30/ox-native/public/`または`.pilot/full/ox-native/public/`。画像はGitへ追加しない。実測値と比較条件は[Ox nativeレポート](../OX_NATIVE_REPORT.md)に記載する。
