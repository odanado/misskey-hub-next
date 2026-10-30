# SSG高速化の比較実験

Misskey HubのSSGを高速化するため、既存のNuxt版を基準に、従来の3方針と追加のOx nativeを比較する。本番移行は後続で行う。実験モジュールは環境変数で有効にし、既存の原稿・本番ページ・デプロイフローを保つ。

まず[全件ベンチマーク](FULL_SSG_REPORT.md)と[profiling](PROFILING_REPORT.md)を読み、各方針の入口から実装を辿れる。過去の計測JSONを保持し、最新の再計測と全件VRTは下表に分けて示す。

## 方針とコードの境界

| 方針 | 入口 | 原稿処理 | HTML描画・生成 |
| --- | --- | --- | --- |
| Ox単独SSG＋Vue | [ox-standalone/](ox-standalone/README.md) | Ox N-API＋MDC互換 | 自前のVue SSR → Ox Built-in SSGの独自テーマ |
| Astro＋既存MDC | [astro-mdc/](astro-mdc/README.md) | 既存MDC / Shiki | Astro公式Vue integration＋Astro SSG |
| Astro＋Ox | [astro-ox/](astro-ox/README.md) | Ox N-API＋MDC互換 | Astro公式Vue integration＋Astro SSG |
| Ox native（追加） | [ox-native/](ox-native/README.md) | 公式Ox Vueプラグイン＋MDC互換 | Vue SSR＋Custom HostによるVite SSG |

```text
experiments/ssg/
├── ox-standalone/   # Ox固有: Viteクライアント、Vue SSR、HTML外枠、Ox SSG
├── astro-mdc/       # MDCを選ぶAstro設定・ページ入口
├── astro-ox/        # Oxを選ぶAstro設定・ページ入口
├── ox-native/       # 公式Ox Vueプラグイン＋Custom Host、既存表示の互換処理
├── nuxt-compat/     # 共通: Nuxt API・ページ・レイアウト・CSSの互換ラッパー
├── shared/          # 原稿処理、対象URL、ナビ生成、Astro共通設定/Document
├── tooling/         # build起動、計測、VRT補助、profiling、問題再現
├── nuxt-pilot/      # Nuxt基準＋初期query/native案・標準テーマ案
├── docs/            # 初期4ページの詳しい再現手順
└── results/         # 計測・検証記録（過去ベンチマークを保持）
```

[shared/strategies.mjs](shared/strategies.mjs)で方針・ディレクトリ・原稿エンジンを一覧化している。記録との対応のため、内部mode名は`ox-ported` / `astro` / `astro-ox`を維持した。

### Nuxt互換レイヤー

[nuxt-compat/](nuxt-compat/README.md)に各方針で共有するNuxtのラッパーを集約した。Nuxtフレームワークは起動せず、元のVueコンポーネントから呼ばれるcomposable、auto-import、i18n、ルート、ContentRenderer等を提供する。Nuxt公式Layersの`extends`設定を利用したものではない。

原稿のパーサーは[shared/content/](shared/content/README.md)、Astro共通設定・HTML文書は[shared/astro/](shared/astro/)へ置く。Oxの描画後のHTML保存処理は`ox-standalone/`、Astro側のルート列挙は各Astroディレクトリが所有する。方針間で同じVueページをコピーして管理しない。

## PR #1 / #2のOx native速度差の調査

同じ診断方法の各3回で、#1全件版53.50秒、同じ1,342 Markdown URLへの限定版52.45秒、Markdownのクライアント生成省略版36.17秒、#2最小テーマ4.43秒だった。主因は大量のクライアントモジュール、本文の重複変換とMDCノードのSSR。省略版は機能を減らす診断であり、表示互換の移行案ではない。[工程別の根拠・改善候補](NATIVE_COMPARISON_REPORT.md)。前回の起動込みベンチとは計測境界が異なる。

## PR #2単体の無改変計測

