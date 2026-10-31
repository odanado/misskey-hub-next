# PR #3 の Vize コンパイラ検証

PR #3 の `c0aa1d20e1c2225f8c792996c4d5215477d04881` を基準に、Vue SFC の Vite プラグインを `@vitejs/plugin-vue 6.0.10` から `@vizejs/vite-plugin 0.609.0` に切り替えた比較。検証コードは `codex/vize-islands-benchmark` ブランチに分離しており、PR #3 の本番コードは通常 Vue のまま。

## 結果（Mac、各3回の中央値）

| 計測対象 | 通常 Vue | Vize | 短縮率 |
| --- | ---: | ---: | ---: |
| full SSG（2,003公開URL＋404） | 26.473秒 | 26.230秒 | 0.92% |
| クライアント Vite ビルド全体 | 3.480秒 | 3.180秒 | 8.62% |
| SFCコンパイラAPI内の処理 | 0.561秒 | 0.112秒 | 80.06% |
| SFCコンパイラプラグインのフック内の処理 | 0.703秒 | 0.280秒 | 60.08% |

`.vue` のコンパイルは約5倍速くなった。一方、full SSG の差は約0.24秒で、今回の実行間のばらつきより小さい。全体が大幅に高速化したとは判断できない。Markdown/MDC/Shiki、ページの描画、データ準備、ファイル出力など、SFCコンパイル以外の処理が引き続き大半を占める。

| ラウンド | 実行順 | full SSG | SFCコンパイラAPI |
| --- | --- | ---: | ---: |
| 1 | Vue | 27.012秒 | 0.561秒 |
| 1 | Vize | 26.230秒 | 0.112秒 |
| 2 | Vize | 26.117秒 | 0.087秒 |
| 2 | Vue | 26.424秒 | 0.561秒 |
| 3 | Vue | 26.473秒 | 0.554秒 |
| 3 | Vize | 26.825秒 | 0.113秒 |

生の集計値・API別の回数と時間・ソースのフィンガープリントは [vize-benchmark-results.json](./vize-benchmark-results.json)。ログと詳細プロファイルはローカルの `.vrt/vize-benchmark/` に保持し、画像やビルド出力はコミットしていない。

## `.vue` 個別計測の範囲

単独のテンプレートを繰り返すマイクロベンチではなく、上記の実際の full SSG 中に使用されたコンパイラ入口を計測した。

- Vue：`parse`、`compileScript`、`compileTemplate`、`compileStyleAsync`。`compileScript` 内で行われるクライアント用 inline template のコンパイルも含む。
- Vize：`compileSfc` と `compileSfcBatchWithResults`。Rust の並列先行コンパイルと、クライアント・SSR双方のオンデマンドコンパイルを含む。先行コンパイルだけを除外して速く見せることはしていない。
- API時間は実時間で、CPU時間ではない。非同期style処理が重なる場合は区間の和集合を採り、二重加算しない。SFCプラグインのload/transform/buildStart時間も別に計測し、これも重複区間を除いている。フック内の待ち時間を含むため、クリティカルパスやSSGの工程別排他的時間とは解釈しない。
- コンパイラAPI時間は、一般のJSバンドル・minify、SVGのテンプレート変換、Sass/UnoCSS/PostCSS全体、自動importの互換処理、Vue SSRのHTML描画を含まない。これらはViteビルド全体またはfull SSGの値に含まれる。
- SFC APIが処理したユニークファイルはVue 121、Vize 123。Vizeは先行コンパイルにより、Vueではテンプレートを使わない `layouts/docs.vue` と、元ファイルに加えて互換用Navコピーも処理する。Vue側だけ余分なページを処理する比較ではない。

`ssg/config.ts` にある静的ドキュメント枠用のstyle抽出は、両構成とも既存の `@vue/compiler-sfc` の `parse` / `compileStyle` を継続利用する。これはコンポーネントのJS/SSRコンパイラのfallbackではなく、共通の静的CSSブリッジであり、上記APIプローブの外側にある。`vite-svg-loader` によるSVG変換も共通のまま。したがってVueコンパイラ依存を完全に削除した検証ではない。

