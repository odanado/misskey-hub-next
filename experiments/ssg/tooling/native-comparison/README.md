# PR #1 / #2のOx native差分診断

通常の移植コードは変更せず、指定コミットを`.pilot/native-comparison/`へ`git archive`で展開して計測する。`prepare.py`の全置換は一致箇所が1件であることを要求し、変更ファイル一覧を結果へ保存する。node_modulesのみ共有し、lockfileの完全一致を要求する。互換版は必要な`nuxt prepare`を計測の外で実行する。PR #2はNuxtを準備しない。

```sh
# PR #2のコミットが未取得の場合
git fetch origin pull/2/head:refs/remotes/origin/ox-native-reference

python3 experiments/ssg/tooling/native-comparison/benchmark.py pr1-full 3
python3 experiments/ssg/tooling/native-comparison/benchmark.py pr2 3
python3 experiments/ssg/tooling/native-comparison/benchmark.py pr1-md 3
python3 experiments/ssg/tooling/native-comparison/benchmark.py pr1-no-md-client 3
python3 experiments/ssg/tooling/native-comparison/benchmark.py pr1-cpu 1
python3 experiments/ssg/tooling/native-comparison/summarize.py
```

ベンチ同士・VRTを重ねず順次実行する。空き容量を確保するため、各ケースの検証後にそのケースの生成`public/`を削除してよい。証拠JSONとログは`experiments/ssg/results/native-comparison/2026-10-31/`へ保存する。CPU生データは`.pilot/native-comparison/pr1-cpu/profile.cpuprofile`。同じケースを再実行するとそのケースの結果を置き換える。

- `pr1-full`: 表示互換版、1,991 URL。
- `pr2`: PR #2の最小テーマ、1,342 Markdown URL＋索引。診断フック以外の表示処理を変えない。
- `pr1-md`: 互換版のデータ準備・共通部品を維持し、クライアントモジュール一覧とSSRルートを1,342 Markdown URLへ限定。原稿全件の準備は残す。
- `pr1-no-md-client`: `pr1-md`からクライアントのMarkdownモジュールimport一覧だけを省く。SSRは元の処理を維持するが、ブラウザーでの本文hydrationは成立しない。原因を調べるための機能省略で、本番用の最適化ではない。
- `pr1-cpu`: 全件互換版の追加1回。Node CPUサンプル、公開APIのHTTP応答、アセット参照とHTML組立の小区間を採取する。通常3回の中央値には含めない。

`buildSeconds`はViteのimport前からawaitしたbuild完了まで。PNPM・Node起動や計測後のHTML列挙、元のverifyコマンドを含めない。`processSeconds`にはNode起動・計測後のHTML列挙も入る。前回のPNPM込みベンチと時間境界が異なるため、工程比較には今回の同じrunner同士を使う。OSキャッシュは維持し、ソース照合のファイル読出しは計測外で行う。

工程表は中央値に該当する**1回の実測**を使い、重ならない区間の合計がbuildSecondsに一致することを検証する。非同期transformフックとMDC呼出しの合算値は処理が並行して重なり、親工程にも含まれるため、工程表へ加算しない。CPUは別runのself samplingであり、wall-clockへ加算しない。

今回の調査では通常サイトのコード・VRT基準を変更せず、VRTを再実行していない。各生成物は元のverifyコマンドで検証する。結果は[NATIVE_COMPARISON_REPORT.md](../../NATIVE_COMPARISON_REPORT.md)を参照。
