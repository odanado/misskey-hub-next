# 全無効化の最小SSGへVueだけを足した比較

**最小Vue部品を全1,991 URLでSSR・hydrateする構成は、起動込み中央値2.79秒**だった。同じタイミングのVueなしは2.39秒で、差は約0.40秒。クライアントだけにVueを追加した場合は2.58秒で約0.19秒の差だった。

| 条件 | 1回目 | 2回目 | 3回目 | 中央値 | 今回のVueなしとの差 |
| --- | ---: | ---: | ---: | ---: | ---: |
| Vueなし（今回再計測） | 2.65秒 | 2.39秒 | 2.39秒 | **2.39秒** | +0.00秒 |
| Vueコンパイラ＋クライアントの最小SFC | 2.19秒 | 2.60秒 | 2.58秒 | **2.58秒** | +0.19秒 |
| 上記＋全URLで最小Vue SSRとhydration | 2.37秒 | 2.79秒 | 2.87秒 | **2.79秒** | +0.40秒 |

すべてPNPM/Node起動からビルド終了までを計測し、出力検査はタイマー外。3条件×3回、新規プロセスで順次実行。実行順は各roundでローテーションし、OSキャッシュは保持した。Node22.22.2 / Apple M1 Pro / darwin-arm64。前回のVueなし2.85秒と計測時刻が異なるため、追加差の比較には今回の同時期の基準2.39秒を使う。各3回の探索的な値で、小差の統計的有意性は評価していない。実測範囲もVueなし2.39〜2.65秒、クライアントVue2.19〜2.60秒、SSRあり2.37〜2.87秒と重なるので、数百msの差を確定的な回帰値としては扱わない。

## 「Vueだけ」の条件

土台は[全追加処理を無効化した構成](ISLANDS_COMBINED_REPORT.md)。Markdown1,434件をOxの公開Markdown APIでHTML化し、YAML156件を読み、全1,991公開URLとpublicアセットを生成する。MDC/Shiki、HAST互換変換、元サイトのナビ・レイアウト・CSS・翻訳等は省略した状態で測る。

Vueの対象はカウンターボタン1個。Markdown本文はOxの静的HTMLのままで、VueのVNodeを本文全体へ展開しない。

- **クライアントのみ**：公式`@vitejs/plugin-vue`を追加し、`ref`を使う最小SFCとVueランタイムをバンドルする。各HTMLの空のrootに`createApp`でmountする。ビルド中のVue SSRは行わない。
- **SSRあり**：同じSFCを`renderToString(createSSRApp(...))`で1,991回描画し、各HTMLへ埋め込む。ブラウザーでは`createSSRApp`でhydrateする。SSR例外があれば失敗する。
- 両案ともVizeは使わない。クライアントJSは1ファイルで、クライアントのみ58,682 bytes、SSR/hydrationあり63,132 bytes。CSSとMarkdownクライアントモジュールは0件。

この結果はVueの導入・最小部品のコンパイル/SSRに関するもの。元サイトの部品・ナビを移植したときの描画時間は、前回のコスト診断で確認したように追加で発生する。既存表示を復元した構成のSSG時間ではない。

## 検証

全9回で公開HTML1,991件、DOCTYPE/title、出力されたJS参照、SSRありの全HTMLでのボタン存在を確認した。Vueなしとクライアントのみでは、HTML中にSSR済みボタンがないことも確認。原稿・public・元のVue部品/ページ/レイアウト/翻訳/assetsのハッシュが全条件で同一で、診断コードのハッシュも各run前後で不変だった。

計測終了後に実際のChromiumで各Vue案の`/ja/`を表示し、ボタンが`Vue: 0`から`Vue: 1`へ変わることを確認した。JS例外・hydrationエラーなし。これは最小Vue部品の動作検証で、サイトのVRTではない。画像や基準更新は行わない。

通常の移行コード、VRT基準、通常版の生成物、前回の計測記録は保つ。Vueなしの生成物は同じ最小構成で再生成し、各Vue案は専用ディレクトリへ展開する。

```sh
python3 experiments/ssg/tooling/islands-comparison/prepare-vue.py vue-client
python3 experiments/ssg/tooling/islands-comparison/prepare-vue.py vue-island
# combinedコピーが未作成なら先にprepare-combined.pyを実行
python3 experiments/ssg/tooling/islands-comparison/benchmark-vue.py
node experiments/ssg/tooling/islands-comparison/verify-vue.mjs
```

出力は`.pilot/islands-comparison/vue-client/.pilot/full/ox-native-islands/public/`および`.pilot/islands-comparison/vue-island/.pilot/full/ox-native-islands/public/`。準備は`6cbe059`を使い、既存のコピーを上書きしない。

[全9回の数値・ソース指紋](results/islands-comparison/2026-10-31/vue-only/summary.json) / [ブラウザー検証・環境](results/islands-comparison/2026-10-31/vue-only/browser.json) / [生成される最小SFC](tooling/islands-comparison/vue/Button.vue.txt) / [コピーの作成・Vue差分](tooling/islands-comparison/prepare-vue.py)。画像・ログはPRへ含めない。
