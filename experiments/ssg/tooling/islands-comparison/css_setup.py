"""Install only CSS changes over the minimal SSR Vue copy, before source hashing."""
from pathlib import Path
def install_css(dest,helper):
 native=dest/'experiments/ssg/ox-native-islands'
 # The original file contains only CSS imports. Reuse them verbatim as JS,
 # avoiding an unrelated Nuxt-generated TS config prerequisite.
 (native/'diagnostic-global-styles.mjs').write_text((dest/'experiments/ssg/nuxt-compat/styles.ts').read_text())
 def patch(name,old,new):
  p=native/name;s=p.read_text();assert s.count(old)==1,(name,old,s.count(old));p.write_text(s.replace(old,new))
 patch('vite.config.ts','// All-off diagnostic plus the official Vue compiler; no site UI/MDC/CSS pipeline.','// Minimal Vue SSR plus original site CSS generation; site UI and MDC remain off.')
 patch('vite.config.ts',"import vue from '@vitejs/plugin-vue';","import vue from '@vitejs/plugin-vue';\nimport {cssOptions,cssPlugins} from '../tooling/islands-comparison/vue-css/styles.mjs';")
 patch('vite.config.ts',"root, publicDir:","css: cssOptions, resolve: {alias: {'@':root,'~':root}}, root, publicDir:")
 patch('vite.config.ts','plugins: [instrument(), vue(),','plugins: [instrument(), ...cssPlugins(root), vue(),')
 patch('diagnostic-client.ts',"import { createSSRApp } from 'vue';","import './diagnostic-global-styles.mjs';\nimport 'scroll-hint/css/scroll-hint.css';\nimport 'virtual:diagnostic-site-styles';\nimport { createSSRApp } from 'vue';")
 patch('DiagnosticButton.vue','type="button"','type="button" :class="$style.counter"')
 p=native/'DiagnosticButton.vue';p.write_text(p.read_text()+'''\n<style module lang="scss">
.counter { border-radius: 7px; padding: 4px 8px; color: rgb(12, 34, 56); background-color: rgb(220, 230, 240); }
</style>
''')
 patch('host.ts','let clientSrc: string | undefined;','let clientSrc: string | undefined; let cssLinks = "";')
 patch('host.ts',"clientSrc = '/' + entry.file;","clientSrc = '/' + entry.file;\n                    const styles = ctx.assets.stylesheets({ modules: [resolve(root,'experiments/ssg/ox-native-islands/diagnostic-client.ts')] });\n                    if (styles.diagnostics.length || !styles.stylesheets.length) throw new Error('Missing CSS: '+JSON.stringify(styles.diagnostics));\n                    cssLinks = styles.stylesheets.map((style:any)=>`<link rel=\"stylesheet\" href=\"${style.href}\">`).join('');")
 patch('host.ts','</title></head>','</title>${cssLinks}</head>')
 patch('host.ts',"'main-site client/style registry'","'main-site client UI registry'")
 patch('host.ts','// Ox renders every Markdown source directly. No Vue, MDC, Shiki or HAST bridge.','// Ox renders raw Markdown; minimal Vue SSR plus original site CSS, without MDC/Shiki/HAST compatibility.')
