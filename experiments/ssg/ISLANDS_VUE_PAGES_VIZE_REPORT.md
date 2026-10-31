# 既存Vue固定ページの追加コストを再確認し、Vizeと比較

保存構成：[ox-native-vue-pages](ox-native-vue-pages/README.md) / [ox-native-vue-pages-vize](ox-native-vue-pages-vize/README.md)。コンパイラ、ビルドコマンド、作業コピー、出力先を別にした。以下の既存ベンチ値は保持し、新コマンドの初回準備・生成後検証込みの時間へ読み替えない。

**約7秒の増加は再現した。Vize 0.609.0へ差し替えても、この増加分の大きな短縮は確認できなかった。** PR #1 の `codex/ssg-migration-pilot` で行った診断実験で、本番移行のPR #3は変更していない。

## 当時の通常Vue構成をそのまま再計測

[当時の記録](ISLANDS_VUE_PAGES_REPORT.md)に使った2つの独立コピーを、ソースを変更せず再実行した。ソースfingerprintは当時と完全に一致した。

| 条件 | 当時の中央値 | 今回の再計測中央値 |
| --- | ---: | ---: |
| 最小Vue＋CSS、既存固定ページ本文を省略 | 4.85秒 | 4.97秒 |
| 既存Vue固定ページ・レイアウト・クライアント処理を復帰 | 11.52秒 | 11.96秒 |
| 固定ページ復帰の増加分 | **6.67秒** | **6.99秒** |

各3回、交互に実行し、全6回で1,991 URLのHTMLとJS/CSSを検証。詳細は[再計測JSON](results/islands-comparison/2026-10-31/vue-pages-recheck/summary.json)。元の結果ファイルは上書きしていない。

## 通常Vue / Vize の4条件比較

続いて同じ原稿・Vueページ・ランタイムを新しい独立コピーに保存し、コンパイラ選択と計測プローブを追加した。最小Vue＋CSSと固定ページ復帰版をそれぞれ通常Vue / Vizeで各3回、計12回順次実行した。

| 条件 | 通常Vue | Vize 0.609.0 |
| --- | ---: | ---: |
| 最小Vue＋CSS | 4.734秒 | 4.925秒 |
| 既存Vue固定ページを復帰 | 11.473秒 | 11.549秒 |
| **固定ページ復帰の増加分** | **6.739秒** | **6.624秒** |
| 固定ページ復帰版のSFCコンパイラAPI内処理 | 0.438秒 | 0.149秒 |
| 固定ページ復帰版のSFCコンパイラプラグインのフック内処理 | 1.075秒 | 1.273秒 |

値は各3回の中央値。増加分は「固定ページありの中央値 − 最小Vue＋CSSの中央値」。増加分の差は **−0.115秒**。最小対照もVizeで約0.19秒遅くなっており、固定ページありのfull SSG自体は約0.08秒長かった。

同じround内で比較した増加分の差も **＋0.20 / −0.85 / ＋0.56秒**と方向が揃わず、今回の3回ずつの測定から安定した高速化は確認できない。

一方、SFCコンパイラAPI内処理は **約66%短縮**した。約7秒の増加には、クライアントJS/CSS生成、データ・翻訳・ナビゲーション準備、contributors API取得、Vue SSR、hydration用payload生成等も含まれる。コンパイラAPIの短縮は、これらすべての短縮を意味しない。Viteのload/transform等を含むコンパイラプラグイン側の時間も上記のとおり測定しており、コンパイラAPIだけが処理全体を表すものではない。

### 各回のfull SSG時間

| round | 最小Vue＋CSS：通常Vue | 最小Vue＋CSS：Vize | 固定ページ復帰：通常Vue | 固定ページ復帰：Vize |
| --- | ---: | ---: | ---: | ---: |
| 1 | 4.447秒 | 4.925秒 | 11.473秒 | 12.152秒 |
| 2 | 4.734秒 | 5.207秒 | 11.715秒 | 11.341秒 |
| 3 | 4.873秒 | 4.674秒 | 11.190秒 | 11.549秒 |

