# Vize差し替え時に見つかった問題

2026年10月30日。Misskey Hubの4ページをNuxt・Ox単独SSG・Astro＋MDC・Astro＋Oxで検証した際の記録。速度の比較は[計測レポート](./VIZE_REPORT.md)に分離し、本書では再現条件・出力差・影響・回避策を整理する。

対象は **Vize 0.607.0 / Vue 3.5.25 / Nuxt 3.20.2 / Vite 7.3.1 / Astro 6.4.8 / @astrojs/vue 6.0.1 / UnoCSS 66.5.12**。Node 22.22.2、macOS arm64（Apple M1 Pro）。新しいVizeや他の依存バージョンでの再現・上流での修正状況は未確認。

## 一覧

「不具合候補」は、この環境で出力差・失敗を確認したもの。上流の判断・修正済みIssueを確認したという意味ではない。

| ID | 問題 | 分類 | 確認した影響 | 現在の対応 |
| --- | --- | --- | --- | --- |
| VZ-01 | `isCustomElement` を残すと標準コンパイラへ戻る | Nuxtモジュールの設定上の制約 | Vizeとして計測するつもりでも実体が異なる | Vizeのパターン設定へ移し、プラグイン登録を検査 |
| VZ-02 | i18n bridgeがVite 7にない `parseSync` をimportする | Nuxt連携の不具合候補・単独再現あり | ビルド失敗 | 追加i18n bridgeだけ無効化 |
| VZ-03 | スロット内 `template v-else` のSSR Fragmentマーカーが不足 | SSR出力の不具合候補・単独再現あり | hydration mismatch | 実験用コピーをインラインspanへ変更 |
| VZ-04 | `@screen` 内のCSSスコープがVite用処理で失われる | CSS出力の不具合候補・単独再現あり | PCの文書が1カラムになる | 先に同等のmedia queryへ展開 |
| VZ-05 | ネストした `:global(html.dark)` の子セレクターが消える | CSS出力の不具合候補・単独再現あり | 先読みされたCSSで別ページの色まで変わる | scoped styleだけ祖先セレクター表現へ変更 |
| VZ-06 | Astroで互換コピー用エイリアスが優先されない | このプロジェクトのパス解決・連携上の問題 | 元ソースがコンパイルされ、修正が効かない | 専用モジュールIDで解決 |
| VZ-07 | Nuxt側のコンポーネント差し替えが登録順に依存する | モジュール登録順の問題 | Vizeが元のコンポーネントを参照する | パイロットモジュールを先に登録 |

## 最小再現と証拠

次のコマンドは、インストール済みのコンパイラでVZ-02〜05を確認し、入力・出力・バージョンをJSONへ保存する。アプリのソース、依存、VRT基準画像を変更せず、全体ビルドやブラウザー検証も実行しない。

```sh
node experiments/ssg/tooling/repros/vize-issues.mjs
```

- [再現スクリプト](./tooling/repros/vize-issues.mjs)
- [実行結果：コンパイラ出力とi18n helperのimport結果](./results/vize-issue-repros.json)
- [互換対応後の既存VRT結果](./results/compiler-vrt.json)

再現スクリプトはVizeの実出力を記録する診断用であり、特定の壊れた出力を将来も要求するテストではない。更新後は新しい結果と以下の期待値を比較する。VZ-01・06・07はプロジェクト内で観測した連携上の問題で、このスクリプトによる単独再現の対象外。

## VZ-01：Nuxtのカスタム要素設定によるコンパイラのフォールバック

### 再現条件と観測

元のNuxt設定には以下がある。

```ts
vue: {
  compilerOptions: {
    isCustomElement: (tag) => tag.startsWith('model-viewer'),
  },
},
```

このまま `@vizejs/nuxt` を追加すると、0.607.0のモジュールは `isCustomElement` をネイティブ側へ転送できないオプションと判定し、警告を出してNuxt標準のVueコンパイラを維持した。無警告のフォールバックではない。

インストール済みモジュールの `unsupportedNuxtVueCompilerOptions()` と `resolveNuxtCompilerOptions()` でも、未対応オプションから `compatibility.hostCompiler = true` を設定する処理を確認した。

**ビルド成功・表示一致だけではVizeへの置換を確認できない**。探索時にはこれにより標準コンパイラでの値が得られたが、その値は最終のVize比較から除外した。

### 回避策と制限

パイロット時だけ元の関数を渡さず、Vizeの `compiler.customElements: ['model-viewer*']` で同じ接頭辞条件を表現した。さらに `vite-plugin-vize` が登録されていなければビルドを失敗させる検査を追加した。プラグインの存在検査だけで全SFCの処理を証明するものではないため、生成されたVizeモジュールやSSR/CSS出力も確認した。

