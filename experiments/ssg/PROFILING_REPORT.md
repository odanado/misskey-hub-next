# Ox単独SSGのボトルネック調査（Vizeなし）

2026年10月30日。全1,991 URLを通常Vueで生成し、工程別のwall-clock計測と、別プロセスでのNode CPUサンプリングを行った。**主な時間はVue SSRとクライアントビルドにある。Markdown本文のRust変換API呼び出しは合計0.118秒だった。**

## Ox Content組み込みprofilerの適用範囲

指定された[Profiling Mode](https://ox-content.dev/profiling/)は、Rustのparser・renderer・JS/TS APIドキュメント生成器を調べるための機能。span別のself/inclusive時間、割り当て回数・量、ピークのlive bytes等を集計する。Cargoのprofile featureを有効にした専用CLIをreleaseビルドで使用する。

Ox Content本体のソースツリーでの例:

```sh
cargo run --release -p ox_content_profile_cli -- pipeline --gfm --json path/to/file.md
```

このCLIの対象はRustの処理で、今回のVite・Vue SSR・MDC・Node上のSSG全体は別に測る必要がある。使用中のnpm版3.4.0のN-API型定義・Vite Plugin設定には、そのRust profilerを有効化する公開スイッチは確認できなかった。本調査ではRust本体の再ビルドはしていない。詳細トレースは計測自体の負荷も増えるため、まず今回の全体計測で重い範囲を絞った。

## 現在のOx単独SSGの構成

1. N-APIのbuildCollectionManifestで全Markdownを一括取得。
2. N-APIのparseFrontmatter / transformで本文を変換し、MDCコンポーネント・コンテナ・コードは既存MDCへ渡す。
3. Viteで元のVueコンポーネントのクライアントJS・CSSをコンパイルし、Vueで全ページをSSR。
4. ssg.renderからSSR済みHTMLを返し、Ox Vite PluginのcloseBundleをスクリプトから実行してファイルを生成。

queryCollection呼び出しはこの構成にはない。一括manifestとMap・配列で参照している。独自Vueテーマを含むSSG全体の調査である。

## 工程別の実測

Node 22.22.2 / Apple M1 Pro / macOS arm64。通常Vue、原稿1,590件（Markdown1,434＋YAML156）、公開HTML1,991件。外部チーム紹介APIはHTTP 200を記録し、明示的な非同期SSR例外検出を有効にした。VRTは実施していない。

全体は**33.29秒**。前回の36.22秒とは別実行の診断値で、処理の内訳を調べるための計測。

| 工程 | 時間 | 全体比 |
| --- | ---: | ---: |
| Vue SSR | 10.57秒 | 31.8% |
| クライアントJS・CSSビルド＋publicコピー | 6.38秒 | 19.2% |
| 原稿・MDC互換・ナビゲーションの準備 | 5.32秒 | 16.0% |
| Oxの最終SSG（closeBundle） | 4.24秒 | 12.7% |
| Vue SSRモジュールの読込・コンパイル | 1.78秒 | 5.3% |
| 出力検証（worker＋親プロセス） | 1.86秒 | 5.6% |
| Oxへ渡す原稿ファイルの配置 | 0.77秒 | 2.3% |
| HTML外枠・payload組み立て | 0.73秒 | 2.2% |
| 起動・cleanup・その他 | 1.63秒 | 4.9% |

各工程は同じrunの非重複部分をまとめた値。原稿準備の内訳やCPUサンプルは、この表へ追加して合計しない。

原稿準備5.32秒の中では、MDCへ渡す区間が3.26秒、HAST変換・互換AST・TOC・style処理が1.12秒。Rustの本文変換APIは1,434回で0.118秒。0.12秒という値はこのAPIだけで、Oxの最終SSG全体には別途4.24秒かかる。

Vue SSRの約10.57秒のうち、docs 1,365件が8.78秒。チーム紹介APIの応答待ちは1.23秒で、SSRの時間に含まれる。特に重いのは各言語のreleasesページで、1ページ約90〜120msだった。

## CPU・メモリと改善候補

別のCPU採取runは33.14秒。主スレッドのサンプルでは、GCが約4.25秒相当（全採取時間の13.4%）を占めた。これはサンプリングの推定で、上の工程へ追加する時間ではない。Sass子プロセスのCPUやRust内部スタックは分解していない。

主runのピークRSSは約**3.22 GiB**。原稿準備後は約591 MiB、Vue SSR終了後は約2566 MiBだった。全payloadと全SSR済みHTMLをメモリ上に保持する構造も確認した。

Ox側では、共有style/scriptを外部化するexternalizeSharedPageAssetsに約1.39秒相当のサンプルがある。この関数はN-APIのexternalizeSsgAssetsを呼ぶため、Nodeのこの結果だけでその内部をJSとRustに分割はできない。また、renderSsgPage / renderPageでは各ページごとに全ページ一覧をmapし直している。1,991ページでは二次的に増える処理であり、今回のテーマが使うのは現在ページのURLだけなので、一覧の遅延生成・共通化を検討する価値がある。

改善の優先候補は以下。改善幅はまだ実測しておらず、この調査ではパイプラインを高速化する変更はしていない。

- Vue SSR：繰り返すレイアウト・ナビゲーション、長いreleases本文の描画を絞って調査する。SSR全体が最大のwall-clock区間。
- Viteビルド：原稿だけの変更時に、コード・CSS・設定のfingerprintに基づいてクライアント成果物を再利用できるか検証する。6.4秒にはpublicコピーも含む。
- メモリ：ページをまとめて保持する範囲を減らし、payloadの不要な本文ASTを取り除く。例としてmanualページの前後リンク情報surroundに約153 KiBの本文等が入っており、本文document自体の約35 KiBより大きい。YAMLガイドにも全ガイド分のinlineMarkdown辞書を渡している。
- MDC互換：同じコードの再解析・ハイライト結果をキャッシュできるか検証する。ASTは後でID付与等で変わるので、キャッシュを共有するなら不変データ化または複製が必要。
- Ox側：全ページ一覧の繰り返し構築と、共有アセット外部化を調査する。Rustの本文parser高速化は今回の全体時間への寄与が小さい。

## SSR判定の訂正と確認

最初のネットワーク制限下の計測では、チーム紹介APIの名前解決がENOTFOUNDで失敗した。Vue SSRはasync setupの拒否を内部catchで吸収するため、例外をthrowする設定だけでは失敗を見逃し、HTMLが生成されることを確認した。前回のベンチマークの「SSR例外0」はログ検出値であり、全ての非同期SSR成功を証明する判定としては不十分だった。過去の各runでのAPI結果は未記録なので、個別の成否は特定しない。

server.tsでerrorHandlerへ例外を集め、renderToString後にAggregateErrorとして失敗させるよう修正した。実際のチーム紹介ページで意図的に通信を拒否する診断を実行し、検出されることを確認済み。主run・CPU runでは接続可能な条件でAPIのHTTP 200も確認した。今回、他7構成のSSG再検証は行っていない。

## 記録と再現

- [工程別・全ページのwall-clock記録](./results/full/profiling/wall.json)
- [CPU runの工程記録](./results/full/profiling/cpu-run.json)
- [CPU関数の集計](./results/full/profiling/cpu-functions.json)
- [概要JSON](./results/full/profiling/summary.json)
- [payloadの代表例](./results/full/profiling/payload-samples.json)
- [非同期エラーを注入した診断結果](./results/full/profiling/ssr-error-check.json)
- [初回のネットワーク制限下の記録](./results/full/profiling/wall-network-blocked.json) — 主runには採用しない

```sh
pnpm pilot:full:profile:ox
HUB_SSG_CPU_PROFILE=1 pnpm pilot:full:profile:ox
HUB_PILOT_PAGES=all HUB_VUE_COMPILER=vue node experiments/ssg/tooling/repros/ssr-async-error.mjs
```

通常のprofileコマンドは.pilot/full/ox-ported/profile-worker.jsonへ出力する。CPUの生データは.pilot/full/ox-ported/cpu-profile/ssg.cpuprofile（約10 MiB）に保存。今回確定したrunはresults/full/profiling以下へ別名で保存した。過去の8構成の計測JSON・ログは保持している。
