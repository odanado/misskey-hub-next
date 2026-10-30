# Ox native：PR #2方式の互換パイロット

速度差を追加調査し、クライアント生成・本文の重複変換・Vue/MDC描画が大きいことを確認した。[PR #1 / #2の工程別比較と省略実験](NATIVE_COMPARISON_REPORT.md)を参照。下記のVRT・ベンチ記録はそのまま保持する。

## 追記：PR #2単体の無改変計測（2026-10-31）

PR #2のhead `c52b733`を独立したチェックアウトで測り、全5回が1,343ページの生成・検証に成功した。こちらのM1 Pro / Node22では **5.28 / 5.62 / 5.30 / 5.37 / 5.44秒、中央値5.37秒**、ピークRSS中央値600.25 MiBだった。PR #2単体は数秒で動く。下記の55.65秒は、同じプラグイン構成に1,991 URL・既存表示の互換処理を追加した別の実装の時間である。

対象・方法・生データは[PR #2単体レポート](PR2_STANDALONE_REPORT.md)。この最小テーマには既存表示とのVRT一致を求めていないため、1,991 URLの互換実装と直接の優劣比較には使わない。

[PR #2](https://github.com/odanado/misskey-hub-next/pull/2)（ubugeeei氏、参照head `c52b733`）の公式Vueプラグイン＋Custom Hostを土台に、既存の表示・操作を接続した。30ページVRTは120テスト・144画像が全合格。その後の全公開1,991 URLのSSGも各3回成功した。**全件VRTは依頼どおり実行していない。**

| 構成 | 1回目 | 2回目 | 3回目 | 中央値 | 30ページVRT |
| --- | ---: | ---: | ---: | ---: | ---: |
| Ox native（公式Vueプラグイン＋Custom Host） | 55.65秒 | 54.48秒 | 56.00秒 | **55.65秒** | 120/120・144画像一致 |
| 既存Ox単独（N-API＋Vue SSR＋Ox SSG） | 34.31秒 | 35.52秒 | 35.63秒 | **35.52秒** | 120/120・144画像一致 |

今回の互換実装ではOx nativeが対照より約56.7%長くかかり、SSG速度の優位は得られなかった。この差は移植コードとその追加処理を含むもので、Ox Contentのパーサー単体や最小テーマの性能差とは扱わない。

## 対象と計測条件

- 全公開1,991 URL（docs 1,365 / blog 106 / 固定287 / 言語エントリー233）を各回で生成・存在/非空確認した。Markdown1,434件・YAML156件を共通データ準備で処理する。
- 両案ともOx N-API / Viteプラグイン3.4.3、通常Vue3.5.25、Vite7.3.1。Node v22.22.2、Apple M1 Pro、darwin-arm64。依存の違いを避けるため、既存Ox単独も同時に測り直した。
- native→対照の順に3回ずつ順次実行。各回で出力・メタデータcacheを削除。依存再インストール・OSファイルキャッシュの消去は含めない。VRTや別ビルドは計測と同時に実行していない。
- 子プロセス起動、全件データ準備、コンパイル、SSR、CSS/JS/HTML、publicアセットコピー、公開URLの出力検査を含む。追加の全文書・CSS参照検査は計測後に別実施した。
- Nodeのヒープ上限は変更せず、取得値は4,345,298,944 bytes（約4 GiB）。開始・終了時と現在のソース指紋を照合した。全6回でSSR例外・未解決コンポーネント・未処理例外の検出は0。今回の2案はどちらもSSR例外を明示収集する。
- 完成サイト全体の機能同等性は未確認。共通互換層には既知のquery条件・前後リンク・クライアントfetch・言語エントリー処理の不足が残る。30ページ専用と全件ではデータ準備経路も異なるため、全件の表示一致や本番移行完了を示す値ではない。

従来の8構成の表はOx 3.4.0・各1回の別計測として[全件SSGレポート](FULL_SSG_REPORT.md)に保持した。今回の値で過去のJSONを上書きしていない。

## 30ページVRT

日英30ページ × PC1440×900 / モバイル390×844 × 明暗の4条件。元Nuxtから固定済みの144 PNG・120意味情報ファイルを使用し、全RGBA画素・寸法の完全一致、SEO・見出し・リンク・画像・コードの意味情報、details/メニュー/目次、リンク遷移、テーマ変更と保持、JS例外・hydration警告・ローカル404を確認した。

Ox native・更新後の対照とも120/120テスト・144/144画像が合格。許容差・マスク・retry・基準の更新を加えていない。基準264ファイルのハッシュは不変。外部通信遮断・共通絵文字キャッシュ・MFMの動きの固定は既存VRTと同じ条件である。

この結果はdarwin-arm64での検証。新しいLinux CIの結果は別途確認が必要で、既存の30ページCIにはコードブロック末尾の1px差分が残っていた。本レポートの100%をLinuxや全1,991 URLの合格率へ読み替えない。

## PR #2から採用した部分と追加した処理

PR #2はMarkdownをVueモジュールとして読み込み、ViteとCustom HostにSSG・アセット解決を任せる小さな参照実装である。内部ではVue SSRを使用する。Markdown由来1,342 URL＋索引、静的テーマ、client hydrationなしのスコープで、既存Nuxt/MDC互換やVRT一致は対象外と明記されている。

PR記載の3.972秒中央値はM2 Max / Node26での別条件であり、今回の55.65秒と直接比較しない。こちらは1,991 URL・既存Vue部品・MDC/Shiki互換・ブラウザー動作を含む。

採用したのは`vue()`＋`oxContentVue()`＋`createOxContentCustomHostPlugin()`の組み合わせ、`ctx.loadModule()`によるMarkdownモジュールの読み込み、manifest helperによるCSS解決、SSRエラーの伝播である。一時MarkdownコピーやSSGフックの手動実行は行わない。共通UnoCSS/SSR loaderのwatcherが残るため、Viteのawait済みbuild処理後にworkerを終了させる。

表示互換のため、次を追加した。

- 元のレイアウト・ヘッダー・サイドバー・注記・表・MFM等を[共通Nuxt互換層](nuxt-compat/README.md)で再利用し、ページごとのMarkdownモジュールをhydrateする。full出力のclient manifestには1,247個のMarkdownモジュールが含まれた。
- MDCコンポーネントとコードの島を変換前に抽出し、公式Vueプラグインが変換した本文HTMLを共通MDC ASTへ接続する。コード/AiScriptは既存Shiki、特殊コンポーネントは既存Vue部品を使う。
- Vueプラグインの脚注定義が本文中へ出る差を、末尾のsemantic endnotesへ正規化した。
- 本文ASTをページJSONへ重複して埋め込まず、コンパイル済みMarkdownモジュールに保持する。SSG HTMLには実際の本文がある。TOCと非空本文の条件は維持する。

## メモリ不足への対応

最初のフル試行は約4 GiBのヒープ上限で停止した。83.93秒・公開HTML0件であり、完走時間から除外する。[失敗記録](results/ox-native/2026-10-30/initial-heap-limit/failure.json)を残した。

互換層が巨大なASTをJSオブジェクトリテラルとして生成していたため、JSON文字列を保持してmodule読み込み時に復元する形へ変更した。Viteが解析するJSノード数を減らし、同じヒープ条件で全件が完走した。変更後に30ページVRTを再実行し、120テスト・144画像の一致を再確認してから本計測を行った。ピークRSSは今回測っていない。

## 評価と次の候補

現在の実装はメタデータ準備で本文を解析した後、公式VueプラグインでもMarkdownモジュールを変換しており、処理の重複が残る。さらに全公開Markdownのclientモジュール生成とMDC ASTへの橋渡しを行う。これらの内訳は未profilingで、約57%の差を特定の処理のせいと断定しない。

SSG時間だけなら今回の対照案が有利。公式プラグインへSSG管理を寄せる保守面の利点はあるが、参照実装の小ささが表示互換込みでもそのまま維持されるという結果ではない。次に速度を詰めるなら、メタデータと本文変換の共有、必要なclientデータ量、Markdownモジュールの変換/SSR時間を分けて計測する。

互換アダプターはVueプラグイン3.4.3の生成JS中の`rawHtml`を読むため、内部出力形式へ依存する。形が変われば失敗させ、別parserへ黙って戻さない。将来は公開transform hook等への置き換えを検討する。固定したVite7.3.1/Vue3.5.25はプラグインの宣言peer範囲（Vite `^0.2.8 || ^8.0.0` / Vue `^3.5.43`）とも異なるため、本番採用時には依存整合も要確認である。

## 再現と証拠

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm pilot:ox-native:check
pnpm pilot:ox-native:30:verify
pnpm pilot:full:measure --modes=ox-native,ox-ported --runs=3 --output-dir=experiments/ssg/results/ox-native/2026-10-30/final
HUB_PILOT_PAGES=all pnpm pilot:ox-native:verify
```

[コード入口](ox-native/README.md) / [統合JSON](results/ox-native/2026-10-30/comparison.json) / [全6回の生データ](results/ox-native/2026-10-30/final/timings.json) / [native VRT・基準ハッシュ](results/ox-native/2026-10-30/vrt-30.json) / [対照VRT](results/ox-native/2026-10-30/control-vrt-30.json) / [依存と出力検査](results/ox-native/2026-10-30/checks.json)。画像はPRに含めず、ローカル/CI artifactで保持する。新規TSの型検査は成功したが、既存Nuxt全体のstrict typecheckを保証するものではない。