対応箇所：[Nuxt設定](../../nuxt.config.ts)、[登録検査](./nuxt-pilot/module.ts)。`model-viewer` 自体の実動作は4ページの対象外で、置換した条件の一般的な互換性までは検証していない。

## VZ-02：Nuxt i18n bridgeとVite 7のAPI不整合

### 再現条件と観測

`@vizejs/nuxt@0.607.0` の追加i18n bridgeを有効にし、翻訳呼び出しを含むVueモジュールをコンパイルすると失敗した。

```text
[vizejs:nuxt-transform-bridge]
The requested module 'vite' does not provide an export named 'parseSync'
```

同パッケージの `dist/i18n-*.mjs` は `parseSync` を `vite` からimportする。一方、この環境のVite 7.3.1にはそのexportがない。helperを直接importするだけでも同じ `SyntaxError` が再現した。なお、同モジュールの宣言するVite peer範囲は `^7.3.0 || ^8.0.0` で、今回のViteはその範囲内。

### 回避策と制限

Nuxt設定の `bridge: { i18n: false }` により、Vizeが追加するi18n bridgeだけを無効化した。既存の `@nuxtjs/i18n` / vue-i18nは残し、パイロット4ページの日本語・英語表示と操作はVRTで確認した。

これはパッケージの修正ではない。追加bridgeが担う翻訳ヘルパーの注入を必要とする他のコンポーネントまで動くという結論にはできない。Viteの更新による解消は試していない。速度比較の他の条件を維持するため、今回は既存Viteを更新しなかった。

対応箇所：[Nuxt設定](../../nuxt.config.ts)。

## VZ-03：スロット内の条件分岐でSSRとclientの構造が異なる

### 最小入力

```vue
<script setup>
const show = false
</script>
<template>
  <Link>
    <i v-if="show" />
    <template v-else>Docs</template>
  </Link>
</template>
```

### 期待値と実際の出力

Vizeのclient側は `v-else` をFragmentとして生成するが、SSR側は単なる文字列として出力した。Vue標準コンパイラの同じSSR分岐にはFragmentの開始・終了コメントがある。

```js
// Vize SSRの分岐
_push(`Docs`)

// Vue標準SSRの同じ分岐
_push(`<!--[-->Docs<!--]-->`)
```

実アプリの `components/g/Nav.vue` では4つのナビゲーションラベルで発生した。ブラウザーでは、server側がtext node、client側が `Symbol(v-fgt)` を期待するhydration警告と、`Hydration completed but contains mismatches.` を確認した。

### 回避策と制限

ヘッダーの実験用コピーで `<template v-else>` を `<span v-else>` へ置換した。元の本番SFCは変更せず、追加spanの表示・リンクの意味がパイロットで一致することをVRTで確認した。

対応箇所：[互換コピー生成](./nuxt-compat/vize-compat.mjs)。DOM構造そのものの同一性を保証する対処ではない。スロット・条件分岐の全パターンや、Vaporでの再現は検証していない。

## VZ-04：Vite向けCSS処理で `@screen` 内のスコープが失われる

### 最小入力

```css
.docs-root { grid-template-columns: 1fr; }
@screen lg {
  .docs-root { grid-template-columns: 16rem 1fr; }
}
```

### 期待値と実際の出力

`<style scoped>` のため、通常規則と `@screen` 内の規則の両方に同じスコープ属性が必要になる。しかし、Vizeの **`scopeViteCssForPipeline(css, 'data-v-repro')`** は次の形を返した。

```css
.docs-root[data-v-repro] { grid-template-columns: 1fr; }
@screen lg {
  .docs-root { grid-template-columns: 16rem 1fr; }
}
```

UnoCSSが後から `@screen lg` をmedia queryへ変換しても、失われたスコープは戻らない。基本規則の方が詳細度で勝ち、PCでも1カラムになって本文がサイドバーの下へ回った。

**同じ入力でも `compileSfc().css` 単独の出力では両方にスコープが付く。** 再現した経路はViteプラグインがスタイルを処理する際のAPIであり、「VizeのSFC単独コンパイルが常に `@screen` を壊す」とは扱わない。この経路差もJSONへ記録した。

### 回避策と制限

文書レイアウトの実験用コピーで、Vizeへ渡す前に `@screen lg` を現在の設定と同じ `@media (min-width: 1024px)` へ展開した。このmedia queryの内部にはVite向け処理でもスコープが付く。

対応箇所：[互換コピー生成](./nuxt-compat/vize-compat.mjs)。他の独自at-rule、他のUnoCSSバージョン、全ブレークポイントは未検証。テーマの `lg` 幅を変更する場合は回避策の1024pxも見直す必要がある。

