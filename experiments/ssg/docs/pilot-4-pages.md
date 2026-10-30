# 同じ表示でのOx単独SSG・Astro・Astro＋Ox比較

全公開URLの完走・速度確認（Vizeなし4構成）は[FULL_SSG_REPORT.md](../FULL_SSG_REPORT.md)。`pnpm pilot:full:measure --without-vize --runs=1`で再実行する。Vizeありの追加結果も同レポートに記載。30ページのVRTは保留中。

[SSG構成の比較結果](../REPORT.md) / [Vizeコンパイラの比較結果](../VIZE_REPORT.md) / [Vize差し替え時の問題](../VIZE_ISSUES.md)

既存の[4ページ](../shared/pages.mjs)を対象に、Nuxtを外した3構成へ表示と操作を移植する実験。[比較結果と提案](../REPORT.md)を参照。

## 構成

| モード | SSG | 本文処理 | 表示・操作 |
| --- | --- | --- | --- |
| `baseline` | 従来のNuxt/Nitro | Nuxt Content v2 / MDC | 既存の実装 |
| `ox-ported` | Ox自身のカスタムテーマSSG | Ox / MDC互換AST / 既存Shiki | 元のVueコンポーネントをViteでコンパイルしSSR・hydrate |
| `astro` | Astro 6.4.8 | 既存MDC / unified / Shiki | 同じVueコンポーネントを公式Vue integrationでSSR・hydrate |
| `astro-ox` | Astro 6.4.8 | Oxのメタデータ・本文処理 / MDC互換AST / 既存Shiki | `astro` と同じVueコンポーネント |

`astro` は表示互換性のために既存のMDCパーサーを直接利用する構成であり、Astro標準Markdownコンパイラーの速度を測る実験ではない。`astro-ox` ではAstroがSSGを担当し、OxのRust APIがコレクションと本文を処理する。`astro` の実行経路ではOxのAPIを呼ばない。

Astro 7は現在のNode 22.22.2より新しいNodeを要求するため、Node 22.12以降で動くAstro 6.4.8 / Vue integration 6.0.1を固定した。Vue、MDC、Shiki、UnoCSS、既存Nuxtの依存は従来の版を維持する。

## コンポーネントの移植

元の `layouts/docs.vue`、`pages/docs/[...slug].vue`、ヘッダー、フッター、サイドバー、TOC、前後リンク、注記、画像・リンク・表・コードのVueコンポーネントを実際にインポートしてコンパイルする。CSSとSVGも元のソースを使う。Nuxtの生成済みHTMLやCSS、基準スクリーンショットを移植版の入力にしない。

`runtime.ts` は元コンポーネントが呼ぶルート・翻訳・状態・コンテンツ取得の境界を、Vueのprovide/injectと原稿由来のデータで置き換える。NuxtのSSG・ルーター・Contentサーバーを起動する実装ではない。MDCと一部Proseコンポーネント・純粋なパスメタデータ処理はライブラリとして再利用する。

- サイドバーと前後リンクは全1,590ファイルのメタデータから作る。数値プレフィックスの順序、`_dir.yml`、非表示項目、Setext見出し、インラインコードのタイトルも合わせる。
- 本文をパースするのは対象4ページ。対象外の全文ASTキャッシュを生成しない。
- 日本語・英語、ローカルフォント・画像、既存Google Fontsの参照、メタデータと構造化データを移す。
- ヘッダーの言語リンク、文書メニュー・TOCの開閉、ページ遷移、テーマ切り替えと保存を維持する。
- 新構成のページ遷移はMPA。NuxtのSPAルーターや遷移中のNProgressは移植対象外。

`ox-ported` では、Vueの非同期SSRを各ページで実行してから、Oxの同期カスタムテーマ `ssg.render` に渡す。Ox自身がルートとHTMLファイルを出力する。Vueコンパイル・SSR・Ox側の処理はすべて計測時間に含む。

Astro版は `.astro` の `getStaticPaths()` で4ルートを生成し、`PortApp.vue` を `client:load` でhydrateする。AstroのVue連携ではSVGの既定処理が異なるため、元のアイコンを `?component` で明示する。

## 互換化で検出した差

- グローバルCSSをコンポーネントCSSより後にすると、デスクトップでもメニューボタンが出る。元サイトと同じ適用順にした。
- OxはインラインCSSを共通アセットへ抽出する。MDC本文中のShikiのstyle要素をそのままhydrateするとDOMが一致しないため、CSSをheadへ移した。既存の末尾要素による `:last-child` の余白規則も、非表示の末尾マーカーで保持した。
- MDCパーサーを文書間で使い回すと見出しIDのカウンターが漏れ、英語の `CW` が `cw-1` になる。パーサーは文書ごとに生成し、Shikiの高コストな初期化だけを共有する。
- 既存UnoCSS 66はAstro 6のprerender/client環境をまたぐCSSフックを想定していないため、Astro用の小さな互換フックで現在の環境に結び直す。既存サイト全体のUnoCSSを更新する範囲には広げていない。
- 既存の英語canonicalに末尾スラッシュが二つある挙動も、移行比較では維持した。修正は別件として扱う。

