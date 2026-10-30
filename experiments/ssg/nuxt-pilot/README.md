# Ox Content移行パイロット

本番移行前の比較実験。`HUB_CONTENT_PILOT` を設定したビルドだけに適用する。通常の `pnpm generate`、コンテンツ原稿、本番デプロイ設定は従来のまま。

[検証結果と移行案の比較・提案](./REPORT.md)

## 対象

| URL | 検証する機能 |
| --- | --- |
| `/ja/docs/for-users/features/note/` | tip/warning、内部リンク、HTMLの表、日本語の見出しと目次 |
| `/ja/docs/for-users/features/hashtag/` | ローカル画像、外部リンク、インラインコード、画像のalt |
| `/ja/docs/for-developers/plugin/create-plugin/` | AiScriptとその別名のシンタックスハイライト、深い見出し、tip |
| `/en/docs/for-users/features/note/` | 英語、翻訳案内、既存remarkプラグインによる英文の空白補正 |

元のMarkdownをそのまま読む。原稿の複製を移行先の正として管理したり、基準画像に合わせて原稿を書き換えたりしない。

## 比較する構成

| モード | コレクション | 本文 | レイアウト・SSG |
| --- | --- | --- | --- |
| `baseline` | 既存Nuxt Content v2の`queryContent` | 既存MDC + Shiki | 既存Nuxt/Nitro |
| `query` | Oxの`queryCollection` | 既存MDC + Shiki | 既存Nuxt/Nitro |
| `native` | Oxの`queryCollection` | OxのRustパーサー → HAST → MDC互換AST。コードブロックは既存Shiki | 既存Nuxt/Nitro |
| `standalone` | Oxの標準ページ収集 | Ox | Ox自身のSSG・標準テーマ |

`query` はOxの公式 `generateCollectionsVirtualModule` が生成したコレクション実装をNitroに組み込む。自作の配列検索を `queryCollection` と呼び替える実装ではない。`body` を明示して、Oxが読み込んだ生Markdownを既存の `parseContent` に渡す。Nuxtのパース済みASTをコピーして比較を通す実装でもない。

対象の環境はNuxt 3 / Content **v2**。参照記事のNuxt 4 / Content **v3** / D1とは異なるため、DBアクセス削減の効果をそのまま期待できない。Ox 3.4.0のViteプラグインはVite 8をpeer dependencyに持つ一方、このサイトはVite 7なので、今回Viteプラグイン自体をNuxtに登録せず、コレクション生成APIをビルド時に呼ぶアダプターを使った。

`native` は通常のMarkdown、tip/warning、見出しID、TOC、外部リンク属性、英文補正、画像alt、コード出力の互換性を対象4ページで検証する。MDCの任意のprops、slots、ネストした独自コンポーネント等の一般的な互換実装ではない。未対応のMDC構文の一部は明示的にエラーにするが、全MDC構文を網羅して検出するものではない。MDCの内部コンパイラーとTOC生成器を使用するため、依存更新時にはVRTで再検証する必要がある。

`standalone` はOxの公開ViteプラグインのSSGビルドフックを実行する。既存NuxtのHTMLやスクリーンショットをページ枠として流用しない。これによりNuxtを外したときに失われるレイアウト・翻訳・ナビゲーション・操作機能をVRTで検出できる。既存サイト相当のVueテーマの再実装は、この実験には含めていない。

## VRT

Playwright 1.58.2 / Chromium、1440×900と390×844、light/dark。4ページ×4条件の16テストに、モバイルのメニュー・目次を開く状態を加え、移行候補ごとに20画像を比較する。

