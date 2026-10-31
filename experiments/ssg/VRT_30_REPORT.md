# 30ページVRTの互換修正

追加のOx主体＋Vue islands案も、通常Vueで120/120テスト・144/144画像が完全一致した。元Nuxt基準は不変。従来の8構成とは別の追加案で、[構成と全件計測の条件](OX_ISLANDS_REPORT.md)を参照。

初期4ページを含む日英30 Markdownページで、Nuxt基準・Ox単独・Astro＋MDC・Astro＋Oxの通常Vue/Vizeを比較した。ローカルのdarwin-arm64環境では、8構成とも**120/120テスト成功、144/144画像がRGBA完全一致**した。合計960テスト・1,152画像。対象は[ページ一覧](shared/pages-30.mjs)と[初期4ページ](shared/pilot-pages.mjs)を参照。

| 構成 | テスト | 画像の完全一致 | 合格率 |
| --- | ---: | ---: | ---: |
| Nuxt・通常Vue | 120/120 | 144/144 | 100% |
| Nuxt・Vize | 120/120 | 144/144 | 100% |
| Ox単独・通常Vue | 120/120 | 144/144 | 100% |
| Ox単独・Vize | 120/120 | 144/144 | 100% |
| Astro＋MDC・通常Vue | 120/120 | 144/144 | 100% |
| Astro＋MDC・Vize | 120/120 | 144/144 | 100% |
| Astro＋Ox・通常Vue | 120/120 | 144/144 | 100% |
| Astro＋Ox・Vize | 120/120 | 144/144 | 100% |

PC 1440×900 / モバイル390×844 × 明暗4条件。全文、5ページのdetails展開、モバイルのメニュー・目次に加え、見出し・リンク・画像・コード・SEOの意味情報、リンク遷移とテーマ維持、JS例外・hydration警告・ローカル404を確認した。

## 修正内容

- **Oxの原稿切り出し**: MFMの複数行属性内にあるコードフェンスを、外側のMarkdownコードと誤認していた。コンポーネント全体を先に切り出し、実際のコード例内のタグやコンテナ記法を保護した。MFMの属性値・見出し・コード例が既存MDCと一致し、Ox経路の30ページを丸ごとMDCへフォールバックしていないことも確認した。
- **CSS処理**: Nuxtと同じautoprefixer/cssnanoを共通のVite境界に適用した。ScrollHintのSVG data URIが最適化される精度の違いが、表の案内アイコンの微小な描画差分を生んでいた。最適化後のSVGがNuxtと一致することを確認した。
- **撮影条件**: MFMの時計を止めてからアニメーションの状態を固定する。ブラウザーの全文撮影によるレイアウト変化が落ち着くまで、最大5秒の範囲で連続2フレームのRGBA完全一致を要求する。許容差・マスク・テスト全体のretryは追加していない。動きそのものの検証は含めない。

基準は元Nuxtから作り直して固定した。中断前の144画像・120意味情報ファイルのハッシュから**変更なし**（[保存確認](results/30/baseline-preservation.json)）。候補の表示に合わせた基準画像の更新はしていない。

全Markdown1,434件のOx解析スモークチェックも成功した。ただし、この確認は全件の表示一致や全件SSG完走の代用ではない。

## Linux CIに残る差分

Ubuntu 24.04ではNuxt・Nuxt＋Vizeは各120/120成功したが、通常Oxの日本語embed/OAuthページのPC明暗4ケースで、コードブロック末尾の水平1pxに差分が残る。CIは通常Oxで停止するため、後続5構成のLinux上での成功は未確認。上表の100%はdarwin-arm64の結果である。

[診断CI](https://github.com/odanado/misskey-hub-next/actions/runs/41040912480)では、pre/codeのcomputed CSS（カスタムプロパティを除く）、寸法、スクロール幅が一致した。embedページは同じ1440×4537画像のうち、2本の水平1px行・計1,396画素に差があった。原因は未確定。マスクや許容差による除外は行っていない。

## 再現・証拠

```sh
pnpm pilot:30:baseline
pnpm pilot:30:build
pnpm pilot:30:verify
HUB_PILOT_PAGES=30 node experiments/ssg/tooling/repros/markdown-compat.mjs
```

- [8構成の集計](results/30/vrt.json)、[基準ハッシュ](results/30/baseline.json)、[全Markdown解析チェック](results/30/parser-smoke.json)
- [30ページCI](../../.github/workflows/ssg-30-vrt.yml): 同じOSで元Nuxtの基準を生成し、8構成を比較する。Playwright 1.58.2に対応するUbuntu 24.04を指定。

CIではSSRの`TZ`もブラウザーと同じ`Asia/Tokyo`に固定する。既存のTime.vueはタイムゾーンを明示しない絶対日時表示を行うため、UTCのビルド環境とJSTのブラウザーの組み合わせでは、元Nuxt自身のMFMサンプルにhydration不一致が出る。警告を無視せず、比較環境の日時条件を揃えている。

集計処理が参照していた旧i18n設定パスを修正した。全テスト成功後の保存失敗だったため、保存済みの8構成の結果・画像数・基準ハッシュを再検査して集計を回収した。

画像はPRに含めず、ローカル/CI artifactで保持する。この30ページの合格率は全公開1,991 URLの合格率ではない。全件の比較はPC・ライトの1条件で別に実施する。
