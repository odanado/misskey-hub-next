# 固定Vueページ復帰版の共有処理

[通常Vue版](../../ox-native-vue-pages/README.md) / [Vize版](../../ox-native-vue-pages-vize/README.md) の原稿準備、Vite / Ox Custom Host設定、ビルド、出力検証を共有する。各案の名前とコンパイラはそれぞれの `variant.mjs` に固定し、環境変数で別案へ切り替えない。

| ファイル | 役割 |
| --- | --- |
| workspace.mjs | 独立した固定原稿コピーの準備、Vize専用依存の準備、出力先の割り当て |
| config.mjs | 同一のページ・CSS・Custom Hostと、各案に固定したコンパイラを組み合わせる |
| build.mjs | 初回準備、full SSG、生成後の静的検証 |
| verify.mjs | 全1,991 HTML、23 Vueページ・287 URL、SSR/client-only分類、JS/CSSを検査 |

## 当時の実験条件を維持する方法

原稿・既存Vueコードは計測元と同じ `6cbe059c5d3b358557f6493b606f196c2ca06e8a` のgit archiveから、`.pilot/variants/<名前>/` へそれぞれ展開する。ページ復帰処理は既存の [prepare-pages.py](../../tooling/islands-comparison/prepare-pages.py) と [vue-pagesテンプレート](../../tooling/islands-comparison/vue-pages/) を再利用し、Nuxt APIの共通ラッパーは準備したコピーの `experiments/ssg/nuxt-compat/` を利用する。

その後、準備先のViteエントリーを各案の追跡対象 `vite.config.ts` へ向け、routesの出力先を `.pilot/full/<名前>/public/` へ分離する。過去の診断コピー・ベンチ結果・25秒版 `ox-native-islands` の出力は変更しない。

- 通常Vue：Vue 3.5.25 / @vitejs/plugin-vue 6.0.2 / Vite 7.3.1。
- Vize：上記のVue/Viteを維持し、専用ディレクトリのVize 0.609.0でコンパイル。
- 2案ともMarkdown 1,434件・YAML 156件・公開1,991 URL。本文やUIの省略条件は [元の比較レポート](../../ISLANDS_VUE_PAGES_VIZE_REPORT.md) と同じ。

準備処理・テンプレート・lockfile等の変更は署名で検知し、このツールが作成した実行用コピーだけを再生成する。明示的に再準備する場合は各 `:prepare -- --fresh` を使用する。実行用コピーはキャッシュなので、編集は追跡対象の設定・テンプレート側で行う。

初回の依存導入とNuxt prepareはSSG前の準備処理で、`build` は末尾に出力検証も行う。既存のベンチ結果の数値・タイマー境界は変更せず、時間比較は従来の [compiler-benchmark/benchmark.py](../../tooling/islands-comparison/compiler-benchmark/benchmark.py) で行う。

## 分離後の確認

両方の独立コマンドで全1,991 URLの生成・静的検証が成功。VizeのJS/CSS 40ファイルは前回の計測済み生成物とバイト単位で一致した。通常Vueは作業ディレクトリ変更によるscoped ID・minify識別子・chunk hashの変更があり、代表13条件を改めて確認して13/13成功。Vize実行後も通常Vueの出力manifestが変わらないことを検証した。

[検証記録](../../results/named-vue-pages/2026-10-31/checks.json)。Vizeの既知の互換性制約と従来のベンチ結果は変更していない。
