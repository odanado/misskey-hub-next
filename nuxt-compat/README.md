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

コンポーネントの命名規則は`plugins/component-registry.ts`で扱います。

- `LazyFoo` / `lazy-foo`は非同期コンポーネントとして解決します。`Lazy`経由でのみ使うコンポーネントは動的importに分離し、初期バンドルから除外します。通常名でも使用するものは通常読み込みを優先します。`#components`からの名前付きimportでも同じ登録を使います。
- `.client.vue`はSSR時に実行せず、クライアントのマウント後に読み込みます。ページの`.client.vue`は従来どおり`components.ts`で処理します。
- `.global.vue`は接尾辞を除いた名前で登録します。このホストでは通常コンポーネントも全体に登録するため、登録範囲は同じです。
- 現在唯一の`.server.vue`である`GNoScript`は、`ssg/host.ts`が生成HTMLに挿入します。Nuxtの動的なサーバーIsland API全般を実装しているわけではありません。
- Nuxt 3.20の`LazyIdle` / `LazyVisible` / `LazyInteraction` / `LazyMediaQuery` / `LazyIf` / `LazyNever` / `LazyTime`、および`hydrate-*`属性は遅延ハイドレーションの別機能です。現在のサイトでは使用していません。導入時に未解決タグを黙って出力しないよう、使用を検出した場合はビルドを失敗させます。

確認元: [Nuxtのcomponents仕様](https://nuxt.com/docs/3.x/guide/directory-structure/components)、[Nuxt 3.20.2のloader実装](https://github.com/nuxt/nuxt/blob/v3.20.2/packages/nuxt/src/components/plugins/loader.ts)。`ClientOnly`・`NuxtLink`等は組み込みコンポーネントの名前であり、任意のコンポーネントに付ける一般的な接頭辞ではありません。

ナビゲーション実装のライセンスは[NOTICE.md](NOTICE.md)を参照してください。