[全12回の数値・API内訳・指紋・増分計算](results/islands-comparison/2026-10-31/vue-pages-vize/summary.json)。ログ・生のコンパイラprofile・生成HTMLは `.pilot/islands-comparison/` に保持し、PRには含めていない。

## 条件と計測範囲

- macOS arm64 / Apple M1 Pro（10コア）/ Node 22.22.2 / pnpm 10.27.0。
- **Vue 3.5.25 / @vitejs/plugin-vue 6.0.2 / Vite 7.3.1 / Ox Content 3.4.3**を維持。PR #3のVite 8へは更新していない。
- Vizeは直前のPR #3比較と同じ **0.609.0**を専用依存ディレクトリへ導入し、そのpeerのViteも7.3.1に固定。#1のルートpackage.json・lockfileは変更していない。ルートに既存の0.607.0があっても今回のSFCコンパイルでは使用しない。
- 当時と同じ原稿 **Markdown 1,434件 / YAML 156件 / 公開1,991 URL**。既存Vueページは **23ファイル・287 URL（261 SSR、26 client-only）**。233言語入口と1,471文書URLも保持。
- Markdownはraw Ox HTML、YAMLは原文表示。MDC/Shiki、通常ドキュメントのフレーム・サイドバー等は当時と同じく省略した診断条件。**25秒のVRT互換版やPR #3の本番構成と同じ機能範囲ではない。** 既存の8構成比較表のSSG値は置き換えていない。
- PNPM/Node起動からawaitしたfull SSG終了までを測定。Nuxt prepareは従来どおり事前に完了。出力検証・コピー・ブラウザー確認はタイマー外。contributors APIは各固定ページビルドで実取得し、30名分を確認。
- 実行順をroundごとに変え、ビルド/VRT/ブラウザー確認を並行させない。新しいPNPMプロセスで実行し、OSキャッシュは維持。各回でVite/Vizeキャッシュを削除し、`VIZE_PRECOMPILE_CACHE=0` を設定。
- Vizeは#1の既存アダプターの方針と同じ **`scanPatterns: []` のオンデマンドコンパイル**。0.609.0のnative APIがclient / SSR双方で実行されたことをプローブで検査し、Vueコンパイラへのfallbackは行っていない。
- API計測はVueの`parse` / `compileScript` / `compileTemplate` / `compileStyleAsync`、Vizeの`compileSfc`等。Vueのinline templateコンパイルも含む。Vite側へ委譲した処理、SVG変換、一般のバンドル・minify、Vue SSR描画等はAPI時間の外側。Sass等の委譲範囲も実装により異なるため、end-to-endの判断にはfull SSG値を使用する。
- 非同期処理の重複区間は和集合で計測し、二重加算しない。プラグインのload/transform/buildStart時間には待ち時間も含むため、SSGの排他的な工程時間やクリティカルパスと解釈しない。プローブは両構成で有効、終了時JSON書き込みもSSG時間に含む。

SFC APIが扱ったユニークファイルは、最小対照が両方53、固定ページ復帰版は通常Vue99 / Vize100。Vizeの追加1件はNavの互換コピー。両構成とも指定した既存SFCのCSSを含めて生成している。共通のstyle抽出やSVG変換では従来のVueコンパイラ利用が残り、Vueコンパイラ依存を完全に削除したものではない。

## 出力と表示・操作の確認

全12ビルドで、1,991件の非空HTML、stylesheet参照、JS/CSS manifest、23 Vueページ・287 URLの対応、261 SSR / 26 client-onlyの分類を検証。固定ページ本文の省略マーカーがないことと、全原稿・publicを保持したことも検査した。

| ブラウザー確認 | 通常Vue | Vize |
| --- | ---: | ---: |
| 最小対照：カウンター操作、CSS Modules/Sassの色・背景・角丸 | 成功 | 成功 |
| 固定ページ復帰：当時と同じ代表13条件 | **13/13** | **11/13** |

