# Nuxt互換レイヤー

既存のVueコードと原稿が使うNuxt / Nuxt Content / MDCの処理を、Ox ContentのSSGに接続します。サイトで使用するAPIの範囲を実装しています。

| ファイル | 役割 |
| --- | --- |
| `injection.ts` / `context.ts` | ページごとの状態・翻訳・ルート情報を作成し、Vueに渡す |
| `app.ts` / `page.ts` | Vueアプリの初期化、既存ページとレイアウトの接続、ハイドレーション状態 |
| `components.ts` | 既存コンポーネントの登録、ページ・レイアウトの読み込み |
| `config.ts` | `useRuntimeConfig`・`useAppConfig`・`defineAppConfig` |
| `routing.ts` | `useRoute`・`useRouter`・`navigateTo`など |
| `state.ts` | `useState` |
| `i18n.ts` | 翻訳API、言語別URL、言語切り替え |
| `color-mode.ts` | ライト・ダークの状態と保存・適用 |
| `async-data.ts` / `fetch.ts` | 非同期データの取得、ビルドからブラウザへの引き継ぎ |
| `content.ts` | `queryContent`・`fetchContentNavigation` |
| `head.ts` | `useHead`・`definePageMeta` |
| `components/` | `NuxtLink`・`ClientOnly`・`ContentNavigation`・`MDC`・`ContentRenderer`の代替実装 |
| `path-meta.ts` / `navigation.ts` | Nuxt Contentのファイル名からURLを作る規約とナビゲーション生成 |
| `mdc.ts` | MDC解析とShiki / AiScriptのハイライト |
| `mdc-islands.ts` | 原稿からMDCコンポーネント記法を抽出 |
| `legacy-markdown.ts` | 既存MDCで文書全体を解析する必要がある38ファイル |
| `imports.ts` | 明示的な`#imports`利用箇所向けの再エクスポート。実装は各ファイルに置く |

auto importの対応は`plugins/index.ts`にあります。Vue APIは`vue`から、互換APIはこのディレクトリの各実装から直接importします。`ssg/`はURLの列挙、Oxへの接続、サイトのHTML生成とクライアント処理を担当します。

ナビゲーション実装のライセンスは[NOTICE.md](NOTICE.md)を参照してください。
