# Misskey Hub

Misskeyの公式サイトです。Ox ContentのCustom Hostで全ページを静的生成し、ViteでJS/CSSを生成します。Vueは既存UIと操作が必要なislandに使用します。

## 開発

Node.js 22（検証環境は22.22.2）とpnpm 10.27.0を使用します。

```sh
pnpm install --frozen-lockfile
pnpm dev
```

`http://localhost:5173/`を開きます。

```sh
pnpm build
pnpm preview
```

本番出力は`.output/public/`です。`pnpm generate`も同じ本番ビルドを実行します。GitHub Pagesの既存デプロイ先を維持し、Vercelの静的出力にも対応しています。`CROWDIN_INTG_API`と`SERVER_LIST_API_BASE_URL`は従来どおりビルド時に使用します。

## 構成

- `ssg/host.ts`：Oxが所有するルート・HTML出力の入口。
- `ssg/routes.mjs` / `data.mjs`：原稿とVueページから公開URL、翻訳、ナビゲーション、ページデータを生成。
- `ssg/markdown.ts` / `markdown-native.mjs`：通常MarkdownをOxでHTML化し、MDC部品・コードの断片は既存MDC/Shikiと接続。
- `ssg/theme.ts` / `html.ts`：ドキュメントの静的HTML。通常本文全体をVueのVNodeやクライアントモジュールにしません。
- `ssg/registry.ts` / `runtime.ts` / `page.ts`：既存Vue部品、ページ、レイアウト、auto import、翻訳・非同期データ等の互換処理。
- `ssg/client.ts`：islands、固定Vueページ、メニュー、表、スクロール位置などのクライアント処理。
- `tests/vrt/`：masterとの画像比較とfull SSG計測。

Nuxtのアプリビルド・Nitroサーバーは使用しません。既存のMDC描画・Prose部品・メタデータ変換との互換のため、`@nuxt/content` 2.13.4と`@nuxtjs/mdc`はライブラリとして残しています（`@nuxt/content`の依存経由でNuxtのpeer packageもインストールされます）。他方式の実験コードやVizeは含みません。

## 原稿・リンク・お知らせ

原稿の記法は[content/.README.md](content/.README.md)を参照してください。お知らせは`app.config.ts`で変更します。

内部・外部リンクには既存の`GNuxtLink`を使います。ロケール付きURLは`useGLocalePath`で生成します。`x-mi-web://`のリンクも既存のMisskey Web用ゲートウェイへ接続します。ページ遷移は通常の静的HTMLへのリンクです。

## VRT

基準は移行前のmasterです。画像をGit管理せず、別worktreeを`.vrt/main/`に作ってNuxt基準を生成します。必要なら`VRT_BASELINE_REF`で比較元コミット、`VRT_BASELINE_DIR`で既存checkoutを指定できます。

```sh
git fetch origin
pnpm test:vrt:baseline
pnpm build
pnpm test:vrt
```

全公開URLをmacOS上のChromiumでPC・ライト条件で比較します。全RGBA画素と寸法の完全一致、JS例外・hydration警告・ローカル404なしを合格条件とし、マスクや許容差は使いません。基準不成立も分母に残して別分類します。外部通信は遮断し、絵文字キャッシュ・乱数・時計・アニメーションを固定します。WebGL背景も同じ時刻で比較するため、時計を基準ビルド完了時刻＋30秒に停止します。

```sh
# 代表30ページやモバイル・ダークも指定可能
pnpm test:vrt --sample=30 --output-dir=.vrt/30
pnpm test:vrt --sample=30 --viewport=mobile --theme=dark --output-dir=.vrt/mobile-dark
```

集計・URL別結果・代表差分画像は`.vrt/`へ保存します。基準が成立しないURLでも移行側の実行状態を記録します。外部サービス、アニメーション自体や全フォーム操作の保証とは分けて扱います。

## SSG計測

```sh
pnpm benchmark
```

新規プロセスで本番ビルドを順次3回実行し、起動から全生成・publicコピー・旧URL転送生成の完了までを計測します。出力検証はタイマー外。VRTや他のビルドと同時に実行しないでください。結果は`.vrt/benchmark.json`です。

## クレジット・ライセンス

Ox Custom Hostによる構成は[ubugeeei氏のPR #2](https://github.com/odanado/misskey-hub-next/pull/2)を基にしています。派生コードのコミットには`Co-authored-by: ubugeeei <ubuge1122@gmail.com>`を付与します。

GNU Affero General Public License v3.0。既存コンテンツ・部品の著作権表示を維持します。
