# 全公開1,991 URLのVRT（PC・ライト）

追加：[Ox主体＋Vue islands（#2ベース）の全件VRT](ISLANDS_FULL_VRT_REPORT.md)は、同じmacOS・PC・ライト条件で**972/1,991 URL（48.82%）**が合格。Vizeは未測定。以下の8構成は前回の記録として保持する。

全8構成のフルSSGを再計測した生成物で、全公開1,991 URLを比較した。元Nuxtで基準が成立したのは**1,948 URL**、基準不成立は**43 URL**。基準不成立も全件の分母に残し、候補固有の不合格とは区別する。基準不成立の内訳は描画不安定31・実行エラー11・撮影失敗1 URL。

| 構成 | SSG（1回） | VRT合格 / 全URL | 全件合格率 | 比較可能URL内の率 |
| --- | ---: | ---: | ---: | ---: |
| Nuxt | 210.90秒 | 1,948/1,991 | 97.84% | 100.00% |
| Nuxt＋Vize | 216.52秒 | 1,903/1,991 | 95.58% | 97.69% |
| Ox単独 | 33.73秒 | 1,202/1,991 | 60.37% | 61.70% |
| Ox単独＋Vize | 31.99秒 | 1,207/1,991 | 60.62% | 61.96% |
| Astro＋MDC | 49.94秒 | 1,348/1,991 | 67.70% | 69.20% |
| Astro＋MDC＋Vize | 48.99秒 | 1,345/1,991 | 67.55% | 69.05% |
| Astro＋Ox | 46.14秒 | 1,203/1,991 | 60.42% | 61.76% |
| Astro＋Ox＋Vize | 44.43秒 | 1,203/1,991 | 60.42% | 61.76% |

Nuxt基準行の率は、元サイトで安定画像を取得でき、実行エラーもなかったURLの割合。基準そのものとの比較なので、移植版の再現率とは意味が異なる。基準が成立しなかったURLでは、ほかの7構成の画素比較を実施していない。

全構成が公開HTML 1,991/1,991件の生成に成功した。SSGは同一コード・原稿で順次各1回、VRTと同時実行せずに計測した参考値。小差の統計的な優劣を示すものではない。表示・機能の移植が未完成のため、同等機能を備えた本番サイトの高速化率を保証する値でもない。明示的なSSR例外検出はOx通常Vueのprofiling時に確認した。他7構成は同じ方法での検証を完了しておらず、ビルドログ検出の制約が残る。

## 不合格の内訳

| 構成 | 表示差分 | JS等の実行エラー | 撮影失敗 | 描画不安定 | 基準不成立 |
| --- | ---: | ---: | ---: | ---: | ---: |
| Nuxt | 0 | 0 | 0 | 0 | 43 |
| Nuxt＋Vize | 30 | 14 | 1 | 0 | 43 |
| Ox単独 | 667 | 78 | 0 | 1 | 43 |
| Ox単独＋Vize | 663 | 78 | 0 | 0 | 43 |
| Astro＋MDC | 521 | 78 | 1 | 0 | 43 |
| Astro＋MDC＋Vize | 524 | 78 | 1 | 0 | 43 |
| Astro＋Ox | 666 | 78 | 1 | 0 | 43 |
| Astro＋Ox＋Vize | 665 | 78 | 2 | 0 | 43 |

合格は、元Nuxtと同じ寸法・全RGBA画素が一致し、JS例外・hydration警告・ローカル404がないこと。表示差分は、基準・候補の両方で安定した画像を得た後の画素/寸法の差。撮影不成立や描画不安定を画素の不一致へ混ぜていない。

## ページ種別ごとの合格

| 構成 | docs（1,365） | blog（106） | 固定（287） | 言語エントリー（233） |
| --- | ---: | ---: | ---: | ---: |
| Nuxt | 1340 | 105 | 274 | 229 |
| Nuxt＋Vize | 1335 | 105 | 238 | 225 |
| Ox単独 | 959 | 101 | 142 | 0 |
| Ox単独＋Vize | 963 | 101 | 143 | 0 |
| Astro＋MDC | 1102 | 102 | 144 | 0 |
| Astro＋MDC＋Vize | 1102 | 102 | 141 | 0 |
| Astro＋Ox | 959 | 101 | 143 | 0 |
| Astro＋Ox＋Vize | 961 | 100 | 142 | 0 |

## 初期30ページとの関係

30ページ専用の生成ではPC/モバイル・明暗の4条件×8構成で960テスト・1,152画像が合格し、基準ファイルのハッシュを変更していない。全件生成ではデータ準備とページ入口が広がるため、同じ30 URLについても、全件の生成物での合格数を別に集計する。

| 構成 | 全件生成物内の30 URL（PC・ライト） |
| --- | ---: |
| Nuxt | 30/30 |
| Nuxt＋Vize | 30/30 |
| Ox単独 | 28/30 |
| Ox単独＋Vize | 28/30 |
| Astro＋MDC | 28/30 |
| Astro＋MDC＋Vize | 28/30 |
| Astro＋Ox | 28/30 |
| Astro＋Ox＋Vize | 28/30 |

## 撮影条件と制約

- 全件VRT自体は6並列で約73分38秒。表のSSG時間には含めず、SSG再計測の完了後に実行した。
- Chromium 145.0.7632.6、1440×900、ライト、locale ja-JP、ブラウザー/SSRともAsia/Tokyo。全文スクリーンショットを比較。
- URL・構成ごとに新しいブラウザーコンテキストを作る。時計・cookie・localStorageを前のURLから持ち越さない。
- 外部通信は遮断し、絵文字は共通の空キャッシュを使用。クライアント乱数を固定し、MFM/固定ページの時計はビルド完了時刻を基準に固定。CSSの動きは初期/終了フレームを保持して停止する。
- 連続2フレームの一致を最大5秒待つ。ページ撮影全体の上限は30秒。PNGバイトが同一なら画素の同一性が確定し、異なる場合は全RGBAへデコードして比較する。許容差・マスクは使用しない。
- WebGL専用のSwiftShaderフォールバックを有効にする。描画全体を強制SwiftShaderへ切り替える設定は長文撮影と両立しなかったため採用していない。
- SSG・VRTとも各構成1回の結果。撮影失敗や不安定なページは再試行して合格へ置き換えず、別分類のまま残した。
- この合格率は試作コードの固定条件下での表示再現度を表す。外部API/画像の実サービス利用、動き自体、フォーム操作・アクセシビリティ・SEO・全リンク動作を全件で保証するものではない。
- 撮影失敗はブラウザーや長文撮影の制約・負荷も含み、SSG失敗やフレームワーク固有の表示不具合とは断定しない。
- 元Nuxt側の外部取得や不安定な描画などで基準が成立しないURLは、候補を比較不可とする。移植側の追加外部取得もオフライン条件の影響を受けるため、実行エラーの内訳から区別して読む。

## 基準不成立の例

- `/ja/`: runtime-error — Failed to fetch
- `/`: runtime-error — Failed to fetch
- `/cn/docs/mi-card/`: unstable — No two consecutive identical frames within 5 seconds
- `/de/docs/mi-card/`: unstable — No two consecutive identical frames within 5 seconds
- `/de/docs/releases/`: unstable — No two consecutive identical frames within 5 seconds
- `/en/docs/mi-card/`: unstable — No two consecutive identical frames within 5 seconds
- `/en/docs/releases/`: unstable — No two consecutive identical frames within 5 seconds
- `/es/docs/mi-card/`: unstable — No two consecutive identical frames within 5 seconds

## 所見と次の修正候補

通常Vueの移行3案に共通する不合格は596 URL。Astro＋MDCでは合格し、Oxを使う2案でともに不合格になるURLは143件だった。共通互換層の不足と、本文エンジンごとの差分を分けて調査できる。

- 共通データ層: `shared/full-data.mjs`のsurround対象にpartialが含まれ、`queryContent().where({_partial:false})`の条件をruntimeが反映していない。30ページ専用のデータ準備ではpartialを除いており、全件生成で追加された経路を修正する必要がある。実際に`/cn/docs/about-misskey/`の次ページは、元Nuxtの`/cn/docs/for-users/`から移植3案では`/cn/docs/for-users/_dir/`へ変わった。通常Astro/Oxの代表画像ではこの欄の1,873画素のみが異なり、画像寸法はともに1440×4357だった。
- 外部データ: 移植側のuseFetchキャッシュはクライアントへhydrateされず、Teamページで追加fetchが発生する。オフライン条件での取得失敗を実行エラーとして記録した。
- 言語エントリー: 移植側は言語リンク一覧を出す段階で、元サイトのページ表示・転送処理が未移植。
- Vize固有の追加不合格は、通常Vueで合格した同じURLとの対照から切り分ける。全件の差分は、現在の試作コードの再現度を表す。


## 方針の比較

通常VueではOx単独が33.73秒と最短で、Astro＋MDCは49.94秒、Astro＋Oxは46.14秒。AstroへOxを組み合わせた差は今回の1回で3.79秒（約7.6%）にとどまる。表示互換の追加対応と合わせて評価する必要があり、この1回の差だけでは採用理由を確定できない。

次の作業は、3案共通のquery条件・周辺ページ・クライアントデータの互換層を修正し、同じURL群で比較することを優先する。既存MDCを維持するAstro案を互換の対照にし、Ox固有の本文差分を分離できる。Ox単独の独自テーマ/SSR保守と、Astro公式Vue integrationの保守範囲も相談対象とする。Vizeは追加の不合格と回避策があるため、表示の互換性を固めた後で速度差を複数回測定して判断する。


## 30ページCIの環境差

30ページのローカルdarwin-arm64では8構成すべて合格。一方、Ubuntu 24.04のCIでは、通常Oxの日本語embed/OAuthページのPC明暗4ケースにコードブロック末尾の1px差分が残る。NuxtとNuxt＋Vizeは先行する各120ケースが合格したが、CIは通常Oxで停止するため、後続5構成のLinux全件成功は未確認。

診断用CIではpre/codeのcomputed CSS（カスタムプロパティを除く）、寸法、scrollWidth/clientWidthに差がなく、日本語embedページは同じ1440×4537画像中、2本の水平1px行・計1,396画素に差が限られた。原因は未確定で、描画環境の差と断定しない。許容差・マスクで除外していない。この全公開URLの率はdarwin-arm64での別測定であり、Linux上の保証ではない。

初期4ページは通常Vue/Vizeを含む[CIが成功](https://github.com/odanado/misskey-hub-next/actions/runs/41040912435)した。

[30ページVRT](VRT_30_REPORT.md) / [Linux診断CI](https://github.com/odanado/misskey-hub-next/actions/runs/41040912480)。


## 再現・証拠

```sh
pnpm pilot:full:measure --with-vize --runs=1 --output-dir=experiments/ssg/results/full/2026-10-30
pnpm pilot:full:vrt --workers=6 --output-dir=experiments/ssg/results/full/2026-10-30
```

[統合表JSON](results/full/2026-10-30/comparison.json) / [SSG生データ](results/full/2026-10-30/compiler-timings.json) / [VRT集計](results/full/2026-10-30/vrt.json) / [全URL結果JSONL](results/full/2026-10-30/vrt-rows.jsonl) / [環境・URL・コード指紋](results/full/2026-10-30/vrt-run.json)。

画像はPRに含めず、ページ単位で比較後に破棄する。代表的な差分だけ`.pilot/full-vrt/samples/`へ保存した。全件集計前の撮影条件調整中の結果は採用していない。