## 実行

リポジトリルートから実行する。

```sh
pnpm install --frozen-lockfile
pnpm exec playwright install chromium

# 元サイトの基準がない場合のみ作成
pnpm pilot:build baseline
HUB_CONTENT_PILOT=baseline pnpm pilot:vrt --update-snapshots

pnpm pilot:ssg:build ox-ported
HUB_CONTENT_PILOT=ox-ported pnpm pilot:vrt

pnpm pilot:ssg:build astro
HUB_CONTENT_PILOT=astro pnpm pilot:vrt

pnpm pilot:ssg:build astro-ox
HUB_CONTENT_PILOT=astro-ox pnpm pilot:vrt

# Nuxt基準を含め、各3回を順番を入れ替えて計測
pnpm pilot:ssg:measure

# 計測後の4構成をまとめて再検証し、結果を保存
pnpm pilot:ssg:verify

# 任意の構成をローカルで表示
HUB_CONTENT_PILOT=astro node experiments/ssg/tooling/serve.mjs
```

生成先は `.pilot/<mode>/public/`、ログは `.pilot/<mode>/build.log`。VRTのHTMLレポートと差分画像・実際の撮影画像は `.pilot/<mode>/vrt/`。計測結果は `results/timings.json`、VRT集計は `results/vrt.json` に保存する。

`measure --ports-only` は直前の未変更のNuxt基準3回分を保持し、移植3案だけを再計測するための補助機能。利用した場合は元の基準計測時刻を結果に記録する。全構成を最初から再現する場合はオプションを付けない。

## 検証と計測の範囲

VRTは従来の基準画像を更新せず、1440×900 / 390×844、light/darkの全16テスト・20画像を比較する。PNGの全RGBAバイトを一致させ、マスクや許容ピクセル差は使わない。SEOの主要項目、見出しID、リンク、画像alt、コード、hydration、メニュー・TOC、ページ遷移、デスクトップのテーマ切り替えと再読み込み後の保存も検証する。

外部通信を全構成で同様に止め、ローカル画像のdecode、フォント、hydrationを待つ。実際にGoogle Fontsを取得する条件や、他のブラウザーでの表示はこのVRTの範囲外。別OSでは元サイトから基準を撮影する。

計測には子プロセスの起動・ライブラリ初期化、原稿とメタデータ取得、Vue/SSR/クライアントJS/CSSのコンパイル、静的HTML生成、全公開アセットのコピーを含める。各回で生成先とフレームワークのキャッシュを消し、ブラウザーと並行実行しない。OSのファイルキャッシュは消さない。

移植版は4ページのアプリとしてビルドする。Nuxt基準は4ページをプリレンダーする構成でも、既存サイト全体のルート・クライアントモジュールをコンパイルし、Content全件キャッシュも生成する。したがって、今回の値をそのまま全サイト移行後の時間へ外挿することはできない。

本文の全MDC構文、独自frontmatter、YAMLのステップガイド、索引、ブログ、全言語、全ルート・旧URLリダイレクトの移行は未検証。通常の `pnpm generate` と本番デプロイフローは従来のまま。

## 参照

