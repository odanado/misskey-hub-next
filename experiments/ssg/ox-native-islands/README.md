# Ox native + Vue islands

PR #2（ubugeeei氏、`c52b733`）のCustom Host構成を土台にした、通常Vueの30 Markdownページ互換パイロット。元コードの取り込みコミットには`Co-authored-by: ubugeeei <ubuge1122@gmail.com>`を付ける。従来の全体Vue描画方式は比較用に`../ox-native/`へ残す。

- **OxがSSGを所有する。** `host.ts`がルートとHTML文書を返し、公式Custom Hostが出力する。選択ページの本文は公開APIの`host.markdown.render()`で各原稿を一度だけ変換する。MkIndexの説明文補完に使う既存MDC解析は別経路で残る。
- **本文はサーバーでHTMLへ直列化する。** 互換用の木とMDC/Shikiのコード・部品処理はビルド時だけに存在する。`html.ts`が通常のタグ・テキストをHTMLとして出力する。本文全体をVue/MDCのVNodeへ変換したり、クライアントでhydrateしたりしない。
- **Vueは必要な部品を補う。** ナビ、サイドバー、目次、MFMプレビュー、埋め込みを独立したislandとしてhydrateする。既存の通知枠・リンク・前後リンク等はビルド時の補助部品として再利用する。ページ全体のVueアプリは作らない。
- **静的HTMLのクライアント動作は小さく保つ。** メニュー、スクロール、表のScrollHint等を`client.ts`で初期化する。Markdownファイルのクライアントimport一覧や本文ASTは持ち込まない。
- **CSSも既存部品から取る。** 静的レイアウトが使うCSS modulesは明示的に保持し、scoped CSSは同じSFCソースからコンパイルする。原稿やNuxtの生成HTML、VRT基準画像をビルド入力へ流用しない。

```sh
HUB_PILOT_PAGES=30 pnpm pilot:ox-islands:build
HUB_PILOT_PAGES=30 pnpm pilot:ox-islands:verify
pnpm pilot:ox-islands:check
HUB_PILOT_PAGES=30 node experiments/ssg/ox-native-islands/verify-30.mjs
```

`theme.ts`はdocsの静的フレーム、`decorations.ts`はビルド時のVue補助、`islands.ts`はクライアントへ送る部品の境界。通常本文のASTをページごとのJSへ埋め込む方式には戻さない。30ページ範囲の未対応MDC部品はビルドを失敗させる。

表示一致の合格対象は30 Markdown URL。全1,991公開URL（YAML・固定ページ込み）は生成検証と時間計測の対象で、全件の表示移植完了を示さない。全件用の`full-components.ts` / `full-theme.ts`は、YAMLガイド・固定ページの既存Vue本文とレイアウトを補助islandとして使う。通常Markdown本文は引き続き静的HTMLで、MarkdownごとのJSモジュールを生成しない。全件用レジストリは30ページ用クライアントから除外する。

`MkSchemaViewer` / `MkSchemaViewerItemObject`はユーザー指定により空として扱う。その他、現行ソースに実装のない旧部品は全件生成時だけ定義・子要素を静的表示し、URLと部品名をログへ記録する。これらはVRT合格として扱わない。全件用のVue補助部品でSSR例外が発生した場合はビルドを失敗させる。

```sh
HUB_PILOT_PAGES=all pnpm pilot:ox-islands:build
HUB_PILOT_PAGES=all pnpm pilot:ox-islands:verify
# 現在のコードで30ページVRTが成功していることを要求し、全件を3回計測
node experiments/ssg/ox-native-islands/benchmark-full.mjs
```

計測には起動・Vite・原稿処理・SSG・publicコピーを含む。全URLのHTMLとCSS/JS存在、本文ASTをクライアントへ送っていないことの検証はタイマー外で実行する。結果と制約は[レポート](../OX_ISLANDS_REPORT.md)にまとめる。