## 再現条件

- macOS arm64 / Apple M1 Pro / Node 22.22.2 / pnpm 10.27.0。
- Vue 3.5.25 / Vite 8.3.5 / Ox Content 3.4.3。
- 同じworktree、同じlockfile・コンテンツで、通常VueとVizeを交互に各3回。ビルドやVRTを同時実行しない。
- 毎回新しい `pnpm build` プロセスを起動し、起動からクライアントJS/CSS、全ページ生成、publicコピー、旧URLリダイレクト、404処理の終了までを測る。
- `VIZE_PRECOMPILE_CACHE=0` を設定し、各実行前に `node_modules/.vite` と `node_modules/.vize` を削除。OSのファイルキャッシュは維持。ウォームな永続SFCキャッシュだけでVizeを有利にしない。
- コンパイラAPI・フック計測のプローブは両方に有効。profile JSONの終了時書き込みもfull SSG時間に含む。
- タイマー終了後、全2,003 URLの非空HTML、404、クライアントmanifestを検証。MarkdownをクライアントJSとして配信していないことも確認した。6回とも成功。

```sh
pnpm install --frozen-lockfile
node --experimental-strip-types tooling/vize/benchmark.mjs
# 個別の生成（プローブなし）
HUB_VUE_COMPILER=vue pnpm build
VIZE_PRECOMPILE_CACHE=0 HUB_VUE_COMPILER=vize pnpm build
# 計測ツールの重複区間・欠測検出テスト
node --test tooling/vize/profile.test.mjs
```

既存の `pnpm test` 18件と計測ツールのテスト3件は合格。

## 表示の互換性

基準画像はNuxt masterではなく、今回生成し保存した **PR #3通常Vue版**。既存のMac・PCライト（1440×900）のVRTを使用。RGBA・画像寸法を完全一致で比較し、マスク・許容誤差を使用していない。

| 対象 | 結果 |
| --- | --- |
| 既存Markdown 30ページ | **30/30 完全一致**、hydrationエラーなし |
| 追加のトップ（日英）、team、blog、servers、言語入口、share-link-generator | **6/7 完全一致**。share-link-generatorのみhydrationエラー |

full SSGの成功は、全ページの表示・操作互換を保証するものではない。全件VRT、モバイル、ダークテーマ、全操作の確認は今回実施していない。

## Vize 0.609.0 で必要だった互換処理・未解決事項

1. **CSS Modules参照でSSG停止**：`components/g/Nav.vue` のSSR出力が `$setup.$style.root` を参照し、`$style` がundefinedで停止した。生成された `render` / `ssrRender` の `$setup.$style` を `_ctx.$style` に補正するpost transformを追加。Vueコンパイラへのfallbackは行っていない。
2. **Nuxt由来のauto import境界**：Vizeは通常のSFC pre-transform前にloadで生成JSを返す。Vue API・Nuxt互換composableの自動import、`import.meta.client/server`、SVG component importの変換を、その生成JSにも適用するpost transformを追加。
3. **Navの条件付きtemplate slotのhydration不一致**：最初の30ページVRTはすべてhydrationエラー。`<template v-else>` を同じ内容の `<span v-else>` にしたコピーをVize構成だけで生成し、そのNavへresolveすることで30/30に改善。元のコンポーネントファイルや通常Vue版は変更していない。
4. **share-link-generatorは未解決**：追加チェックでは通常Vue版が正常で、Vize版だけ `Hydration completed but contains mismatches.`。今回のベンチではこれを許容して「全ページ互換」と扱っていない。本番採用には追加調査・修正が必要。

公式の [Viteプラグインの説明](https://vizejs.dev/guide/vite-plugin/) に沿って差し替えた。Vizeに含まれる `vite:vue` という名前の互換API shimと、実際の `@vitejs/plugin-vue` は別物。Vize構成ではnative APIの呼び出しを実測し、クライアント・SSR両方でVizeが使われていることを確認した。
