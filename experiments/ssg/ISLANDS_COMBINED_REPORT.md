# 全追加処理を一括無効化したSSG

**全1,991 URLの生成は、PNPM/Node起動込みで中央値2.85秒**だった。3回は2.75 / 2.92 / 2.85秒。前回の互換版25.07秒と同じコマンド境界で、生成物の検査はタイマー外。表示・機能を省いた診断用の下限値で、表示互換を保った高速化の結果ではない。

| 計測境界 | 1回目 | 2回目 | 3回目 | 中央値 |
| --- | ---: | ---: | ---: | ---: |
| PNPM起動からビルド終了 | 2.75秒 | 2.92秒 | 2.85秒 | **2.85秒** |
| 前回の工程診断と同じVite import前〜終了 | 2.54秒 | 2.20秒 | 2.24秒 | **2.24秒** |

各3回、新規プロセスで順次実行。Node22.22.2 / Apple M1 Pro / 通常Vueと同じ依存lockfileだが、この構成はVueコンパイラ自体を外している。原稿・診断コードのハッシュを各回の前後で検証した。OSキャッシュは保持する。

## 無効化したもの

- クライアントJS/CSS生成：Vueコンパイラ、全件用部品レジストリ、UnoCSS/Sass/PostCSS、CSS互換処理を外す。Viteが必要とする空のentryは1 byteで、出力HTMLからは参照しない。
- Vue SSRとUIフレーム：ナビ・サイドバー・目次・補助部品・固定ページ本文・YAMLガイドUIを描画しない。
- MDCとShiki：コンポーネントの互換解析、コードハイライトを実行しない。
- Ox HTMLからHAST/互換の木への変換、脚注・リンク等の互換補正、既存形式の目次生成を実行しない。
- UI向けのナビデータ、翻訳、hydration payload、共通SEO/headの組立を省く。それらを支える未使用依存のロードも外す。

単に呼出しを止めて依存のimportを残した構成ではなく、不要なplugin・依存ごと省いた最小の診断用Custom Hostである。[テンプレート](tooling/islands-comparison/combined/host.ts.txt) / [Vite設定](tooling/islands-comparison/combined/vite.config.ts.txt)。

## 残したものと出力内容

- **全1,991公開URL**。前回の「追加649 URL」の生成コストは、full SSGに必要なので残す。
- Markdown **1,434件をすべて**Oxの公開`host.markdown.render()`で変換。VueモジュールやMDCの木を介さず、そのHTMLを出力する。対応しないMDC記法の表示互換は失われる。
- YAML **156件をすべて**読み込む。公開URLに対応するYAMLは原文のpre表示とし、ガイドUI等は省略する。
- Markdown/YAMLに対応しない固定ページ・言語エントリーには、タイトルとUI省略の明示テキストを出す。元のページ本文はない。
- Ox Custom HostのSSGによるHTML保存と、元の**publicアセット750件・65,141,521 bytes**のコピーを行う。

全URLのHTML、DOCTYPE/title、診断用マーカー、公開アセットのバイト一致を検証した。原稿変換1,434回、Vue transform hook 0、MDC呼出し0、CSS出力0、外部contributors API通信0も確認。空のVite entryがHTMLから参照されないことを確認した。

通常版のfull SSGは`.pilot/full/ox-native-islands/public/`へそのまま残す。一括無効化版は`.pilot/islands-comparison/combined/.pilot/full/ox-native-islands/public/`で、通常版や前回の個別診断の出力を上書きしない。通常の移行コード・VRT基準は変更せず、VRTは実行しない。

## 再現

```sh
python3 experiments/ssg/tooling/islands-comparison/prepare-combined.py
python3 experiments/ssg/tooling/islands-comparison/benchmark.py combined 3
python3 experiments/ssg/tooling/islands-comparison/benchmark-combined-startup.py
python3 experiments/ssg/tooling/islands-comparison/verify-combined.py
```

準備は`6cbe059`を独立展開し、診断用host/configへ置換する。既存のコピーは上書きしない。Nuxt prepareは不要。画像・ログ・生成物はPRに含めず、数値JSONと再現用テンプレートを保存する。

[PNPM込みの各回](results/islands-comparison/2026-10-31/combined-startup/summary.json) / [工程診断の各回](results/islands-comparison/2026-10-31/combined/summary.json) / [生成物検証](results/islands-comparison/2026-10-31/combined/verification.json) / [前回の個別コスト診断](ISLANDS_COST_REPORT.md)。各処理を省いた差を足し合わせる代わりに、同時に外した実装を実測した値である。
