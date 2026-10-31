# Nuxt Content／MDC依存をOx Markdown/MDXへ置換

> この文書の計測・VRTはOx Content 3.4.3時点の記録です。3.5.2への更新後の速度計測は[別レポート](ox-content-3.5.2-benchmark.md)を参照してください。

ベースは[PR #3](https://github.com/odanado/misskey-hub-next/pull/3)の`c0aa1d20e1c2225f8c792996c4d5215477d04881`。Nuxt ContentとMDCをライブラリとして残していた部分を置き換える、本番移行への追加PR。Vizeや他のSSG方式は含めない。

## 置換した処理

| #3に残っていた責務 | 今回の実装 |
| --- | --- |
| Markdownの通常本文 | Ox Vite Plugin / Custom Hostの`host.markdown.render()`を継続 |
| MDCコンポーネントの断片 | 旧記法をMDXへ変換し、Ox N-APIの`transform({mdx:true})`で解析 |
| 38件の全文MDCフォールバック | 廃止。全1,440 MarkdownをOxで解析 |
| YAML内のMarkdown 201文字列 | 同じOxパイプラインで事前解析し、ローカルのVue描画器で表示 |
| MDCのProse Vue部品、コード表示CSS | 必要なHTML/CSSを`ssg/prose/`へローカル化 |
| パス・メタデータ・目次・文書ツリー変換 | 小さなローカル実装へ移植 |
| Shikiの色・AiScript・Vue文法の順序 | 既存のテーマ・文法・トークン構造を直接Shikiで維持 |
| `@nuxt/content`の型 | `ssg/types.ts`へサイトのデータ型を定義 |

`@nuxt/content`、`@nuxtjs/mdc`、Nuxt本体、`remark-mdc`はpackage／lockfile／依存ツリーからなくした。不要になった`ssg/mdc.mjs`、38件のフォールバック一覧、旧remark用のmarkdown-fixerも削除した。Vueに残る`MDC`という名前は、既存呼び出し元向けの`MarkdownRenderer.vue`へのエイリアスであり、旧パーサーは読み込まない。移植したMITコードの出典とライセンスは`ssg/prose/NOTICE.md`と`LICENSE`に保持する。

## Oxのコンポーネント機能をどう使うか

[OxのネイティブMDX](https://ox-content.dev/mdx/)が、PascalCaseのコンポーネント、ネスト、子のMarkdown、JSONリテラルpropsを解析する。Oxが出す`data-ox-island`とJSON propsをサイトの文書ツリーへ接続し、既存Vue部品で描画する。通常本文全体をVueへ渡す構成には変更しない。JS/CSSは引き続きVite、ルート・HTML出力はOx Custom Hostが所有する。

既存原稿の`:::tip`、属性の短縮記法、名前付きスロット等だけを`component-syntax.mjs`で変換する。MDCパーサーを同梱する方式ではなく、Markdownとコンポーネントの入れ子の解析はOxに任せる。新しい原稿では`<Tip>…</Tip>`、`<MfmPreview text="**Hello**" />`と記述できる。動的なJavaScript式・spreadを暗黙に捨てず、ビルドエラーにする。クライアント処理は既存のVue islandsに置く。

難しかったのはコンポーネントの存在自体より、旧記法の解釈と見た目の互換だった。特に次を処理した。

- 改行とバックスラッシュを含むMFM文字列、Vue形式の属性、コンポーネント内のMarkdown、スロット、暗黙のEOF閉じ。
- コードのファイル名・行強調・タブ幅・色・Shikiの文法読み込み順序。
- 日本語等を含む見出しID・目次、脚注、メールの自動リンク、属性付きspan、通常文章の`{}`。
- 曖昧な画像alt、未閉じHTML、リストの境界等。一部原稿の記法だけを明示化し、既存の本文・アクセシブル名・リンク先・下線等の表示を維持した。訳文の再編集や既存リンク先の修正は行っていない。

全件VRTの初期確認では、YAMLを描くローカルVueアダプターが`tip`／`warning`を通常タグとして扱う問題も検出した。静的本文とVue描画でコンポーネント名の対応表を共通化して修正した。

`MkSchemaViewer`は合意済みの空のUIを維持する。旧ラッパーと後続本文の流れは保つ。

## 検証

`pnpm install --frozen-lockfile`成功。旧パーサーをインストールしていない状態で`pnpm test`の25テストが成功した。

比較用スナップショットは独立した#3のcheckoutと旧パーサーから採取した。期待値を新実装から生成した自己比較ではなく、ビルドがスナップショットに依存することもない。

| 確認対象 | 結果 |
| --- | ---: |
| Markdownの本文構造・テキスト・リンク／画像属性 | 1,440 / 1,440 |
| タイトル・説明・URL・目次 | 1,440 / 1,440 |
| コンポーネントprops（空のスキーマUIを除く） | 1,440 / 1,440 |
| YAML内のMarkdownの構造・テキスト・リンク／画像属性 | 201 / 201 |
| 既存記法、Ox MDXのネスト・型付きprops・不支持式の検出、コード色、PNG比較 | 成功 |

正規化比較では空白をまとめ、hoistしたstyle要素を除く。空白・CSS・実際の表示はVRTで別に確認する。以後の編集で原稿のSHAが変わった場合は歴史的スナップショットの対象外として件数を報告する。今回の移行時点では変更後原稿を含め全1,440件を比較している。

## Full SSG

測定日: 2026-10-31（JST）。Apple M1 Pro、macOS / arm64、Node.js 22.22.2、pnpm 10.27.0。Markdown 1,440＋YAML 156、公開2,003 URL＋404、固定Vueページ、クライアントJS/CSS、public資産、旧URL転送を含む。

| 構成 | 全生成時間 | 代表値 |
| --- | --- | ---: |
| #3（同日の既存記録） | 26.10 / 25.66 / 25.65秒 | 中央値 **25.66秒** |
| #3（今回のVRT比較元の再生成） | 27.03秒（1回） | 参考値27.03秒 |
| Nuxt Content／MDC依存削除後・最終版 | 23.33秒 / 21.94秒 / 22.10秒 | 中央値 **22.10秒** |

最終版は3回ともexit 0、全2,003 HTML・404・client manifestを検証した。中央値同士では約13.9%短縮。今回の#3再生成は1回の参考値として区別する。Actionsでの再計測は行っていない。

依存インストールと出力検証は時間に含めず、OSキャッシュを保持する。新規PNPMプロセスで3回順次実行し、VRTや他ビルドとの同時実行はしない。Crowdin準備は通常ビルドの一部として実行する（API未設定時は既存の空データ生成）。

## VRT

比較元は独立checkoutの#3（上記コミット）。masterとの比較値は[従来レポート](ssg-migration.md)に区別して残す。今回の表は依存削除が#3へ追加する差分を測るもの。

macOS / Chromium 145.0.7632.6、1440×900・ライト、ja-JP / Asia/Tokyo。新しいコンテキストで全RGBA画素・寸法の完全一致、JS例外・hydration警告・ローカル404なしを条件にする。マスク・許容差は使わない。外部通信・乱数・時計・アニメーション・長大ページの分割撮影は既存VRTと同じ条件。

| 確認 | 一致 | 率 |
| --- | ---: | ---: |
| 全件一括実行（最後の空白・絵文字修正前、6 workers） | 1,953 / 2,003 | 97.50% |
| 上記で比較元が成立したURL | 1,953 / 1,980 | 98.64% |
| 最終生成物への対応付け（不変1,997 URLの結果＋変更6 URLの再撮影） | **1,957 / 2,003** | **97.70%** |
| 最終版の代表30ページ | **30 / 30** | **100%** |
| HTMLが変わった全6ページ | **6 / 6** | **100%** |
| 最終版の補助62ページ（2 workers） | 56 / 62 | 90.32% |

一括実行では画像差分27件、比較元不成立23件（unstable 16、hydration警告7）、比較可能URLで候補だけが実行不成立となるケースは0件。比較元不成立の23件は候補でも同じ分類だった。

一括実行後、旧span記法の末尾空白と、Custom Host側の絵文字ショートコード設定を修正した。全2,003 URLについて、表示テキスト（通常空白を正規化）とコード本文（空白を保持）を再照合し、#3との差が0件になった。

最終修正の前後で生成物3,806ファイルをSHA-256比較し、変化したのは次の6 HTMLだけだった。残り3,800ファイル、全JS/CSS、他の1,997公開URLのHTMLはバイト一致。変更6 URLをすべて再撮影し、全画素一致を確認した。表の最終生成物の行は全件をもう一度一括実行した値ではなく、この出力同一性と6 URLの再撮影を合わせた検証結果。未変更URLの再確認で改善した結果を使って全件の率を上書きしていない。

- `/de/docs/for-users/features/share-form/`
- `/id/docs/for-users/features/share-form/`
- `/ko/docs/for-users/features/share-form/`
- `/ko/docs/releases/`
- `/tw/docs/for-users/features/share-form/`
- `/tw/docs/releases/`

補助62ページは代表30、YAMLのガイド・履歴・トップ、全件で差分となった27 URL、変更6 HTMLの和集合。前回不合格だったページへ対象が偏るため、その90.32%を全件の率として比較しない。代表30と変更6 URL、YAMLガイド・履歴の確認はすべて一致した。

最終62件に残った6件を下表に示す。全RGBA一致の基準を緩めたり、これらを合格に読み替えたりしていない。同じ#3生成物同士を独立コンテキストで比較する追加診断では、フランス語MFMの18画素とインドネシア語サーバープレビューの28画素が再現した。残差を一律に描画ノイズと断定しない。

| URL | 最終再確認の画素差 | 同じ#3生成物同士の画素差 |
| --- | ---: | ---: |
| `/de/tools/hub-servers-preview/` | 28 | 0 |
| `/en/` | 408,324 | 0 |
| `/fr/tools/mfm-playground/` | 18 | 18 |
| `/id/tools/hub-servers-preview/` | 28 | 28 |
| `/pl/docs/for-admin/install/resources/push-docker-hub/` | 22 | 0 |
| `/th/tools/hub-servers-preview/` | 28 | 0 |

トップページの差はheroの描画範囲にあり、3D表示は最初のフレームからの経過時間で回転する。現行の撮影手順で描画開始時刻の違いが影響する可能性があるが、この診断だけで原因を確定していない。22画素のドキュメント差は調べたサンプルで左ナビ矢印の5×10px範囲に収まった。本文の幅・高さの差とは区別する。

<details>
<summary>全件一括実行で未合格だったURLと最終確認</summary>

| URL | 全件の判定 | 全件の画素差／候補状態 | 最終62件での確認 |
| --- | --- | --- | --- |
| `/ja/` | different | 408153 | passed |
| `/blog/2024-06-11-mi-card/` | reference-unavailable | unstable | — |
| `/cn/blog/` | reference-unavailable | runtime-error | — |
| `/cn/docs/for-users/features/mfm/` | reference-unavailable | runtime-error | — |
| `/cn/docs/mi-card/` | reference-unavailable | unstable | — |
| `/cn/tools/hub-servers-preview/` | reference-unavailable | runtime-error | — |
| `/de/docs/mi-card/` | reference-unavailable | unstable | — |
| `/de/tools/hub-servers-preview/` | different | 28 | different (28 px) |
| `/en/` | different | 408324 | different (408324 px) |
| `/docs/mi-card/` | reference-unavailable | unstable | — |
| `/en/docs/mi-card/` | reference-unavailable | unstable | — |
| `/en/tools/mfm-playground/` | different | 18 | passed |
| `/es/docs/mi-card/` | reference-unavailable | unstable | — |
| `/es/tools/hub-servers-preview/` | different | 28 | passed |
| `/fr/docs/for-admin/install/resources/forking/` | different | 22 | passed |
| `/fr/docs/mi-card/` | reference-unavailable | unstable | — |
| `/fr/tools/mfm-playground/` | different | 18 | different (18 px) |
| `/id/` | different | 407428 | passed |
| `/id/docs/for-admin/install/resources/` | different | 22 | passed |
| `/id/docs/for-admin/install/resources/troubleshooting/` | different | 22 | passed |
| `/id/docs/mi-card/` | reference-unavailable | unstable | — |
| `/id/tools/hub-servers-preview/` | different | 28 | different (28 px) |
| `/it/docs/mi-card/` | reference-unavailable | unstable | — |
| `/ja-ks/docs/mi-card/` | reference-unavailable | unstable | — |
| `/ja-ks/tools/mfm-playground/` | different | 18 | passed |
| `/ja/blog/2024-06-11-mi-card/` | reference-unavailable | unstable | — |
| `/ja/docs/mi-card/` | reference-unavailable | unstable | — |
| `/ja/tools/hub-servers-preview/` | different | 28 | passed |
| `/ko/` | different | 406964 | passed |
| `/ko/docs/for-users/features/mfm/` | reference-unavailable | runtime-error | — |
| `/ko/docs/for-users/features/share-form/` | different | 1581 | passed |
| `/ko/docs/mi-card/` | reference-unavailable | unstable | — |
| `/ko/tools/mfm-playground/` | different | 18 | passed |
| `/pl/docs/for-admin/install/resources/scale-out/` | different | 22 | passed |
| `/pl/docs/for-admin/install/resources/push-docker-hub/` | different | 22 | different (22 px) |
| `/ko/docs/releases/` | different | 4655 | passed |
| `/pl/docs/mi-card/` | reference-unavailable | unstable | — |
| `/pl/tools/hub-servers-preview/` | different | 28 | passed |
| `/pl/tools/mfm-playground/` | different | 18 | passed |
| `/th/docs/mi-card/` | reference-unavailable | unstable | — |
| `/th/tools/hub-servers-preview/` | different | 28 | different (28 px) |
| `/tools/mfm-playground/` | different | 18 | passed |
| `/tw/blog/` | reference-unavailable | runtime-error | — |
| `/tw/` | different | 406367 | passed |
| `/tw/docs/for-users/features/mfm/` | reference-unavailable | runtime-error | — |
| `/tw/docs/for-users/features/share-form/` | different | 1298 | passed |
| `/tw/docs/mi-card/` | reference-unavailable | unstable | — |
| `/tw/tools/hub-servers-preview/` | reference-unavailable | runtime-error | — |
| `/tw/tools/mfm-playground/` | different | 18 | passed |
| `/tw/docs/releases/` | different | 2407 | passed |

</details>

数値・URL別判定・生成物差分の機械可読データは[検証結果JSON](ox-content-without-mdc-results.json)。全件VRTの入力指紋は`916c64e8a720a5a20048410a19678dd911c092d80054d1ae8e088c1c134a17d1`。最終ベンチと最終62ページVRTは同じ入力指紋`c504c5a00b917d8e5937df0e71536d698e216a9e83d7ffc6a70506e9556a21e0`で、各実行の前後で変更なしを確認した。

生成物・画像・生ログは`.output/`、`.vrt/`に保存し、PRには含めない。`pnpm test:vrt:baseline`は既定で#3のブランチを独立worktreeへ展開し、Oxのビルドを実行する。従来のNuxt baselineの生成も明示的な参照指定で利用できる。
