# 既存Vue固定ページを復帰したfull SSG

続報：[当時の約7秒増を再確認しVizeと比較](ISLANDS_VUE_PAGES_VIZE_REPORT.md)。元の構成の増加分は6.99秒を再現。4条件比較では通常Vue6.74秒 / Vize6.62秒で、大きな短縮は確認できなかった。以下は当初の記録を保持する。

**既存Vue固定ページを省略せずに含めると、全1,991 URLのSSGは起動込み中央値11.52秒**だった。同時期に再計測した最小Vue＋CSS版は4.85秒で、追加は約6.67秒。両構成とも各3回、全URLのHTML生成に成功した。

| 条件 | 1回目 | 2回目 | 3回目 | 中央値 |
| --- | ---: | ---: | ---: | ---: |
| 最小Vue＋CSS（固定ページ本文は省略） | 5.26秒 | 4.85秒 | 4.59秒 | **4.85秒** |
| 既存Vueページ・レイアウト・クライアント処理を復帰 | 11.84秒 | 11.52秒 | 11.29秒 | **11.52秒** |

通常Vue、Ox 3.4.3 / Node22.22.2 / Apple M1 Pro。PNPM/Node起動からビルド完了までを計測し、出力検証・ブラウザー確認はタイマー外。各roundで2条件の順序を交替し、新規プロセスで各3回実行。OSキャッシュは保持し、Nuxt prepareは従来の互換版と同じくタイマー外で実行した。以前のCSS版4.71秒との差分には今回の4.85秒を用いる。

## 今回の対象と、過去の条件との違い

| 実験 | 既存Vue固定ページ本文 |
| --- | --- |
| 従来の全件Nuxt／Ox単独／Astro各案 | 対象に含む。移植版の表示・操作互換には未完了箇所あり |
| PR #2単体の約5秒版 | 対象外。Markdownと索引のみ |
| 30ファイルのVRT | Markdownのみ。トップ等の固定ページは対象外 |
| 全処理無効化2.85秒 → 最小Vue2.79秒 → CSS4.71秒 | URLは生成するが、元の固定ページ本文は省略 |
| 今回11.52秒 | 下記287 URLで元のVueページを使用 |

今回の全1,991 URLの内訳：

- **固定ページ287 URL、元のVueページ23ファイル**。うち261 URLは本文をSSR、26 URLは元から`*.client.vue`のshare / mi-webで、クライアント側にマウントする。トップ、サーバー一覧、docs索引、ツール、ブランド素材、沿革、チーム、問い合わせ、ブログ一覧、ns等と元のレイアウトを使用。
- **言語エントリー233 URL**。言語選択リンクに加え、Cookie・ブラウザー言語・生成済みの転送先に応じた転送を追加。クエリとハッシュを引き継ぐ。
- **docs／blog本文1,471 URL**。前回と同じ診断条件を維持し、MarkdownはOxのHTML、YAMLは原文表示。MDC/Shiki、通常ドキュメントのフレーム・サイドバー、YAMLのステップガイドUIは復帰していない。

Markdown1,434件とYAML156件を全件読み、publicアセット750件・65,141,521 bytesもコピーする。FAQやnsで使う原稿HTML、ブログ一覧、言語別ナビゲーション、翻訳・日付表示、非同期データも接続した。Nuxt APIは独立コピー内の互換レイヤーで提供し、Nuxtアプリ全体を移植したものではない。

## 追加した処理と生成物

既存SFCのtemplate/scriptとレイアウト、関連コンポーネントのコンパイル、固定ページSSR、hydrate、クライアント専用ページ、メタ情報・強制カラーモード、FAQの開閉やツール入力などのクライアント処理を復帰した。非同期データとfetch結果はHTMLに保存してhydrate時に再利用する。contributors APIは毎プロセス実取得し、30名分を確認。モックは使っていない。

| 生成物 | 最小Vue＋CSS | 既存Vueページ復帰 |
| --- | ---: | ---: |
| JS（非圧縮、manifest内） | 63,314 bytes / 1ファイル | 1,613,308 bytes / 29ファイル |
| CSS（非圧縮、manifest内） | 148,552 bytes / 1ファイル | 216,096 bytes / 9ファイル |
| 最大RSS（3回の範囲） | 約484〜491 MB | 約1,443〜1,669 MB |

