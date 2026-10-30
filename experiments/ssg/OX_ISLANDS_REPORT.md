# Ox主体SSG＋Vue islandsの互換検証

続報：[全追加処理を一括無効化](ISLANDS_COMBINED_REPORT.md)すると、全1,991 URLのSSGは**起動込み中央値2.85秒**。表示・UIを省いた診断用の下限値で、互換版の速度ではない。

追加の[5秒→25秒のコスト診断](ISLANDS_COST_REPORT.md)：クライアント生成・原稿互換処理・サイドバー等のUI生成が主な増加箇所。通常の移行コードを変更せず、処理を外した比較と工程計測を実施した。

PR #2のCustom Host構成を取り込み、Oxが原稿処理とHTML生成を所有し、Vueを補助部品として使う案を`ox-native-islands/`へ追加した。従来の`ox-native/`は比較用に残す。本番移行は含まない。

## 全1,991 URLのSSG計測（2026-10-31）

| 構成 | 1回目 | 2回目 | 3回目 | 中央値 | 30ページVRT |
| --- | ---: | ---: | ---: | ---: | --- |
| Ox主体＋Vue islands（今回） | 26.03秒 | 24.97秒 | 25.07秒 | **25.07秒** | 120/120・144画像一致 |
| 従来Ox native（過去計測） | 55.65秒 | 54.48秒 | 56.00秒 | 55.65秒 | 120/120・144画像一致 |
| 既存Ox単独＋Vue SSR（過去計測） | 34.31秒 | 35.52秒 | 35.63秒 | 35.52秒 | 120/120・144画像一致 |

今回の3回ともHTML **1,991/1,991件**、全対象URL・参照CSS/JS・クライアント本文AST非送信の検証が成功した。型検査も成功。ピークRSS中央値は2943.4 MiB。全件用クライアントは29 JSファイル・1,638,385 bytes、Markdownモジュール0件。

今回の時間はPNPM/Node起動からビルド終了までで、生成物の検証はタイマー外。過去2案は外側のbuild workerと検証を含む記録のため、厳密に同じタイマー境界の対照実験ではない。またスキーマ部品を空にする今回の指定や、全件での互換実装にも違いがある。参考比較として並べ、同等機能での高速化率は主張しない。無改変PR #2の5.37秒は1,343ページ・最小テーマで対象も異なる。

[全件の各回・ソース指紋・互換差分URL・ログハッシュ](results/ox-native-islands/2026-10-31/timings-full.json)。全件VRTは実施していない。30ページ専用構成の合格を、全件構成や全1,991 URLの表示互換率へ読み替えない。

## 30ページVRTの結果

**120/120テスト成功、144/144画像がRGBA完全一致**。基準264ファイルは変更なし。JS例外・hydration警告・ローカル404なし。通常Vue、PC/モバイル×明暗。30ページ構成のクライアントJSは1ファイル196,652 bytes、Markdownモジュールは0件。本文ASTはブラウザーへ送らない。

[検証JSON](results/ox-native-islands/2026-10-31/vrt-30.json)に原稿・実装fingerprint、基準/実画像/manifest/Playwright結果のハッシュを保存した。画像はローカルに保持し、PRには含めない。

## 実装の境界

- `vite.config.ts`：公式`createOxContentCustomHostPlugin`と通常Vueコンパイラ。MarkdownをVueモジュールにする`oxContentVue`は使わない。
- `markdown.ts`：公開APIの`host.markdown.render()`で本文を変換し、コード・MDC部品・脚注等の互換処理をビルド時に補う。原稿単位で結果を共有する。N-APIのコレクションマニフェストはメタデータ取得に使い、query collectionの呼び出しを多用する構成ではない。
- `html.ts` / `theme.ts`：通常Markdownの木とdocsフレームをHTML文字列へ変換。通常本文全体をVueのVNodeにしたり、ブラウザーでhydrateしたりしない。
- `decorations.ts`：既存Vue部品をビルド時の補助として再利用。通知枠・リンク・前後リンク等の静的部品と、hydrateする部品を区別する。Vue SSR自体は補助部品の生成に使う。
- `islands.ts` / `client.ts`：ナビ・目次・MFM・埋め込み等を必要な場所だけhydrateする。メニュー・表・スクロール制御を初期化。Markdownごとのクライアントモジュールと本文ASTを送らない。
- `full-components.ts` / `full-theme.ts`：全件用のYAMLガイド、固定ページ、layout制御。既存Vueの固定ページ本文とレイアウトを補助islandとして再利用するため、これらはVue描画の範囲が大きい。30ページ用クライアントには全件用レジストリを含めない。

