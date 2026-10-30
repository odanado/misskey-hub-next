# SSG高速化の比較実験

Misskey HubのSSGを高速化するため、既存のNuxt版を基準に3方針を比較する。本番移行は後続で行う。実験モジュールは環境変数で有効にし、既存の原稿・本番ページ・デプロイフローを保つ。

まず[全件ベンチマーク](FULL_SSG_REPORT.md)と[profiling](PROFILING_REPORT.md)を読み、各方針の入口から実装を辿れる。過去の計測値・JSONは移動後のコードで計り直した値ではない。

## 3方針とコードの境界

| 方針 | 入口 | 原稿処理 | HTML描画・生成 |
| --- | --- | --- | --- |
| Ox単独SSG＋Vue | [ox-standalone/](ox-standalone/README.md) | Ox N-API＋MDC互換 | 自前のVue SSR → Ox Built-in SSGの独自テーマ |
| Astro＋既存MDC | [astro-mdc/](astro-mdc/README.md) | 既存MDC / Shiki | Astro公式Vue integration＋Astro SSG |
| Astro＋Ox | [astro-ox/](astro-ox/README.md) | Ox N-API＋MDC互換 | Astro公式Vue integration＋Astro SSG |

```text
experiments/ssg/
├── ox-standalone/   # Ox固有: Viteクライアント、Vue SSR、HTML外枠、Ox SSG
├── astro-mdc/       # MDCを選ぶAstro設定・ページ入口
├── astro-ox/        # Oxを選ぶAstro設定・ページ入口
├── nuxt-compat/     # 3案共通: Nuxt API・ページ・レイアウト・CSSの互換ラッパー
├── shared/          # 原稿処理、対象URL、ナビ生成、Astro共通設定/Document
├── tooling/         # build起動、計測、VRT補助、profiling、問題再現
├── nuxt-pilot/      # Nuxt基準＋初期query/native案・標準テーマ案
├── docs/            # 初期4ページの詳しい再現手順
└── results/         # 計測時点の記録（書き換えず保持）
```

[shared/strategies.mjs](shared/strategies.mjs)で方針・ディレクトリ・原稿エンジンを一覧化している。記録との対応のため、内部mode名は`ox-ported` / `astro` / `astro-ox`を維持した。

### Nuxt互換レイヤー

[nuxt-compat/](nuxt-compat/README.md)に3方針で共有するNuxtのラッパーを集約した。Nuxtフレームワークは起動せず、元のVueコンポーネントから呼ばれるcomposable、auto-import、i18n、ルート、ContentRenderer等を提供する。Nuxt公式Layersの`extends`設定を利用したものではない。

原稿のパーサーは[shared/content/](shared/content/README.md)、Astro共通設定・HTML文書は[shared/astro/](shared/astro/)へ置く。Oxの描画後のHTML保存処理は`ox-standalone/`、Astro側のルート列挙は各Astroディレクトリが所有する。方針間で同じVueページをコピーして管理しない。

## 現時点の結果と限界

全公開URL一覧は**1,991件**（docs 1,365 / blog 106 / static 287 / language entry 233）。Markdown1,434件＋YAML156件を読む。

| 方針 | 通常Vue | Vize 0.607.0 |
| --- | ---: | ---: |
| Nuxt基準 | 236.77秒 | 219.90秒 |
| Ox単独＋Vue | 36.22秒 | 31.85秒 |
| Astro＋MDC | 49.71秒 | 51.43秒 |
| Astro＋Ox | 50.70秒 | 46.45秒 |

各1回・別ランの目安。Nuxt＋Vizeは互換修正後の再計測で、通常Vueにはディスク整理のI/Oも含む。全件の表示・操作は未完成で、HTML1,991件の出力だけで本番移行可能とは判定しない。

**SSR判定の訂正:** 過去の「SSR例外0」はログに出た例外の集計だった。非同期setupの失敗がVue内部で吸収されるケースを後で確認した。Ox通常VueのSSR入口に明示的な捕捉を追加し、profilingではAPIのHTTP 200と1,991ページのSSR完走、失敗注入時の検出を確認した。他7構成はその検出方式で再検証していない。

