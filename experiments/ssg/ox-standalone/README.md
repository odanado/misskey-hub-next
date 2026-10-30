# Ox単独SSG＋Vue

`pnpm pilot:ox:build`（内部mode: `ox-ported`）。全件は`HUB_PILOT_PAGES=all`。

- [build.mjs](build.mjs): 原稿準備 → Viteクライアントビルド → Vue SSR → Ox Built-in SSGを起動する。
- [server.ts](server.ts): ページごとにVueアプリを作り`renderToString`。非同期SSR例外も収集し、失敗を見逃さない。
- [client.ts](client.ts): 生成HTMLへ渡したpayloadでVueをhydrateする。
- [document.mjs](document.mjs): Vueの描画結果と共通headをHTML文書に組み立てる。

原稿は[shared/content](../shared/content/README.md)のOx N-API＋MDC互換処理、Nuxt由来のVueページは[nuxt-compat](../nuxt-compat/README.md)で扱う。`queryCollection`は使わず、manifestを一括取得する。

Ox Built-in SSGは使っている。独自`ssg.render`が先にVue SSRしたHTMLを返すため、Vue SSRの時間は別途かかる。SSGフックをスクリプトから呼ぶ実験的な構成で、Nuxtを起動せずに既存のVue部品を再利用する保守負担も比較対象。
