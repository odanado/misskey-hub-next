# Ox主体＋Vue islandsの追加コスト診断

通常の移行コードは変更せず、`6cbe059`（VRT合格済みislands案）とPR #2の`c52b733`を`git archive`で独立展開する。依存は同一lockfile・rootのnode_modulesを共有。`prepare.py`の各置換は1件一致を要求する。コピーへだけフックを挿入し、全ファイルのハッシュを`diagnostic-source.json`へ保存、計測の前後に照合する。Nuxt prepareはislands案だけ計測外で実行する。

```sh
python3 experiments/ssg/tooling/islands-comparison/prepare.py islands
python3 experiments/ssg/tooling/islands-comparison/prepare.py pr2
python3 experiments/ssg/tooling/islands-comparison/benchmark.py full 3
python3 experiments/ssg/tooling/islands-comparison/benchmark.py pr2 3
python3 experiments/ssg/tooling/islands-comparison/benchmark.py md-only 3
python3 experiments/ssg/tooling/islands-comparison/benchmark.py no-client 3
python3 experiments/ssg/tooling/islands-comparison/benchmark.py no-theme 3
python3 experiments/ssg/tooling/islands-comparison/benchmark.py no-shiki 3
python3 experiments/ssg/tooling/islands-comparison/benchmark.py static-links 3
python3 experiments/ssg/tooling/islands-comparison/benchmark.py cpu 1
python3 experiments/ssg/tooling/islands-comparison/benchmark.py full-end 3
node experiments/ssg/tooling/islands-comparison/snippet-stats.mjs
python3 experiments/ssg/tooling/islands-comparison/summarize.py
```

各計測は順次実行。既存コピーがある場合prepareは上書きしない。診断結果は`results/islands-comparison/2026-10-31/`、CPU生データは`.pilot/islands-comparison/islands/profile.cpuprofile`、画像・ログ・生成物はGitに含めない。

| ケース | 残すもの／省くもの |
| --- | --- |
| full | 25秒版の全1,991 URL。フック以外は通常実装と同じ |
| pr2 | PR #2の1,342 Markdown URL＋索引。フック以外は元実装と同じ |
| md-only | fullから出力URLだけを同じ1,342 Markdownへ絞る。全原稿準備・全件用クライアントは維持 |
| no-client | fullのクライアントエントリーを微小なCSS importだけにする。SSRとデータは維持。ブラウザー操作・スタイルの互換は成立しない |
| no-theme | 通常Markdown本文生成は維持し、`fullTheme`によるフレーム・Vue UI・固定ページ/YAMLの描画を省く。head/payload出力は維持 |
| no-shiki | MDCのrehype highlightプラグインだけを外す。MDC構文解析、他の原稿互換処理、クライアント/UI描画は維持 |
| static-links | 本文のProseAだけVue補助から単純なaタグへ置換。その他のUI/Vue描画は維持 |
| full-end | 一連の計測後にfullを再度3回実行し、時間変動を確認 |
| cpu | fullと同じ機能の追加1回でV8 CPUサンプルを収集。通常3回の中央値に入れない |

処理を省くケースは原因調査用であり、VRT合格済みの移行案ではない。VRTを実行したり基準を更新したりしない。各ケースで出力件数・DOCTYPE/title・例外ログを確認し、no-theme以外は各元verifierも計測外で実行する。no-themeは意図的に本文領域や固定ページを省くため、構造検査のみ。

`buildSeconds`はVite import前からawaitしたbuildの完了まで。同じrunner・通常Vueで揃える。PNPM/Node起動・計測後の出力列挙・検証は除外する。過去の5.37秒/25.07秒とは計測境界が違う。OSキャッシュは保持、外部contributors APIは実取得。CPUは自プロセスのみで子プロセスを含まない。

工程表は総時間が中央値だった**実際の1回**の、重ならない区間を使う。非同期transformフックとMDC各snippetの時間は並行処理・親子の重なりがあるため足さない。各処理を外した差も相互作用があり、合計しない。

## 全追加処理の一括無効化

`combined`は専用コピーへ最小host/configを入れ、クライアント・UI・MDC/Shiki・HAST互換処理と未使用依存をまとめて外す。全1,991 URLと全Markdown/YAML処理・publicコピーを残す。固定UIは省略、YAMLは原文表示。

```sh
python3 experiments/ssg/tooling/islands-comparison/prepare-combined.py
python3 experiments/ssg/tooling/islands-comparison/benchmark.py combined 3
python3 experiments/ssg/tooling/islands-comparison/benchmark-combined-startup.py
python3 experiments/ssg/tooling/islands-comparison/verify-combined.py
```

[同時無効化の条件と結果](../../ISLANDS_COMBINED_REPORT.md)。通常版と個別診断の出力は保持し、combined専用の出力先を使う。通常verifierは意図的なUI省略のため適用せず、専用の構造・アセット検査を使う。

## Vueだけを足す比較

`prepare-vue.py vue-client` / `prepare-vue.py vue-island`で専用コピーを作る。原稿はOxの静的HTMLのまま、公式VueコンパイラとカウンターSFC1個を足し、クライアントのみと全URLでのSSR/hydrationを分ける。`benchmark-vue.py`はVueなしも含め各3回を順番を交替して計測、`verify-vue.mjs`は計測後にブラウザーでクリック動作を検証する。詳細は[Vue追加のレポート](../../ISLANDS_VUE_REPORT.md)。

## CSS生成を追加

`prepare-vue.py vue-island-css`は最小SSR版に既存共通CSS、UnoCSS、Sass、PostCSS、既存SFC style/CSS modulesを追加する。`benchmark-vue.py --css`でCSSなし/ありを交互に各3回計測し、`verify-vue.mjs --css`でCSS取得・computed style・Vueのクリックを確認する。既存UIのscript/templateを取り込まずstyle queryだけを生成する。[CSS追加レポート](../../ISLANDS_CSS_REPORT.md)。

## 既存Vue固定ページを復帰

`prepare-pages.py`で6cbe059から独立コピーを作り、`vue-pages/`のテンプレートと専用Nuxt互換パッチを適用する。287 URLで元の23 Vueページとレイアウト・クライアント処理を再利用し、233言語エントリーには転送を追加する。通常の移行コードは変更しない。Markdownはraw Ox、YAMLは原文表示のまま。

`benchmark-pages.py`は準備済み`vue-island-css`と`vue-pages`を交互に各3回計測し、1,991 HTMLと分類・JS/CSSを検査する。`verify-pages.mjs`はビルド後の代表13条件をChromiumで確認する。外部APIのCORS警告も保存し、VRTと区別する。[条件・再現手順・数値](../../ISLANDS_VUE_PAGES_REPORT.md)。
