# 共通の原稿エンジン

- [markdown.mjs](markdown.mjs): 既存MDC・ShikiとOx呼び出しの窓口。パーサー固有の処理を方針間でコピーしない。
- [ox-native.mjs](ox-native.mjs): OxのHTMLをHAST経由で既存MDC互換ASTへ接続する。コード・MDCコンポーネント区間は既存MDCへ委譲する。
- [ox-islands.mjs](ox-islands.mjs): MDCコンテナ・コンポーネント区間の切り出し。

Astro＋MDCは既存MDCの入口を選び、Ox単独・Astro＋Oxは同じOx入口を選ぶ。Nuxt内での初期native案もこの変換を参照するため、Ox側の互換処理は共通ディレクトリに置いた。

`shared/data.mjs`は4/30ページ、`shared/full-data.mjs`は全件用のpayloadを組み立てる。ここではHTMLファイルを出力しない。

コンポーネントの複数行属性にはコードフェンスそのものが入る（MFMのサンプル等）。原稿をソース順に走査し、コード例内のコンポーネント記法を保ちながら、実際のコンポーネント全体を先に切り出す。その後、外側のコードをShikiへ渡す。`HUB_PILOT_PAGES=30 node experiments/ssg/tooling/repros/markdown-compat.mjs`でMFMの属性・見出し・コード、脚注、descriptionを既存MDCと照合できる。
