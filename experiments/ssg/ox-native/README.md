# Ox native SSG reference

A standalone example of Ox's default native theme using the published
`@ox-content/vite-plugin@3.4.3` and `@ox-content/napi@3.4.3` packages.
It uses the [existing public URL inventory](../results/public-url-count.json)
and prepares its own sources before building and validating every expected URL.
There is no prerequisite Vue build or linked Ox source checkout.

## Run

Use Node.js 22.6 or newer and the pnpm version specified in `package.json`.
Run these commands from the repository root:

```sh
pnpm install --frozen-lockfile --ignore-scripts

# The first 4 pages, 30 pages, or all 1,991 public URLs
pnpm pilot:ox-native:build
HUB_PILOT_PAGES=30 pnpm pilot:ox-native:build
HUB_PILOT_PAGES=all pnpm pilot:ox-native:build

# Repeat source preparation, clean SSG, and output validation in five processes
HUB_PILOT_PAGES=all pnpm pilot:ox-native:measure --runs=5
node --test experiments/ssg/ox-native/sources.test.mjs
```

Install scripts are unnecessary for this example. For regular Nuxt development,
use the existing `pnpm install --frozen-lockfile` command instead.

Artifacts go to `.pilot/ox-native-theme/` for 4 pages,
`.pilot/30/ox-native-theme/` for 30 pages, or `.pilot/full/ox-native-theme/`
for all URLs. Serve the generated `public/` directory with a static server to
inspect the default theme. Both `source/` and `public/` are regenerated on each
run, in a separate directory from the existing Vue pilot.

## Implementation

- [build.mjs](build.mjs): enumerate routes, prepare sources, invoke the `oxContent`
  SSG hooks, and validate HTML at every expected URL.
- [sources.mjs](sources.mjs): map the route inventory to generated `index.md` files.
- [measure.mjs](measure.mjs): run independent Node processes and save every sample
  together with the medians.
- [Actions](../../../.github/workflows/ox-native-reference.yml): validate the
  frozen install, source preparation, and 4/30/full-site builds on Linux.

The configuration uses the default native renderer and automatic navigation
for large sites in 3.4.3. It does not provide a custom `ssg.render` callback:

```js
const ssg = oxContent({
	srcDir,
	outDir,
	docs: false,
	search: false,
	embeds: false,
	highlight: false,
	ssg: {
		clean: true,
		generateOgImage: false,
		lastUpdated: false,
		readerChrome: false,
	},
}).find((plugin) => plugin.name === 'ox-content:ssg');

ssg.config({}, { command: 'build', mode: 'production' });
await ssg.closeBundle();
```

Calling Vite plugin hooks directly is an experimental script entry point;
the dependencies are pinned to 3.4.3. The example does not start Nuxt, a Vite
server, or a browser, and does not fetch external APIs.

## Rendering coverage

Markdown is passed unchanged to the native renderer, including frontmatter and
raw MDC. Aliases such as `ja-ks` use the same source mappings as the existing
route inventory. Vue/YAML routes produce explicit **Native SSG route scaffold**
pages. The JSON output distinguishes `markdownRoutes`, `scaffoldRoutes`, and
`markdownSources`.

This example demonstrates the default theme and native SSG performance; it is
not a complete Misskey Hub migration. It does not implement the existing Vue
layouts, MDC components, AiScript/Shiki output, hydration, search, embeds, full
public-asset copying, or language-entry redirects. Raw MDC does not have the
same rendering semantics as Nuxt/MDC, and scaffolds do not implement the original
Vue/YAML pages. HTML validation checks for complete documents at every expected
URL, not visual or functional parity. For the implementation that reuses the
existing Vue pages, see [ox-standalone](../ox-standalone/README.md).

## Measurements

`build.json` and `timings.json` are saved alongside the generated output.
Existing historical comparison results are kept intact.

| Field                | Scope                                                                                   |
| -------------------- | --------------------------------------------------------------------------------------- |
| `preparationSeconds` | Route enumeration, source reads, and rebuilding `source/`                               |
| `buildSeconds`       | SSG configuration, native Markdown/theme rendering, asset extraction, and output writes |
| `validationSeconds`  | Reading and validating every expected HTML document, counting output files and bytes    |
| `seconds`            | The sum of those three phases                                                           |
| `wallSeconds`        | Child process startup, module imports, all phases, and process exit                     |

Every run is recorded and included in the median, including the first run.
The OS filesystem cache is not cleared. Inspect the individual samples to
understand first-run versus subsequent-run behavior.

The previous approximately 34–40 second Vue pilot also includes Vue SSR and a
client build. Its scope differs from this example, so these native SSG numbers
cannot be interpreted as the speedup of a functionally equivalent migration.