## VZ-05：scoped CSSの `:global` とネストの組み合わせで子セレクターが消える

### 最小入力と出力差

```css
:global(html.dark) {
  .x { color: #f0ffc7; }
}
```

Vue標準のscoped CSS処理では子の `.x` にスコープを付けて保持する。一方、VizeのSFC単独出力とVite向けCSS処理は、次のように子セレクターを落とした。

```css
html.dark { color: #f0ffc7; }
```

本来はそのコンポーネントの `.x` に限る宣言が、`html.dark` 全体へ適用される。

### 実アプリでの影響

`components/index/desktop.vue` と `components/index/mobile.vue` のホームページ用CSSで発生した。Nuxtがリンク先を先読みするとそのCSSも読み込まれ、文書ページを開いているだけでもリンク・前後リンク・フッターなどの色が変わった。探索時のVRTではライト8テストが通り、ダーク8テストが失敗した。

CSS読込直後だけの確認では見逃すことがあった。先読み後のcomputed styleとCSS規則を調べ、`html.dark` の色指定により `rgb(240, 255, 199)` が継承されることを確認した。文書ページで使うコンポーネントだけを移植しても、Nuxtでは先読み先のCSSが影響し得る。

### 回避策と制限

Nuxt版だけ、ホーム2コンポーネントの実験用コピーの **scoped style内** を次の形へ変更した。

```css
html.dark {
  .x { color: #f0ffc7; }
}
```

この入力をVizeは `html.dark .x[data-v-repro]` の形へ変換する。CSS Modulesのブロックは変更していない。Nuxtの先読みも止めていない。

対応箇所：[Nuxt用CSS互換コピー生成](./nuxt-pilot/vize-nuxt-styles.mjs)。Vize 0.607.0向けの回避策であり、Vue標準コンパイラへ一律適用する修正ではない。ホームページ自体の全表示・全操作は今回のVRT対象外。

## VZ-06：Astroでのパス解決と互換コンポーネントの参照

Astroを同じリポジトリ内で動かした際、Nuxt由来のtsconfigパスを使うresolverが、追加した互換コピー用エイリアスより前に解決される状態を確認した。元のヘッダーがコンパイルされ、VZ-03の修正を用意してもhydration不一致が残った。

`#port-nav` / `#port-docs-layout` を専用モジュールIDとして定義し、移植用Viteプラグインの `resolveId()` から正しい元ソースまたは実験用コピーを返すことで解消した。

対応箇所：[Vite側の解決](./nuxt-compat/vite.mjs)、[ヘッダー登録](./nuxt-compat/registry.ts)、[レイアウト参照](./nuxt-compat/PortApp.vue)。これはNuxtとAstroを共存させた検証環境での設定干渉であり、Vize単体のエイリアス処理の不具合とは断定しない。独立したAstroプロジェクトでの再現は未確認。

## VZ-07：Nuxtのコンポーネント登録順

Vizeモジュールを先に登録すると、元のコンポーネントパスがVize側のresolverへ渡り、その後にパイロット用フックでコピーへ変更しても、元ソースのSSR出力が残る状態を確認した。

パイロットモジュールを `@vizejs/nuxt` より前に登録し、`components:extend` / `app:resolve` で参照先を変更してからVizeへ渡すようにした。確認には実際のSSR成果物に含まれる `.pilot/vize-compat/...` のモジュールIDも用いた。

対応箇所：[登録順](../../nuxt.config.ts)、[コンポーネント・レイアウト差し替え](./nuxt-pilot/module.ts)。型定義ファイルだけでは実行時の参照先を判断しない。今回のフックの順序に関する問題であり、モジュール順が異なるすべてのNuxtプロジェクトに同じ症状が出ると主張するものではない。

## その他の連携上の注意と性能

移植版の自動import処理は、元の `.vue` ソース内のscriptへ注入する方式だった。Vizeでは仮想JSモジュール経由になるため、生成後のJSにも自動import・`import.meta.client/server`・SVG importの変換を適用する経路を追加した。これは移植アダプター側の実装対応であり、この記録では独立したVize不具合とは数えていない。[実装](./nuxt-compat/vite.mjs)を参照。

Astroでは公式Vue integrationのSSR・island・appEntrypointを維持し、SFCコンパイラを置換する必要があった。`vite:vue` の登録をそのまま追加する二重構成の検証結果を示すものではない。[構成](./shared/astro/create-config.mjs)を参照。

NuxtのSSG時間は通常Vueの41.93秒からVizeの46.72秒へ約11.4%増えた。移植3案では短縮した。これらは各3回のSSG全体の中央値で、Nuxt bridge・初期化・SSR・アセット処理も含む。SFCコンパイラ単体が遅いという不具合の証拠ではない。詳細は[速度比較と条件](./VIZE_REPORT.md)を参照。

