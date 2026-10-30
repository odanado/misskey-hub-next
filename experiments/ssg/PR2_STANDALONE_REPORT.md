# PR #2単体のSSG再計測

PR #2のhead `c52b733c227aaf5f91341544aebe4c3977800cee`を変更せずに実行した。このM1 Pro / Node22環境では**中央値5.368秒**で、全5回が1,342 Markdown URL＋索引＝**1,343ページ**の生成・検証に成功した。

| 回 | 起動込みビルド時間 | ピークRSS |
| --- | ---: | ---: |
| 1 | 5.280秒 | 609.72 MiB |
| 2 | 5.624秒 | 660.16 MiB |
| 3 | 5.301秒 | 600.25 MiB |
| 4 | 5.368秒 | 598.47 MiB |
| 5 | 5.435秒 | 588.45 MiB |

中央値のピークRSSは600.25 MiB。`/usr/bin/time -l`のmaximum resident set sizeを使用した。PR記載の3.972秒・661.86 MiBはM2 Max / Node26.10.0、コミット`5f08a5f`での値であり、マシン・Node・headが異なる。こちらで確認した結論は「PR #2単体は約5.4秒で完走する」である。

## 分離と条件

- `git archive`でPRのコミットを`.pilot/pr2-standalone/`へ展開。現在の互換実装を混ぜず、元の`vite.config.ts`・`host.ts`・`App.vue`とpackage scriptsをそのまま使用した。
- 元の3,241 tracked files（約85 MB）のハッシュを開始・各回・終了時に照合し、変更なしを確認した。Nuxt prepareや事前生成HTMLを用意していない。
- PR #2のlockfileと現在のlockfileのSHA-256が一致したため、node_modulesだけをsymlinkで共有した。ソースと出力は分離。Ox各パッケージ3.4.3、Vue3.5.25、Vite7.3.1、Node v22.22.2、Apple M1 Pro、Darwin-arm64。
- 標準の`pnpm pilot:ox-native:build`を5つの独立プロセスとして順次起動。PNPM/Viteの起動、Markdown/Vue変換・SSR、CSS/HTML生成、publicコピーを時間に含む。各ビルドの`emptyOutDir`もそのまま使用する。
- OS・依存キャッシュは保持する。ソース指紋の照合によるファイル読み出しも計測の前に行うため、コールドディスク性能の測定ではない。
- `pnpm pilot:ox-native:check`が成功。各回の計測後に元の`pilot:ox-native:verify`を別実行し、1,343文書、本文・title・stylesheetとその実ファイルを確認した。verifyの時間はビルド時間に含めない。
- 最小テーマを測る目的のためVRTは実行していない。既存Misskey Hubとの表示・操作・MDC互換が一致するという結果ではない。

## 前回の55.65秒との関係

前回の[Ox native互換パイロット](OX_NATIVE_REPORT.md)は、PR #2の公式プラグイン構成へ既存のレイアウト・MDC/Shiki・ブラウザーhydration等を追加した実装で、1,991公開URLを対象としていた。**55.65秒はPR #2そのものの時間ではない。**

| 対象 | 公開URL数 | テーマ・互換処理 | 中央値 |
| --- | ---: | --- | ---: |
| PR #2単体・無変更 | 1,343 | 最小静的テーマ。既存表示とのVRTなし | **5.37秒（5回）** |
| 前回のOx native互換実装 | 1,991 | 既存レイアウト・MDC/Shiki・hydration。30ページVRT合格 | 55.65秒（3回） |
| 前回の既存Ox単独・対照 | 1,991 | 共通Nuxt互換層・Vue SSR。30ページVRT合格 | 35.52秒（3回） |

PR #2単体が数秒で動くことは確認できた。速度差にはURL数だけでなく、本文の描画方法・互換処理・クライアントモジュール生成等が含まれる。この差から各処理の寄与や、既存表示を保ったまま5秒になるとは断定しない。

## 再現・証拠

```sh
mkdir -p .pilot/pr2-standalone
git archive c52b733c227aaf5f91341544aebe4c3977800cee | tar -x -C .pilot/pr2-standalone
# この検証ではlockfile一致を確認した既存node_modulesを共有
ln -s ../../node_modules .pilot/pr2-standalone/node_modules
cd .pilot/pr2-standalone
pnpm pilot:ox-native:check
HUB_PILOT_PAGES=all NODE_ENV=production /usr/bin/time -l pnpm pilot:ox-native:build
HUB_PILOT_PAGES=all pnpm pilot:ox-native:verify
# build/verifyを5回、順次実行。初回のtypecheckは計測の外。
```

[計測JSON・全5回の検証結果](results/pr2-standalone/2026-10-31/timings.json) / [参考PR #2](https://github.com/odanado/misskey-hub-next/pull/2)。ローカルの実行ログは同じ結果ディレクトリの`run-N.log` / `verify-N.log`に保存し、JSONへログのハッシュを記録した。