PR #2の最小テーマは、このM1 Pro / Node22環境で1,343ページを**中央値5.37秒（5回）**で生成・検証できた。下記55.65秒の互換実装とは対象と機能が異なる。[単体計測の条件と結果](PR2_STANDALONE_REPORT.md)。

後続の[30ページVRT確認](PR2_VRT_REPORT.md)では、PC/モバイル×明暗の通常表示**0/120画像一致**、追加の詳細展開・メニュー等**24状態は取得不可**だった。既存Nuxt基準264ファイルとPR #2の元ソースは不変。

## 追加：Ox nativeの互換検証と同条件比較（Ox 3.4.3）

| 構成 | 1回目 | 2回目 | 3回目 | 中央値 | 30ページVRT |
| --- | ---: | ---: | ---: | ---: | ---: |
| Ox native（公式Vueプラグイン＋Custom Host） | 55.65秒 | 54.48秒 | 56.00秒 | **55.65秒** | 120/120・144画像一致 |
| 既存Ox単独（N-API＋Vue SSR＋Ox SSG） | 34.31秒 | 35.52秒 | 35.63秒 | **35.52秒** | 120/120・144画像一致 |

全1,991 URLのSSGが両案とも各3回成功。Node22.22.2 / M1 Pro、通常Vue、同じOx 3.4.3で順次計測した。Ox nativeは今回の互換実装では約56.7%長くかかった。30ページは両案とも120テスト・144画像が元Nuxtと一致。新しい全件VRTは実行していない。条件・限界・PR #2との差は[Ox nativeレポート](OX_NATIVE_REPORT.md)を参照。

## 現時点の結果と限界

追加の[Ox native検証](OX_NATIVE_REPORT.md)は、PR #2方式の公式プラグイン構成へ表示互換を接続したもの。Ox 3.4.3で30ページの120テスト・144画像の合格後、全件SSGを計測済み。従来の8構成の表はOx 3.4.0時点の記録として保持し、条件の違う数値を混ぜない。

全公開URL一覧は**1,991件**（docs 1,365 / blog 106 / static 287 / language entry 233）。Markdown1,434件＋YAML156件を読む。

| 構成 | 通常Vue SSG | 通常Vue VRT | Vize SSG | Vize VRT |
| --- | ---: | ---: | ---: | ---: |
| Nuxt基準 | 210.90秒 | 1,948/1,991 (97.84%) | 216.52秒 | 1,903/1,991 (95.58%) |
| Ox単独＋Vue | 33.73秒 | 1,202/1,991 (60.37%) | 31.99秒 | 1,207/1,991 (60.62%) |
| Astro＋MDC | 49.94秒 | 1,348/1,991 (67.70%) | 48.99秒 | 1,345/1,991 (67.55%) |
| Astro＋Ox | 46.14秒 | 1,203/1,991 (60.42%) | 44.43秒 | 1,203/1,991 (60.42%) |

互換修正後に8構成を各1回・同じコードで順次再計測した値。VRTは全公開1,991 URLのPC・ライト1条件（合格率の分母も1,991）。全件の表示・操作は移植途中で、同等機能での本番の高速化率や、移行の完了を示す値ではない。

元Nuxt側の基準不成立43 URLも分母に残す。Nuxt基準行は安定した比較画像を取得できた割合。[全件VRT](FULL_VRT_REPORT.md)に比較可能URL内の率と不合格内訳を記載した。30ページLinux CIには4ケースの差分が残る。

**SSR判定の訂正:** 過去の「SSR例外0」はログに出た例外の集計だった。非同期setupの失敗がVue内部で吸収されるケースを後で確認した。Ox通常VueのSSR入口に明示的な捕捉を追加し、profilingではAPIのHTTP 200と1,991ページのSSR完走、失敗注入時の検出を確認した。他7構成はその検出方式で再検証していない。

