# Ox Content＋Vue islandsへの本番SSG移行

forkの既定ブランチ`master`を親リポジトリの`ba74668080484d92da0d372e58a53373e9064c27`へ同期し、そのコミットから本番移行を作成した。[PR #3](https://github.com/odanado/misskey-hub-next/pull/3)は、この方式の実装とmasterとのVRTだけを含む。

## 生成方式

`ox-native-islands`を本番のビルドへ移植した。Ox Content 3.4.3の公式Vite Plugin / Custom Hostがルート・Markdown・HTML出力を所有する。通常のMarkdown本文は静的HTMLにし、既存のVue部品・固定ページ・操作UIを補助的に使う。ViteがクライアントJS/CSSを生成し、`pnpm build` / `pnpm generate`の出力は`.output/public/`になる。

- Markdown 1,440件、YAML 156件を処理し、公開2,003 URLを生成する。内訳はdocs 1,365、ブログ112、固定287、言語エントリー239。404フォールバックは別途生成する。
- Markdown 1,402件はOxで解析する。元MDCと構造・属性が異なる旧記法38件は`ssg/mdc-compatibility.mjs`で明示し、既存MDCで解析する。生成処理は共通のOx Hostを使う。
- MDC部品、Shiki/AiScript、ナビゲーション、既存Vueページ・レイアウトを再利用する。`@nuxt/content` 2.13.4と`@nuxtjs/mdc` 0.9.5はProse・メタデータ等の互換ライブラリとして残る。依存経由でNuxtのpeer packageもインストールされるが、Nuxtアプリビルド・Nitroは起動しない。
- 旧URL転送、public資産、公開API設定、Crowdin生成、既存ホスティングの出力先を維持する。404画面は既存の`error.vue`を再利用する。
- スキーマUIは承認された省略方針を継続し、旧MDCのラッパーと後続本文の構造を保つ。

## Full SSG

測定日: 2026-10-31（JST）。`Apple M1 Pro`、`darwin-arm64`、Node.js `v22.22.2`、pnpm 10.27.0。

| 構成 | 生成対象 | 実測 | 代表値 |
| --- | ---: | --- | ---: |
| Nuxt / master | 2,003 | 212.43秒（1回） | 212.43秒 |
| Ox Content＋Vue islands | 2,003＋404 | 26.10秒 / 25.66秒 / 25.65秒 | 中央値 **25.66秒** |

候補は新規PNPMプロセスで順次3回実行し、全回exit 0、全2,003 HTML・404・クライアントmanifestを検証した。計測範囲は起動からCrowdin準備、JS/CSS、全生成、publicコピー、旧URL転送の完了まで。出力検証はタイマー外。依存インストールは含めず、OSキャッシュは保持した。VRTや別ビルドとは同時実行していない。

Nuxtは1回の参考値で、比較用の全URL明示生成を使用する。候補には旧URL転送生成も含むため、処理境界が完全に同一の統計的ベンチマークではない。

## GitHub Actions（各1回）

2026-10-31（JST）に、移行版ブランチの`Deploy`を`build_only=true`で手動実行した。`pnpm generate`を1回実行し、**全2,003 HTML・404・クライアントmanifestの検証が成功**した。デプロイ・Cloudflareキャッシュ削除はスキップしている。

| 構成・実行リンク | 生成ステップ | buildジョブ全体 | 依存インストール | 実際のOS / Node | pnpmキャッシュ |
| --- | ---: | ---: | ---: | --- | --- |
| [本家 Nuxt](https://github.com/misskey-dev/misskey-hub-next/actions/runs/40357343784) | **4分45秒** | 5分16秒 | 6秒 | Ubuntu 24.04 / 22.23.3 | ヒット |
| [移行版 Ox Content＋Vue islands](https://github.com/odanado/misskey-hub-next/actions/runs/41185201960) | **44秒** | **1分17秒** | 9秒 | Ubuntu 26.04 / 22.23.4 | ミス |
| [参考: 同forkの移行前Nuxt](https://github.com/odanado/misskey-hub-next/actions/runs/41164948920) | 5分35秒 | 6分05秒 | 10秒 | Ubuntu 26.04 / 22.23.4 | ミス |

GitHubのステップ時刻は秒単位。移行版の生成コマンドを`/usr/bin/time -p`で測った実時間は**44.14秒**だった。CPUは`Intel(R) Xeon(R) Platinum 8370C CPU @ 2.80GHz`（4 vCPU）。本家の生成ステップ285秒に対して、この記録では約84.5%短縮している。

本家の直近成功実行と参考fork実行は、いずれも移行元コミット`ba74668080484d92da0d372e58a53373e9064c27`。移行版は`568cc374544362e58980a1cedd90e03b3731d2bc`。同じ`ubuntu-latest`・Node `22`指定でも、実行日によって実際のOSとNodeのパッチ版が変わっている。本家はNuxtのクロール・API/payload生成等も含み、ログには6,320ルートのprerender完了とある。移行版は公開HTMLを明示生成するため、処理内容・キャッシュ・リポジトリ設定まで固定した比較ではない。

参考forkのNuxtはbuildジョブが成功し、その後のPagesデプロイが失敗している。表はbuildジョブのみの時間で、デプロイを比較に含めていない。

計測方法は通常のDeployに`build_only`入力を追加したもの。既定値は`false`で、従来のデプロイ動作を維持する。`true`なら生成・検証・artifactアップロードまで実行し、デプロイしない。

```sh
gh workflow run deploy.yml --ref codex/ox-native-islands-production -f build_only=true
```

## VRT

比較元は独立worktreeのmaster `ba74668080484d92da0d372e58a53373e9064c27`。候補は実装コミット`56a50491da4fca6e25b02327c3628bc06f281f10`、ソース指紋`1eb77ea15765b609583a2ed1d595e824d893aab92758ae17904ba9dc8c32bf18`。ベンチ・VRTの前後で対象ソースが変わっていないことを検証した。

macOS / Chromium `145.0.7632.6`、1440×900・ライト、`ja-JP` / `Asia/Tokyo`。各URL・各生成物ごとに新しいブラウザーコンテキストを作る。RGBA全画素・寸法の完全一致に加え、JS例外・hydration警告・ローカル404なしを合格条件にする。外部通信を遮断し、絵文字キャッシュ・乱数・時計・アニメーションを固定する。時計は基準生成完了＋30秒、RAFの時刻は30,000msに固定し、最後の2フレームを進める。

16,000pxを超えるページは、スクロールせず同じ文書座標を4,096pxずつ撮影して全画素を照合する。固定ヘッダー等を含む18,000pxの確認用ページで、通常のfull-page撮影と全画素一致を検証した。長いリリース履歴も約1.88億画素の一致を確認した。撮影上限は90秒。マスク・許容差・自動リトライは使わない。

| 確認 | 結果 |
| --- | --- |
| 代表30ページの専用VRT | **30/30**（100.00%） |
| 全公開URLを分母にした一致率 | **1,943/2,003**（**97.00%**） |
| 基準が成立したURLでの一致率 | **1,943/1,965**（**98.88%**） |
| 画像差分 | 22件 |
| 候補側の撮影・実行不成立（比較可能URL内） | 0件 |
| 基準側不成立 | 38件（全URL分母に残す） |

| 種別 | 全URL | 一致 | 画像差分 | 候補不成立 | 基準不成立 |
| --- | ---: | ---: | ---: | ---: | ---: |
| ドキュメント | 1,365 | 1,344 | 5 | 0 | 16 |
| ブログ記事 | 112 | 111 | 0 | 0 | 1 |
| 固定Vueページ | 287 | 253 | 17 | 0 | 17 |
| 言語選択・転送URL | 239 | 235 | 0 | 0 | 4 |

基準不成立でも候補側を撮影した。候補側の撮影状態は、`captured` 1,979件、`runtime-error` 7件、`unstable` 17件。基準不成立を合格に読み替えていない。

全件実行で画像差分となった22 URLを、同じ生成物・同じ画素基準の別実行（2 workers）で個別確認した。結果は一致14件、画像差分8件。主表・合格率は全件実行の一回分を保持し、この補助結果で差し替えていない。

大きめの差が出た`/id/about-us/history/`は、同じ生成物の個別確認で0画素だった。元の全件結果には50,224画素差を残している。

同じmaster生成物を独立した2コンテキストで比較しても、MFMプレイグラウンドに18画素の差が発生した例がある。微小な描画差も全件集計では不合格に含め、残差を一律に描画ノイズと断定しない。アニメーション画像、既存のhydration警告、撮影失敗はURL別に分類する。

<details>
<summary>全件VRTの未合格URL</summary>

| URL | 全件実行の判定 | 画素差・状態 | 個別確認 |
| --- | --- | --- | --- |
| `/` | 基準不成立 | 基準: unstable / 候補: captured | — |
| `/about-us/history/` | 基準不成立 | 基準: unstable / 候補: captured | — |
| `/blog/2024-06-11-mi-card/` | 基準不成立 | 基準: unstable / 候補: unstable | — |
| `/cn/` | 基準不成立 | 基準: unstable / 候補: captured | — |
| `/cn/blog/` | 基準不成立 | 基準: runtime-error / 候補: runtime-error | — |
| `/cn/docs/for-users/features/mfm/` | 基準不成立 | 基準: runtime-error / 候補: runtime-error | — |
| `/cn/docs/mi-card/` | 基準不成立 | 基準: unstable / 候補: unstable | — |
| `/cn/tools/hub-servers-preview/` | 基準不成立 | 基準: runtime-error / 候補: runtime-error | — |
| `/de/` | 基準不成立 | 基準: unstable / 候補: captured | — |
| `/de/docs/mi-card/` | 基準不成立 | 基準: unstable / 候補: unstable | — |
| `/docs/mi-card/` | 基準不成立 | 基準: unstable / 候補: unstable | — |
| `/en/` | 基準不成立 | 基準: unstable / 候補: captured | — |
| `/en/docs/mi-card/` | 基準不成立 | 基準: unstable / 候補: unstable | — |
| `/en/tools/mfm-playground/` | 画像差分 | 18画素 | 18画素 |
| `/es/` | 基準不成立 | 基準: unstable / 候補: captured | — |
| `/es/docs/mi-card/` | 基準不成立 | 基準: unstable / 候補: unstable | — |
| `/es/tools/hub-servers-preview/` | 画像差分 | 28画素 | 一致（0画素） |
| `/es/tools/mfm-playground/` | 画像差分 | 18画素 | 一致（0画素） |
| `/fr/` | 基準不成立 | 基準: unstable / 候補: captured | — |
| `/fr/docs/mi-card/` | 基準不成立 | 基準: unstable / 候補: unstable | — |
| `/fr/tools/hub-servers-preview/` | 画像差分 | 28画素 | 一致（0画素） |
| `/id/` | 基準不成立 | 基準: unstable / 候補: captured | — |
| `/id/about-us/history/` | 画像差分 | 50,224画素 | 一致（0画素） |
| `/id/docs/for-admin/install/resources/forking/` | 画像差分 | 22画素 | 一致（0画素） |
| `/id/docs/mi-card/` | 基準不成立 | 基準: unstable / 候補: unstable | — |
| `/id/tools/hub-servers-preview/` | 画像差分 | 28画素 | 28画素 |
| `/id/tools/mfm-playground/` | 画像差分 | 18画素 | 一致（0画素） |
| `/it/` | 基準不成立 | 基準: unstable / 候補: captured | — |
| `/it/docs/mi-card/` | 基準不成立 | 基準: unstable / 候補: unstable | — |
| `/it/tools/hub-servers-preview/` | 画像差分 | 28画素 | 一致（0画素） |
| `/it/tools/mfm-playground/` | 画像差分 | 18画素 | 18画素 |
| `/ja-ks/` | 基準不成立 | 基準: unstable / 候補: captured | — |
| `/ja-ks/docs/mi-card/` | 基準不成立 | 基準: unstable / 候補: unstable | — |
| `/ja-ks/tools/hub-servers-preview/` | 画像差分 | 28画素 | 一致（0画素） |
| `/ja/` | 基準不成立 | 基準: unstable / 候補: unstable | — |
| `/ja/blog/2024-06-11-mi-card/` | 基準不成立 | 基準: unstable / 候補: unstable | — |
| `/ja/docs/mi-card/` | 基準不成立 | 基準: unstable / 候補: unstable | — |
| `/ja/tools/mfm-playground/` | 画像差分 | 18画素 | 一致（0画素） |
| `/ko/` | 基準不成立 | 基準: unstable / 候補: captured | — |
| `/ko/docs/for-users/features/mfm/` | 基準不成立 | 基準: runtime-error / 候補: runtime-error | — |
| `/ko/docs/mi-card/` | 基準不成立 | 基準: unstable / 候補: unstable | — |
| `/pl/` | 基準不成立 | 基準: unstable / 候補: captured | — |
| `/pl/docs/for-admin/install/resources/nginx/` | 画像差分 | 22画素 | 22画素 |
| `/pl/docs/for-admin/install/resources/troubleshooting/` | 画像差分 | 22画素 | 一致（0画素） |
| `/pl/docs/mi-card/` | 基準不成立 | 基準: unstable / 候補: unstable | — |
| `/pl/tools/hub-servers-preview/` | 画像差分 | 28画素 | 28画素 |
| `/pl/tools/mfm-playground/` | 画像差分 | 18画素 | 一致（0画素） |
| `/th/` | 基準不成立 | 基準: unstable / 候補: captured | — |
| `/th/docs/for-admin/install/resources/` | 画像差分 | 22画素 | 一致（0画素） |
| `/th/docs/for-admin/install/resources/troubleshooting/` | 画像差分 | 22画素 | 一致（0画素） |
| `/th/docs/mi-card/` | 基準不成立 | 基準: unstable / 候補: unstable | — |
| `/th/tools/hub-servers-preview/` | 画像差分 | 28画素 | 28画素 |
| `/th/tools/mfm-playground/` | 画像差分 | 18画素 | 18画素 |
| `/tw/` | 基準不成立 | 基準: unstable / 候補: captured | — |
| `/tw/blog/` | 基準不成立 | 基準: runtime-error / 候補: runtime-error | — |
| `/tw/docs/for-users/features/mfm/` | 基準不成立 | 基準: runtime-error / 候補: runtime-error | — |
| `/tw/docs/mi-card/` | 基準不成立 | 基準: unstable / 候補: unstable | — |
| `/tw/tools/hub-servers-preview/` | 基準不成立 | 基準: runtime-error / 候補: runtime-error | — |
| `/tw/tools/identicon-generator/` | 画像差分 | 10画素 | 一致（0画素） |
| `/tw/tools/mfm-playground/` | 画像差分 | 18画素 | 18画素 |

</details>

## 回帰チェックと範囲

`pnpm test`の18テストが成功した。全Markdown 1,440件を元MDCパーサーと照合し、本文の文字列・要素構造、リンク先、画像属性、見出しID等を確認した。Vueの文法読込順・独自routeブロックの色、分割画像の最終画素の差を検出するテストも含む。SSRの404成果物はブラウザーで文言とクライアント起動を確認した（基準側に同じ404成果物がないため全件画像比較とは別）。

VRTは初期表示をPC・ライトの1条件で確認した結果であり、全フォーム操作、全ブラウザー、外部サービスの実通信、全テーマ・全幅を網羅したものではない。全件VRTには画像差分22件・基準不成立38件が残る。マージ前のレビューでは、上表と個別確認の結果を確認対象にする。

## 再現

```sh
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
VRT_BASELINE_REF=ba74668080484d92da0d372e58a53373e9064c27 pnpm test:vrt:baseline
pnpm test
pnpm benchmark
pnpm test:vrt --sample=30 --workers=4 --output-dir=.vrt/representative-final
pnpm test:vrt --workers=6 --output-dir=.vrt/full-verified
```

基準clone、生成物、完全なURL別JSONL、PNG、ログはGit管理外の`.vrt/`に保存する。差分画像は実行ディレクトリごとに分離し、長大ページの部分画像には`tile.json`で元座標を記録する。SSG・VRT結果の完全なローカル集約は`.vrt/production-summary.json`。

## クレジット

[ubugeeei氏のPR #2](https://github.com/odanado/misskey-hub-next/pull/2)のOx Custom Host方式を基にした。派生実装の各コミットに`Co-authored-by: ubugeeei <ubuge1122@gmail.com>`を付与している。他方式の実験コード・Vize・画像・生成物はこのPRに含めない。