| 対象 | 状態 |
| --- | --- |
| 初期4ページのVRT | 整理後も通常Vue/Vize 8構成・128テストが成功、160画像がRGBA一致（[再検証記録](results/refactor/vrt.json)） |
| 30ページのVRT | 途中で中断。未完了の画像約91MBはローカル保持し、このPRには含めない |
| 全1,991 URL | 全件HTML生成の試作・速度計測。全件VRTは未実施 |
| Ox通常Vueのprofiling | 33.29秒。Vue SSR 10.57秒、client build 6.38秒、Rust本文変換API 0.118秒 |

### ディレクトリ整理後の確認

3案×通常Vue/Vizeの[6ビルド](results/refactor/builds.json)と、3案の通常Vueによる[全1,991 URLの出力](results/refactor/full-builds.json)を再確認した。この確認の所要時間は、上表のベンチマークを置き換える値ではない。

VRTは既存の基準画像を更新せず、許容差・マスクなしで実行した。外部通信を止めた環境でも全構成が同じ条件になるよう、絵文字プロバイダーには共通の空キャッシュを与える。Playwrightのテスト探索が全件ビルド用の非同期処理を読み込まないよう、4/30ページの定義を`shared/pilot-pages.mjs`へ分離した。

過去の数値記録22 JSONは[バイト単位で変更なし](results/refactor/history-preservation.json)。30ページのVRTは再開していない。

## 実行方法

コマンドはリポジトリのルートで実行する。通常のコード整理確認は既定の4ページ、全件は`HUB_PILOT_PAGES=all`を指定する。

```sh
# 方針ごとの入口
pnpm pilot:ox:build
pnpm pilot:astro-mdc:build
pnpm pilot:astro-ox:build

# 全件生成（例）
HUB_PILOT_PAGES=all pnpm pilot:ox:build
HUB_PILOT_PAGES=all pnpm pilot:astro-mdc:build
HUB_PILOT_PAGES=all pnpm pilot:astro-ox:build

# Vueコンパイラの切り替え
HUB_VUE_COMPILER=vize pnpm pilot:ox:build

# Nuxt基準 / 初期クエリ置換案
pnpm pilot:build baseline
pnpm pilot:build query
pnpm pilot:build native

# 全件計測（通常Vue / Vize別に保存）
pnpm pilot:full:measure --runs=1
pnpm pilot:full:measure --vize-only --runs=1

# Ox通常Vueの工程計測 / Node CPUサンプル
pnpm pilot:full:profile:ox
HUB_SSG_CPU_PROFILE=1 pnpm pilot:full:profile:ox

# 初期4ページのVRT（元Nuxtの基準画像を利用）
HUB_CONTENT_PILOT=ox-ported pnpm pilot:vrt
```

VRT画像の更新は`HUB_CONTENT_PILOT=baseline`だけ許可する。30ページのVRTを再開する際は、元Nuxtで基準画像を再生成してから行う。中断中の基準や古いfingerprintで最新ソースの一致を主張しない。

生成HTML・ビルドログ・CPU生データは`.pilot/`へ出力する。過去の結果JSONに含まれる旧ソースパス、timestamp、fingerprint、ログパスは計測時点の情報として保持する。rawログや中断中の画像にはローカルのみのものがあり、公開する証拠は各レポートとJSONを参照する。

## 調査資料

- [全件SSG・Vize比較・SSR判定の訂正](FULL_SSG_REPORT.md)
- [Ox単独SSGのprofiling](PROFILING_REPORT.md)
- [Vize連携の問題と回避策](VIZE_ISSUES.md)
- [公開URL数の根拠](PUBLIC_URL_COUNT.md)
- [初期4ページの構成比較](REPORT.md) / [Vize比較](VIZE_REPORT.md)
- [初期4ページの再現手順](docs/pilot-4-pages.md)
- [Nuxt内の初期query/native案](nuxt-pilot/README.md)

相談したい論点は、SSG基盤の保守負担、MDC互換の維持範囲、クライアント機能と全件VRTの進め方、性能改善を続ける優先箇所。今回のdraftは比較用コードと現状の結果をレビューするためのもの。