| 対象 | 状態 |
| --- | --- |
| 初期4ページのVRT | 整理後も通常Vue/Vize 8構成・128テストが成功、160画像がRGBA一致（[再検証記録](results/refactor/vrt.json)） |
| 30ページのVRT | [Macで8構成・960テスト成功、1,152画像がRGBA一致](VRT_30_REPORT.md)。画像はPRに含めない |
| 全1,991 URL | [SSG再計測＋PC・ライトVRT完了](FULL_VRT_REPORT.md)。合格率は上表 |
| Ox通常Vueのprofiling | 33.29秒。Vue SSR 10.57秒、client build 6.38秒、Rust本文変換API 0.118秒 |

### ディレクトリ整理後の確認

3案×通常Vue/Vizeの[6ビルド](results/refactor/builds.json)と、3案の通常Vueによる[全1,991 URLの出力](results/refactor/full-builds.json)を再確認した。この確認の所要時間は、上表のベンチマークを置き換える値ではない。

VRTは既存の基準画像を更新せず、許容差・マスクなしで実行した。外部通信を止めた環境でも全構成が同じ条件になるよう、絵文字プロバイダーには共通の空キャッシュを与える。Playwrightのテスト探索が全件ビルド用の非同期処理を読み込まないよう、4/30ページの定義を`shared/pilot-pages.mjs`へ分離した。

整理時には過去22 JSONの[バイト単位の保存](results/refactor/history-preservation.json)を確認した。その後、30ページのVRTを再開し、基準画像のハッシュを保って互換修正を完了した。

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

# 互換修正後の8構成再計測 → 同じ生成物で全URLのPC・ライトVRT
pnpm pilot:full:measure --with-vize --runs=1 --output-dir=experiments/ssg/results/full/2026-10-30
pnpm pilot:full:vrt --output-dir=experiments/ssg/results/full/2026-10-30
# 中断時は同じコード・生成物・URL集合でのみ再開可能
pnpm pilot:full:vrt --output-dir=experiments/ssg/results/full/2026-10-30 --resume

# Ox通常Vueの工程計測 / Node CPUサンプル
pnpm pilot:full:profile:ox
HUB_SSG_CPU_PROFILE=1 pnpm pilot:full:profile:ox

# 初期4ページのVRT（元Nuxtの基準画像を利用）
HUB_CONTENT_PILOT=ox-ported pnpm pilot:vrt
```

VRT画像の更新は`HUB_CONTENT_PILOT=baseline`だけ許可する。30ページは`pnpm pilot:30:baseline` → `pnpm pilot:30:build` → `pnpm pilot:30:verify`の順に実行する。基準のハッシュと実装fingerprintを結果に保存する。

生成HTML・ビルドログ・CPU生データは`.pilot/`へ出力する。過去の結果JSONに含まれる旧ソースパス、timestamp、fingerprint、ログパスは計測時点の情報として保持する。rawログや中断中の画像にはローカルのみのものがあり、公開する証拠は各レポートとJSONを参照する。

## 調査資料

- [Ox nativeの30ページVRT・全件SSG・PR #2との関係](OX_NATIVE_REPORT.md)
- [全件SSG・Vize比較・SSR判定の訂正](FULL_SSG_REPORT.md)
- [全公開1,991 URLのVRT・合格率・不合格内訳](FULL_VRT_REPORT.md)
- [30ページVRTの互換修正と合格率](VRT_30_REPORT.md)
- [Ox単独SSGのprofiling](PROFILING_REPORT.md)
- [Vize連携の問題と回避策](VIZE_ISSUES.md)
- [公開URL数の根拠](PUBLIC_URL_COUNT.md)
- [初期4ページの構成比較](REPORT.md) / [Vize比較](VIZE_REPORT.md)
- [初期4ページの再現手順](docs/pilot-4-pages.md)
- [Nuxt内の初期query/native案](nuxt-pilot/README.md)

相談したい論点は、SSG基盤の保守負担、MDC互換の維持範囲、クライアント機能と全件VRTの進め方、性能改善を続ける優先箇所。今回のdraftは比較用コードと現状の結果をレビューするためのもの。
