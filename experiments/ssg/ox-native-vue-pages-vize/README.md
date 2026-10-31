# ox-native-vue-pages-vize

[ox-native-vue-pages](../ox-native-vue-pages/README.md) と同じ固定ページ復帰構成を、**Vize 0.609.0に固定**して保存したもの。通常Vue版とコードの入口・実行用コピー・出力先を分離した。

```sh
pnpm pilot:ox-native-vue-pages-vize:build
pnpm pilot:ox-native-vue-pages-vize:verify
python3 -m http.server 4175 --directory .pilot/full/ox-native-vue-pages-vize/public
```

- ビルド設定：このディレクトリの `vite.config.ts` / `variant.mjs`。
- 出力：`.pilot/full/ox-native-vue-pages-vize/public/`。
- 独立した原稿・実行用コピー：`.pilot/variants/ox-native-vue-pages-vize/`。
- Vize専用依存：このディレクトリの `package.json` / `pnpm-lock.yaml` / `node_modules/`。Vite 7.3.1 / Vue 3.5.25を固定し、#1のルート依存は更新しない。

初回のbuildで、専用依存が未導入なら `pnpm install --ignore-workspace --ignore-scripts --frozen-lockfile` 相当の準備を行う。準備だけなら `pnpm pilot:ox-native-vue-pages-vize:prepare`。`HUB_VUE_COMPILER` 等の切替は不要で、常にVizeを使用する。

全1,991 URL、元Vueページ23ファイル・287 URLを含む。Markdownはraw Ox HTML、YAMLは原文表示。計測済みの条件・制約は [Vize比較レポート](../ISLANDS_VUE_PAGES_VIZE_REPORT.md)を参照。NavとCSS Modulesの互換処理を保持している。

`verify` はHTMLとJS/CSSの静的検査であり、ブラウザーの画像・操作互換を保証しない。既知の**日英share-link-generatorのhydration不一致**は残る。代表13条件の操作確認は11/13成功で、本番移行用の完成版としては扱わない。

初回準備と生成後の静的検証もコマンドに含むため、過去の11.55秒とはタイマー境界が異なる。共有処理は [shared/vue-pages](../shared/vue-pages/README.md)。
