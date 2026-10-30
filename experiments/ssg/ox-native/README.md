# Ox native SSG 参照実装

公開済みの `@ox-content/vite-plugin@3.4.3` と `@ox-content/napi@3.4.3` を使い、
Ox 標準テーマの native SSG を単独で実行する最小構成。
[既存の公開 URL 一覧](../results/public-url-count.json)を使い、原稿準備から出力検証まで一つのコマンドで実行できる。
先に Vue 版をビルドしたり、ローカルの Ox checkout をリンクしたりする必要はない。

## 実行

Node.js 22.6 以上と `package.json` 指定の pnpm を使い、リポジトリルートで実行する。

```sh
pnpm install --frozen-lockfile --ignore-scripts

# 最初の4ページ / 30ページ / 全公開1,991 URL
pnpm pilot:ox-native:build
HUB_PILOT_PAGES=30 pnpm pilot:ox-native:build
HUB_PILOT_PAGES=all pnpm pilot:ox-native:build

# 原稿準備、clean build、出力検証を別プロセスで5回ずつ実行
HUB_PILOT_PAGES=all pnpm pilot:ox-native:measure --runs=5
node --test experiments/ssg/ox-native/sources.test.mjs
```

この実験だけなら install scripts は不要。通常の Nuxt 開発などを続ける場合は、
従来どおり `pnpm install --frozen-lockfile` を使う。

生成物は4ページが `.pilot/ox-native-theme/`、30ページが `.pilot/30/ox-native-theme/`、
全件が `.pilot/full/ox-native-theme/` に入る。`public/` を静的サーバーで配信すれば標準テーマを確認できる。
`source/` と `public/` は実行ごとに再生成され、既存の Vue 版生成物とは別の場所に保存する。

## コードの入口

- [build.mjs](build.mjs): URL 列挙 → 原稿準備 → `oxContent` の SSG hook → 全 URL の HTML 検証。
- [sources.mjs](sources.mjs): URL と原稿の対応を出力用 `index.md` に変換する。
- [measure.mjs](measure.mjs): 独立した Node プロセスで繰り返し測定し、サンプルと中央値を保存する。
- [Actions](../../../.github/workflows/ox-native-reference.yml): frozen install、原稿準備テスト、4/30/全件生成を Linux で検証する。

SSG オプションの要点は次のとおり。独自の `ssg.render` は指定しない。
3.4.3 の標準 native renderer と大規模サイト向け自動 navigation を使う。

```js
const ssg = oxContent({
	srcDir,
	outDir,
	docs: false,
	search: false,
	embeds: false,
	highlight: false,
	ssg: {
		clean: true,
		generateOgImage: false,
		lastUpdated: false,
		readerChrome: false,
	},
}).find((plugin) => plugin.name === 'ox-content:ssg');

ssg.config({}, { command: 'build', mode: 'production' });
await ssg.closeBundle();
```

Vite plugin の hook をスクリプトから呼ぶ実験用の入口なので、依存は 3.4.3 に固定している。
Nuxt/Vite server やブラウザーの起動、外部 API の取得は行わない。

## 描画する範囲

Markdown 原稿は frontmatter と MDC を含めてそのまま native renderer に渡す。
`ja-ks` などの別 URL も既存のページ列挙と同じ原稿を使う。
Vue/YAML 由来のページには **Native SSG route scaffold** と明記した仮ページを出す。
JSON の `markdownRoutes` / `scaffoldRoutes` / `markdownSources` で件数を区別する。

標準テーマの構造と native SSG の性能を確認する参照実装で、Misskey Hub の移植完了版ではない。
既存の Vue レイアウト、MDC コンポーネント、AiScript/Shiki、hydration、検索、埋め込み、
public assets の全コピー、言語入口の転送は再実装していない。
Markdown の raw MDC は Nuxt/MDC と同じ描画にはならず、Vue/YAML の仮ページにも元の機能はない。
HTML 検証は全 URL に完全な HTML 文書があることを確認するもので、VRT や機能互換の合格ではない。
Vue 画面を再利用する場合は引き続き [ox-standalone](../ox-standalone/README.md) を参照する。

## 計測値の読み方

`build.json` と `timings.json` は上記の生成先に保存する。過去の比較結果は更新しない。

| 項目                 | 範囲                                                               |
| -------------------- | ------------------------------------------------------------------ |
| `preparationSeconds` | ページ列挙、原稿読み込み、`source/` の再生成                       |
| `buildSeconds`       | SSG 設定、native Markdown/標準テーマ描画、asset 抽出、出力書き込み |
| `validationSeconds`  | 全期待 URL の HTML 読み込み・検証、出力ファイル数と bytes の集計   |
| `seconds`            | 上記3工程の合計                                                    |
| `wallSeconds`        | 各 Node 子プロセスの起動・module import・全工程・終了を含む実時間  |

全 run を保存し、初回を含めて中央値を求める。OS のファイルキャッシュは消していない。
初回と後続の差を確認できるよう、最速値だけではなくサンプル全件を残す。
過去の約34〜40秒の Vue SSR＋client build 込みの数字とは処理範囲が違うので、
この native SSG の数字をそのまま移行後の高速化率として比較しない。
