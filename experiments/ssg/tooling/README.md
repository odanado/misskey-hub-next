# 起動・計測・検証ツール

`build.mjs`はshared/strategies.mjsから方針を選んで各入口を起動する。比較用のNuxtはnuxt-pilot/build.mjsで起動する。

- full-benchmark.mjs: 全1,991 URLのVue/Vize比較。通常Vue・Vize・Nuxt再計測を別JSONへ保存。
- measure*.mjs / verify*.mjs: 初期4ページの計測・VRT集計。
- pilot-30.mjs: 中断中の30ページ検証。再開時は元Nuxtの基準から再生成する。
- profiling.mjs: opt-inの工程レコーダー。各案の原稿処理からも利用。
- count-public-urls.mjs: Nuxtの実ルートと原稿から公開URL一覧を作る。
- serve.mjs / vrt-summary.mjs: VRT用HTTPサーバーと集計。
- repros/: Vize問題・非同期SSR例外の再現。

既存のresultsは計測当時の記録として保持する。ディレクトリ変更後の確認はresults/refactorへ分け、過去のベンチマーク値を置換しない。