- VueのSSRとhydrateは[Astro公式Vue integration](https://docs.astro.build/en/guides/integrations-guide/vue/)を使用する。
- Oxのテーマは[公式カスタムテーマAPI](https://ox-content.dev/theming/)と公開パッケージの型定義を参照する。
- 前段の[Nuxtを残すOx移行パイロット](../nuxt-pilot/REPORT.md)。

## Vueコンパイラの比較（Vize）

`HUB_VUE_COMPILER=vize` で実験ビルドだけをVize 0.607.0に切り替える。通常の本番ビルドには適用しない。Nuxtは公式 `@vizejs/nuxt` のcompilerと自動import・コンポーネントbridgeを使用し、lint生成は無効。既存 `isCustomElement` 関数はネイティブコンパイラへの転送対象外で標準コンパイラへ戻ってしまうため、パイロット時のみ同等の `customElements: ['model-viewer*']` に置換する。Vite 7にない `parseSync` を参照する追加i18n bridgeは無効にし、既存vue-i18nのグローバル機能を維持する。OxはViteのVueプラグインを置換する。Astroは公式Vue integrationのSSR・island・appEntrypointを残し、コンパイラの `vite:vue` プラグインをVizeに置換する。原稿エンジンは各構成で維持する。

```sh
HUB_VUE_COMPILER=vize pnpm pilot:build baseline
HUB_VUE_COMPILER=vize pnpm pilot:ssg:build ox-ported
HUB_VUE_COMPILER=vize pnpm pilot:ssg:build astro
HUB_VUE_COMPILER=vize pnpm pilot:ssg:build astro-ox
HUB_CONTENT_PILOT=astro-vize pnpm pilot:vrt

# 通常版とVize版の全8条件を各3回。既存の過去結果は上書きしない。
pnpm pilot:ssg:measure-compilers
# 生成済み8条件を元のNuxt基準画像に対して確認。
pnpm pilot:ssg:verify-compilers
```

Vize版の出力先は `.pilot/<mode>-vize/`。計測は順番を交互・巡回させて直列実行し、全24回を `results/compiler-timings.json` に保存する。VRT集計は `results/compiler-vrt.json`。通常版も今回再計測するので、過去の数値を使った比較ではない。

各Vizeビルドでネイティブプラグインが登録されていることを検査する。移植3案ではVizeの仮想JSモジュールにNuxt境界の自動importを注入する。Vizeのコンパイル前一括スキャンは `scanPatterns: []` とし、既存Vueプラグインと同様に到達したコンポーネントをコンパイルする。クライアント・SSRともVizeを使用し、元コンパイラへのフォールバックは行わない。

Vize 0.607.0では移植版に2点の入力互換修正が必要だった。`vize-compat.mjs` が元原稿から実験用コピーを毎回生成し、ヘッダーのスロット内 `template v-else` をインラインspanへ変更する（SSRのFragmentマーカー不一致を回避）。またレイアウトの `@screen lg` を同じ1024pxの `@media` に展開してからVizeへ渡す（後段のUnoCSS展開でスコープが落ち、CSS優先度が変わる問題を回避）。元の本番コンポーネントは変更しない。生成コピー・追加処理も計測に含める。Nuxt版でも同じコピーを使う。パイロットモジュールをVizeモジュールより先に登録し、Vizeのコンポーネント解決へコピーのパスを渡す。AstroはNuxt由来tsconfigのパス設定が先に解決されるため、移植版の参照は実験専用モジュールIDで明示する。

- [Vize公式Viteプラグイン](https://vizejs.dev/guide/vite-plugin/index.html)
- [Vize公式Nuxtモジュール](https://vizejs.dev/integrations/nuxt/index.html)

NuxtのVize版ではさらに、リンク先の先読みで読み込まれたホームページCSSが文書のダークモードへ漏れる問題があった。`vize-nuxt-styles.mjs` がホーム2コンポーネントのscoped style内のネストした `:global(html.dark)` を、同じ子要素へスコープが付く `html.dark` のネスト表現へ置換する。CSS Modulesのブロックと本番ソースは変更しない。先読みを止めたり基準画像を変更したりせず、CSS規則自体の互換性を修正する。

`measure-compilers --nuxt-only` は、Nuxtだけに追加修正があった場合、直前の未変更の移植3案18サンプルを保持し、通常NuxtとVize Nuxtを各3回再計測する。元の移植版測定時刻を `preservedPortsFrom`、Nuxt再計測開始を `nuxtRemeasuredAt` に記録する。全8条件を新規計測する場合はオプションを付けない。

## 公開URL数

現在のソースによるページ本体は **1,758 URL**、言語選択・自動転送用を含めると **1,991 URL**。内訳と数え方は[公開URL集計](../PUBLIC_URL_COUNT.md)、列挙したURLは[JSON](../results/public-url-count.json)を参照する。

```sh
node experiments/ssg/tooling/count-public-urls.mjs
```

## Vize差し替え時の問題

不具合候補・設定上の制約・プロジェクト固有の連携問題を[独立レポート](../VIZE_ISSUES.md)にまとめた。Vize 0.607.0でのSSR・CSS出力差とVite 7のi18n helper import失敗は、次の診断用スクリプトで再現できる。

```sh
node experiments/ssg/tooling/repros/vize-issues.mjs
```

[実出力のJSON](../results/vize-issue-repros.json)を保存する。アプリのソースやVRT基準画像は変更しない。


## Ox単独SSGのprofiling

Vizeなし・全1,991 URLの工程計測とCPU解析は[PROFILING_REPORT.md](../PROFILING_REPORT.md)。

```sh
pnpm pilot:full:profile:ox
# Node main threadのCPUサンプルも採取
HUB_SSG_CPU_PROFILE=1 pnpm pilot:full:profile:ox
# 実際の非同期SSR失敗が検出されることを確認（通信は発生しない）
HUB_PILOT_PAGES=all HUB_VUE_COMPILER=vue node experiments/ssg/tooling/repros/ssr-async-error.mjs
```

工程JSONは`.pilot/full/ox-ported/profile-worker.json`、CPUデータは`.pilot/full/ox-ported/cpu-profile/ssg.cpuprofile`へ保存する。プロファイル用のフラグがなければ工程記録は無効。外部APIへ接続可能な環境が必要。
