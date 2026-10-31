# ox-native-vue-pages

既存Vue固定ページを復帰した診断構成を、**通常Vueコンパイラに固定**して保存したもの。[約7秒の追加コストを調べた構成](../ISLANDS_VUE_PAGES_VIZE_REPORT.md)であり、25秒版の `ox-native-islands` とは別。

```sh
pnpm pilot:ox-native-vue-pages:build
pnpm pilot:ox-native-vue-pages:verify
python3 -m http.server 4174 --directory .pilot/full/ox-native-vue-pages/public
```

- ビルド設定：このディレクトリの `vite.config.ts` / `variant.mjs`。
- 出力：`.pilot/full/ox-native-vue-pages/public/`。
- 独立した原稿・実行用コピー：`.pilot/variants/ox-native-vue-pages/`。
- Vize版：[ox-native-vue-pages-vize](../ox-native-vue-pages-vize/README.md)。出力を共有しない。

全1,991 URL、元Vueページ23ファイル・287 URL（261 SSR / 26 client-only）を含む。Markdownはraw Ox HTML、YAMLは原文表示のまま。MDC/Shikiや通常ドキュメントの表示互換を復帰した構成ではない。

初回のbuildは準備処理も行う。準備だけを先に行うには `pnpm pilot:ox-native-vue-pages:prepare`。生成後に全URLとJS/CSSを静的検証するため、このコマンド全体の時間を過去の11.47秒と直接比較しない。既存ベンチの数値・タイマー境界は変更しない。

共有の処理と原稿の固定方法は [shared/vue-pages](../shared/vue-pages/README.md) を参照。`HUB_VUE_COMPILER` 等を指定する必要はなく、この構成は常に通常Vueでビルドする。