- 基準は `baseline` ビルドで撮影した既存のページ全体。本文・ヘッダー・サイドバー・フッターをマスクしない。
- `maxDiffPixels: 0` / `threshold: 0`。追加でPNGを復号し、アンチエイリアスも含む全RGBAバイトの一致を検証する。
- ローカル画像のdecode、フォントの読み込み、Nuxtのhydration完了を待つ。外部への通信は両構成で同様にブロックし、Google Fonts等の取得状況による揺らぎを除く。日本語のローカルフォントは読み込む。外部Webフォントを実際に取得した表示は検証範囲外。
- SEO、見出しID、リンク先・rel・target、画像src/alt、コード本文をJSONスナップショットで検証する。
- hydration警告、JavaScriptエラー、ローカルHTTPエラーを検出する。
- ノートからハッシュタグへのクライアント遷移も検証する。Oxの本文データはパス別JSONとしてプリレンダーし、静的ホスティングでも取得できるようにした。
- 候補モードでの基準更新は禁止する。CIでもまず従来構成を生成・撮影し、同一OS/ブラウザーで候補と比較する。

スクリーンショットにはOS固有のフォント差があるため、別OSでは従来構成から基準を撮影し直す。通常のVRTでは基準更新オプションを付けない。

```sh
pnpm install --frozen-lockfile
pnpm exec playwright install chromium

# 従来構成から基準を作成し、再撮影でも一致することを確認
pnpm pilot:build baseline
HUB_CONTENT_PILOT=baseline pnpm pilot:vrt --update-snapshots
HUB_CONTENT_PILOT=baseline pnpm pilot:vrt

pnpm pilot:build query
HUB_CONTENT_PILOT=query pnpm pilot:vrt

pnpm pilot:build native
HUB_CONTENT_PILOT=native pnpm pilot:vrt

# 独立SSG案。既存テーマとのVRT差分を検出する比較用
node experiments/ssg/nuxt-pilot/standalone.mjs
HUB_CONTENT_PILOT=standalone pnpm pilot:vrt

# 結果の要約。HTMLレポートは .pilot/<mode>/vrt/html/index.html
node experiments/ssg/tooling/vrt-summary.mjs native
pnpm exec playwright show-report .pilot/native/vrt/html
```

## 計測方法

```sh
# 3構成×3回。ブラウザー/VRTと同時に実行しない
node experiments/ssg/nuxt-pilot/measure.mjs

# 計測後の3構成をまとめて再検証（基準画像は更新しない）
pnpm pilot:verify
```

毎回 `.nuxt` を削除し、コレクション生成・クライアント/サーバービルド・Nitroのプリレンダーを含む経過時間を測る。OSのファイルキャッシュは消さない。順番はローテーションし、各構成の中央値を比較する。Crowdin APIは全構成で無効化する。測定値と環境は `results/timings.json` に保存する。ログは `.pilot/<mode>/build.log`。

すべて同じ4ページを出力し、必要なContent API、i18nのメッセージ、Nuxt Island、payloadも生成する。旧Hubのリダイレクト生成は全案で測定に含めない。ページのクロールは無効化する。ナビゲーションと前後リンクは全案で既存実装を維持するため、対象外の原稿もNuxt Contentのインデックスには残る。この4ページの結果から全サイトの高速化率を外挿することはできない。

対象4ファイルには独自YAML frontmatterがない。`query` の本文変換ではOxの `body` を既存パーサーへ渡すため、frontmatterを必要とするページへ拡張する際は、Oxのメタデータを結合する処理と専用の比較ケースが必要。

`standalone` は機能・テーマが同等ではないので、処理時間をNuxt各案の高速化率に使わない。検索、YAMLのステップガイド、ブログ、全言語、全サイトのルーティング・リダイレクトも本番移行前の追加検証が必要。

## 参照

- [検討のきっかけとなった記事](https://zenn.dev/ytr0903/articles/582133c77daa4e)
- [Ox ContentのコレクションAPIとbodyの扱い](https://ox-content.dev/packages/vite-plugin-ox-content/)
- [Ox Content公式ソース](https://github.com/ubugeeei-prod/ox-content)
- [Nuxt Content v2 queryContent](https://v2.content.nuxt.com/composables/query-content/)