トップPC/モバイル、言語入口、servers、docs索引、日英share-link-generator、問い合わせFAQ、ブログ一覧、team、ns、shareとmi-webを確認した。**VRTの画像一致試験ではない。全件VRTも実施していない。**

Vizeの失敗は **日英share-link-generatorのhydration不一致**。公開範囲の選択肢で、SSRの表示に対してクライアント側が `_noteVisibility.undefined` を期待し、`value="true"` 等の属性不一致も出た。入力→共有URL生成・MFMプレビューまで検査してから収集したエラーを判定し、失敗として記録した。完全な表示・操作互換は未達であり、本番へそのまま採用できる結果ではない。

Navの条件付きtemplate slotとCSS Modules参照には既存のVize互換処理を使った。今回の補助コードはfull registryのNav参照も互換コピーへ向け、最小対照にもCSS Modulesのrender context補正を適用する。元のVueページ・コンポーネントは変更していない。

外部の絵文字・インスタンスAPIのCORS警告は通常Vue/Vize双方で記録し、消去やモック置換を行っていない。

[通常Vueの13条件](results/islands-comparison/2026-10-31/vue-pages-vize/browser-vue.json) / [Vizeの13条件・エラー](results/islands-comparison/2026-10-31/vue-pages-vize/browser-vize.json) / [最小対照の操作・CSS](results/islands-comparison/2026-10-31/vue-pages-vize/browser-minimal.json)。画像はPRに含めない。

## 再現手順

既存の `.pilot/islands-comparison/vue-island-css` と `vue-pages` は元の診断コピーとして保持している。新規環境では、#1の依存をインストール後、従来の `prepare-vue.py vue-island-css` と `prepare-pages.py` で準備する。既存ディレクトリを上書きしない仕様なので、すでに準備済みなら再作成は不要。

```sh
# 当時の2構成の再計測。既存の結果を上書きしない出力先を指定。
HUB_COMPARE_RESULT_DIRECTORY=experiments/ssg/results/islands-comparison/2026-10-31/vue-pages-recheck \
  python3 experiments/ssg/tooling/islands-comparison/benchmark-pages.py

# Vize専用の依存を準備（親workspaceの依存は変更しない）
mkdir -p .pilot/islands-comparison/vize-deps
cp experiments/ssg/tooling/islands-comparison/compiler-benchmark/dependencies/* \
  .pilot/islands-comparison/vize-deps/
pnpm --dir .pilot/islands-comparison/vize-deps install --ignore-workspace --ignore-scripts --frozen-lockfile

# 元の診断コピーから比較用コピーを作成。すでに作成済みならprepareは不要。
python3 experiments/ssg/tooling/islands-comparison/compiler-benchmark/prepare.py
python3 experiments/ssg/tooling/islands-comparison/compiler-benchmark/benchmark.py

# ブラウザーで最小対照の操作・CSSを比較
node experiments/ssg/tooling/islands-comparison/verify-vue.mjs --compilers
# 固定ページ13条件。vueをvizeに変更して両方を確認する。
HUB_COMPARE_PUBLIC_DIRECTORY="$PWD/.pilot/islands-comparison/compiler-artifacts/vue-pages/vue/public" \
HUB_COMPARE_BROWSER_RESULT="$PWD/experiments/ssg/results/islands-comparison/2026-10-31/vue-pages-vize/browser-vue.json" \
HUB_COMPARE_RECORD_FAILURES=1 \
  node experiments/ssg/tooling/islands-comparison/verify-pages.mjs
```

Vize版の13条件確認は、上記2件の失敗をJSONに記録して終了コード1を返す。生成出力は `.pilot/islands-comparison/compiler-artifacts/{vue-island-css,vue-pages}/{vue,vize}/public/` に保存しており、HTTP配信して動作を確認できる。