既存Nuxt互換レイヤーは共有する。通常Markdownの本文・静的フレームはOx側が所有するが、「Vue SSRが一切ない」「全固定ページも静的テンプレートへ移植済み」という案ではない。MkIndexの説明文、YAML内のMarkdown文字列等には既存MDC処理が残る。

元の原稿・本番Vue部品・VRT基準画像を改変せず、CSS modules/scoped CSSも既存SFCソースから取得する。Nuxtの生成済みHTMLや基準画像をビルド入力へ使わない。

## 検証範囲

30 Markdown URLは既存`tests/vrt/docs.spec.ts`をそのまま使い、PC 1440×900 / モバイル390×844 × 明暗4条件で比較する。通常表示の120条件に加え、details展開とモバイルメニュー等の24状態を撮影する。RGBA・寸法完全一致、意味情報、リンク遷移・テーマ維持、JS例外・hydration警告・ローカル404も検査する。許容差・マスク・基準更新・retry・skipは使わない。

全件は別の`HUB_PILOT_PAGES=all`で、公開URL一覧の1,991 URLを生成・検証する。Markdown 1,434件＋YAML156件を読み、docs 1,365、blog 106、固定287、言語選択・転送用233を出力する。全件のVRTは実行しない。30ページでの合格は、全件設定のCSS/JSや全URLの表示一致を保証しない。

### 全件に残る互換差分

`MkSchemaViewer` / `MkSchemaViewerItemObject`はユーザー指定により空として扱う。現在のリポジトリに実装のない旧部品の参照もあり、全件生成では以下を定義と子要素の静的表示に置き換え、URLと部品名を記録する。

- `x--docs--mi-card--interactive-view`
- `x--docs--mi-card--calculator`
- `x--blog--2023-12-19-mac202319--figure1`

空として扱うスキーマ部品の記録は89 URL、その他の旧部品の静的表示は14 URL（MiCard 13 URLとブログ1 URL）。合計103 URLを記録した。これらを表示互換済みとして扱わない。30ページ範囲の未対応部品やVue SSR例外はビルドを失敗させる。全件HTMLの存在・本文領域・CSS/JS参照・payloadのURL・クライアント本文AST非送信を検証するが、全機能移植の証明ではない。`/ns/`の元Vueページは`children.length`で本文の有無を判定するため、ブラウザーには本文ASTの代わりに`static-html`型の存在マーカー1個を渡し、静的HTMLを`ContentRenderer`互換部品で表示する。

## 再現

```sh
HUB_PILOT_PAGES=30 node experiments/ssg/ox-native-islands/verify-30.mjs
node experiments/ssg/ox-native-islands/benchmark-full.mjs
```

後者は現行ソースの30ページVRT合格を要求する。全件を3回、新規プロセスで順次生成し、各回の後にHTMLとアセットを検証する。起動・Viteクライアントビルド・原稿処理・Ox Custom Hostの描画と出力・publicコピーを含み、出力検証はタイマー外。OSキャッシュは保持し、VRTと同時実行しない。チーム紹介の外部APIは各プロセスで実際に取得し、その待ち時間も含む。

Node22.22.2 / Apple M1 Pro / darwin-arm64、Ox3.4.3 / Vue3.5.25 / Vite7.3.1、通常Vueのみ。Vizeは今回の追加案では測っていない。

## 出典・クレジット

[PR #2](https://github.com/odanado/misskey-hub-next/pull/2)の`c52b733c227aaf5f91341544aebe4c3977800cee`を土台としてコピーし、取り込みと派生実装のコミットに`Co-authored-by: ubugeeei <ubuge1122@gmail.com>`を付ける。PR #2自体は変更しない。

無改変PR #2の5.37秒は最小テーマの1,343ページで、全件・表示互換の速度ではない。[単体計測](PR2_STANDALONE_REPORT.md) / [無改変VRT](PR2_VRT_REPORT.md) / [従来案との差の調査](NATIVE_COMPARISON_REPORT.md)。