差の6.67秒には**クライアント依存の生成、追加CSS、データ準備・API取得、SSR**がまとめて含まれる。Vue SSRだけのコストとは解釈できない。Markdownごとのクライアントモジュールは生成しない。

25.07秒のVRT互換版とは、Markdown描画・ドキュメントUI・YAML等の条件が異なる。今回11.52秒を表示互換版の高速化率として扱わない。

## 検証と限界

全6ビルドで1,991 HTML、stylesheet参照、生成JS/CSSを検査した。今回の復帰版では省略マーカーが全URLから消え、287 URLの元ページファイル・261 SSR／26クライアント専用の分類を照合。元のcontent/public/pages/layouts/localesのハッシュは比較案と一致し、各案のソース指紋も全計測の前後で一致した。

Chromiumで13条件を確認した：トップPC／モバイル、ルートから日本語への転送、サーバーページ、docs索引、日英の共有リンク生成ツール、問い合わせFAQ、ブログ一覧、チーム、ns、shareとmi-web。入力→共有URL・MFMプレビュー、FAQ開閉、記事リンク、クライアント専用ページのマウントを確認。**未捕捉JS例外・収集したVueエラー・hydrationエラー・ローカルHTTP失敗は0件**。元のサーバーページ自体は現在メンテナンス表示であり、その本文を出している。

ただしlocalhostからの`misskey.io/api/emojis`、`instanceapp.misskey.page`の補助APIには実際のCORSエラーが出た。独立コピー内で絵文字初期化とモバイルトップの補助取得の失敗を処理し、既定値で表示・操作を続ける。外部データを使うウィジェット全ての正常表示は確認できていない。エラーを消すためのAPIモックや固定データは使っていない。

Nuxt prepareが生成する翻訳者一覧は空であり、そのデータの表示も本番相当とはいえない。元のpages/layoutsは変更せず、補助差分はこの生成ファイルと上記2箇所に限定し記録した。**今回のブラウザー確認はVRTではなく、全件または30ページの画像一致・Nuxtの全機能の移植完了を保証しない。**

通常の移行コードとVRT基準264ファイルは変更していない。調査中に一度通常版の出力先を再生成したため、生成件数1,991と既存クライアントmanifest一致も再確認し、その事実をpreservation.jsonに残した。

## 再現と出力先

準備済みコピーは上書きしない。リポジトリrootから実行する。

```sh
# 比較用CSSコピーがまだない場合
python3 experiments/ssg/tooling/islands-comparison/prepare-vue.py vue-island
python3 experiments/ssg/tooling/islands-comparison/prepare-vue.py vue-island-css
# 今回の復帰版を準備・ビルド
python3 experiments/ssg/tooling/islands-comparison/prepare-pages.py
(cd .pilot/islands-comparison/vue-pages && HUB_PILOT_PAGES=all NODE_ENV=production HUB_VUE_COMPILER=vue pnpm pilot:ox-islands:build)
node experiments/ssg/tooling/islands-comparison/verify-pages.mjs
python3 experiments/ssg/tooling/islands-comparison/benchmark-pages.py
```

復帰版は`.pilot/islands-comparison/vue-pages/.pilot/full/ox-native-islands/public/`へ生成する。このディレクトリをHTTP配信して確認できる。

```sh
python3 -m http.server 4174 --directory .pilot/islands-comparison/vue-pages/.pilot/full/ox-native-islands/public
# http://localhost:4174/ja/
```

[計測6回・指紋](results/islands-comparison/2026-10-31/vue-pages/summary.json) / [23ファイル・287 URL対応表](results/islands-comparison/2026-10-31/vue-pages/coverage.json) / [ブラウザー13条件と外部警告](results/islands-comparison/2026-10-31/vue-pages/browser.json) / [生成アセット](results/islands-comparison/2026-10-31/vue-pages/assets.json) / [通常版・VRT基準の保全確認](results/islands-comparison/2026-10-31/vue-pages/preservation.json) / [準備コード](tooling/islands-comparison/prepare-pages.py)。画像・ログ・生成物はPRへ含めない。
