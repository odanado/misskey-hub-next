# 最小Vue SSR構成へCSS生成を追加

**CSS生成を加えたfull SSGは起動込み中央値4.71秒**だった。同じ時期・同じ条件のCSSなしは2.66秒で、追加は約2.05秒。両案とも全1,991 URLの生成が各3回成功した。

| 条件 | 1回目 | 2回目 | 3回目 | 中央値 | 生成CSS |
| --- | ---: | ---: | ---: | ---: | ---: |
| Vue SSR＋hydration・CSSなし | 2.66秒 | 2.74秒 | 2.66秒 | **2.66秒** | 0 bytes |
| 上記＋CSS生成 | 4.91秒 | 4.55秒 | 4.71秒 | **4.71秒** | 148,552 bytes |

PNPM/Node起動からビルド完了までを計測し、HTML/CSS/アセット検査とブラウザー確認はタイマー外。各roundで2条件の順序を交替し、各3回を新規プロセスで実行した。OSキャッシュは保持。Node22.22.2 / Apple M1 Pro / 通常Vue。前回のCSSなし2.79秒とは計測時刻が異なるため、差には今回の2.66秒を使う。

## 生成対象

UIは前回と同じカウンターSFC1個を全1,991 URLでSSR・hydrateする構成。Markdown本文はOxの静的HTML、YAMLは原文表示、元サイトのナビ・レイアウト・MDC/Shiki・HAST互換処理は省略した診断条件で、VRTは行わない。

CSSは小さなボタンだけでなく、以下を生成した。

- 既存共通CSS：Tailwind reset、global.css、GitHub Markdown、nprogress、MFM SCSS、Bootstrap forms SCSS、ScrollHint。
- **UnoCSS**：元のuno.config.tsを使い、components/pages/layouts/実験SFCのクラスを走査。`@apply` / `@screen`も展開。
- **既存SFCのstyle**：components/pages/layoutsとNuxt ContentのProsePre/ProseCode/ProseCodeInlineを走査し、非空のstyle **52ファイル・56ブロック**を生成。内訳はCSS modules40、scoped13、SCSS5（これらの分類は重なる）。
- **Sass、PostCSS/autoprefixer＋cssnano**：既存の本番CSS設定と同じ処理を適用。
- 最小SFCにもSCSSのCSS moduleを1ブロック追加し、SSR/クライアント双方のclass解決と実際のスタイル適用を検査した。

生成CSSは1ファイル **148,552 bytes（約148.6 KB）**。JSはCSSなし63,132 bytes、CSSあり63,314 bytes。各HTMLのheadから生成CSSを参照する。既存UIのscript/templateは読み込まず、style queryを直接importすることでCSS追加の影響を分けた。

この対象範囲は「既存共通CSS＋指定SFC style」で、全互換版のクライアント依存・外部UIライブラリまで含めたCSS出力との同一性を確認したものではない。既存ページの表示互換を復元したSSG時間としては扱わない。

## 検証

- 全6回でHTML1,991件、DOCTYPE/title、最小Vue SSRボタン、JS参照を確認。CSSありでは全URLのstylesheet参照も検査。
- 生成CSSにMarkdown/Bootstrap forms/UnoCSS/既存docsレイアウトCSS moduleの代表セレクターがあり、未処理の`@apply` / `@screen`がないことを確認。
- 両案とも元のpublicアセット750件・65,141,521 bytesがバイト一致。原稿や既存サイトの元ファイルのハッシュも一致し、診断コードの指紋を各run前後で照合。
- 計測後、ChromiumでCSSをHTTP200で取得し、ボタンの色・背景色・角丸7pxのcomputed styleを確認。SCSS/CSS modulesの実適用、カウンター0→1、JS/hydrationエラーなしを確認。
- 通常の移行コード・VRT基準は変更しない。通常版の生成物は保持し、CSS版は専用コピーへ出力する。

## 再現と配置

```sh
# CSSなしコピーが未作成なら先に実行
python3 experiments/ssg/tooling/islands-comparison/prepare-vue.py vue-island
python3 experiments/ssg/tooling/islands-comparison/prepare-vue.py vue-island-css
python3 experiments/ssg/tooling/islands-comparison/benchmark-vue.py --css
node experiments/ssg/tooling/islands-comparison/verify-vue.mjs --css
```

CSS版の出力先は`.pilot/islands-comparison/vue-island-css/.pilot/full/ox-native-islands/public/`。準備は6cbe059を独立展開し、既存コピーを上書きしない。Nuxt prepareは実行せず、既存のCSS import一覧のみのstyles.tsを同内容の.mjsとして読み、CSSとは無関係なNuxt生成TS設定への依存を省く。

[全6回の値・入力指紋](results/islands-comparison/2026-10-31/vue-css/summary.json) / [CSS・public検証](results/islands-comparison/2026-10-31/vue-css/assets.json) / [Chromiumでの実適用](results/islands-comparison/2026-10-31/vue-css/browser.json) / [CSS生成プラグイン](tooling/islands-comparison/vue-css/styles.mjs) / [CSSだけを追加する差分](tooling/islands-comparison/css_setup.py)。数値と再現コードをGit管理し、画像・ログ・生成物はPRへ含めない。