## 回避後の状態と残る確認

回避策は本番SFCを直接変更せず、環境変数で有効になる実験用コピー・設定として実装した。Vizeの4構成は各16テスト・20画像、計80画像が元の基準とRGBA完全一致した。通常Vueも含めると128テスト・160画像が成功している。マスク・許容ピクセル差・基準画像の更新は使用していない。この結果は前回の最終VRTであり、本レポート作成時に全体ビルド・VRTを再実行したものではない。

回避策はVizeパッケージ本体の修正ではない。4ページ外のMDC構文、YAMLガイド、ディレクトリ一覧、ブログ、全言語、`model-viewer` の動作、ホームページ全体、他ブラウザーまでは検証していない。更新時はまず最小再現の出力を確認し、回避策を外せると判断したものについて既存VRTを実行する。

```sh
# 最小再現の出力を取得
node experiments/ssg/tooling/repros/vize-issues.mjs

# 既存アプリの回避策込みの生成物を検証
HUB_VUE_COMPILER=vize pnpm pilot:build baseline
HUB_CONTENT_PILOT=baseline-vize pnpm pilot:vrt

# 他構成はREADMEの個別ビルド手順を参照
```

## VZ-08：全件SSRでのCSS Modules参照

2026年10月30日の全公開URLへの拡大で、`pages/about-us/team.vue`のSSRが`Cannot read properties of undefined (reading 'teamRoot')`で停止した。Ox単独＋VizeとAstro＋Ox＋Vizeで確認した。生成されたSSRには`$setup.$style.teamRoot`がある一方、そのsetup戻り値で`$style`を取得できない。失敗箇所の抜粋は[記録JSON](./results/full/vize-css-module-failure.json)に保存した。

全件検証のVize構成だけ、生成後のVue render / ssrRender関数で`$setup.$style`を`_ctx.$style`へ置き換えた。Vueがコンポーネントの公開インスタンス上で解決するCSS Modulesを使い、クラス名やCSSの内容は維持する。既存のSFC本文は変更せず、通常Vueへのコンパイラフォールバックも使わない。変換は`_ctx`引数を持つ生成関数に限定し、適用したモジュールを`[full-vize-compat]`としてログに記録する。

対応箇所：[生成JSの互換処理](./nuxt-compat/vize-compat.mjs)、[移植版のVite post transform](./nuxt-compat/vite.mjs)、[Nuxt版のpost transform](./nuxt-pilot/module.ts)。ソースへの`useCssModule()`自動注入では今回のVize経路に反映されず、SSRの停止は解消しなかったため採用していない。

Ox単独＋Vizeの事前試行ではこの回避後に1,991 URLの生成が完走した。最終の全4構成の結果は[全件SSGレポート](./FULL_SSG_REPORT.md)と[Vize計測JSON](./results/full/vize-timings.json)に記録する。全件のVRTは実行しないため、この回避で表示やhydrationが完全一致したとは判定しない。これは現在のVize 0.607.0と本リポジトリの連携で確認した事象であり、Vize単体の最小再現による原因の切り分けは未実施。

## VZ-09：Nuxtの自動importでVue RouterのCommonJSエントリーを取り込む

全件Nuxt＋Vizeでは、ブログ106件（言語エントリー側も含めると212 URL）とテストページなどで500になり、初回計測は1,765/1,991 URLで失敗した。227.35秒は失敗までの経過時間であり、完走時間には使わない。失敗ログは[初回Nuxt＋Vizeのエラー抜粋](./results/full/vize-router-failure.json)に保存した。

生成されたブログのSSRチャンクは、自動importされた`onBeforeRouteLeave`をVue RouterのCommonJSエントリー経由で取り込んでいた。そのCommonJS変換結果にはVue ESMへの`import require$$0 from '.../vue/index.mjs'`があり、Vueがdefault exportを持たないため`SyntaxError`になった。Vizeの4ページ検証では、ブログとテストページを生成しなかったため到達していなかった。

全件Nuxt＋Vizeだけ、`vue-router`のaliasと、自動importされる`onBeforeRouteLeave` / `onBeforeRouteUpdate` / `useLink`の参照先を、同じインストール済みVue Routerの`dist/vue-router.mjs`へ明示した。ルーターフックを省略したり、空の関数へ置き換えたりはしない。通常Vueと移植3案には適用しない。

対応箇所：[実験用Nuxtモジュール](./nuxt-pilot/module.ts)。この修正後にNuxtだけ全件を再計測し、219.90秒で1,991 URLが完走した。移植3案はこのNuxtモジュールを読み込まないため、先に成功した計測値を保持する。Vize本体の最小再現や上流修正は今回の範囲に含めない。
