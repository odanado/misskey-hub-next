"""Add only a minimal Vue island to the all-off Custom Host, in separate copies."""
from pathlib import Path
import subprocess,shutil,json,hashlib,sys
repo=Path.cwd();case=sys.argv[1];assert case in ['vue-client','vue-island'];ref='6cbe059c5d3b358557f6493b606f196c2ca06e8a';dest=repo/'.pilot/islands-comparison'/case;assert not dest.exists(),dest
archive=subprocess.run(['git','archive',ref],check=True,stdout=subprocess.PIPE).stdout;dest.mkdir(parents=True);subprocess.run(['tar','-x','-C',str(dest)],input=archive,check=True)
(dest/'node_modules').symlink_to(repo/'node_modules',target_is_directory=True);assert(dest/'pnpm-lock.yaml').read_bytes()==(repo/'pnpm-lock.yaml').read_bytes()
helper=Path('experiments/ssg/tooling/islands-comparison');shutil.copytree(repo/helper,dest/helper);shutil.copy(repo/'experiments/ssg/tooling/native-comparison/probe.mjs',dest/helper/'probe.mjs');native=Path('experiments/ssg/ox-native-islands')
host=(repo/helper/'combined/host.ts.txt').read_text()
def replace(text,old,new):
 assert text.count(old)==1,(old,text.count(old));return text.replace(old,new)
host=replace(host,"const escape =", "import { renderIsland } from './diagnostic-vue-server.ts';\nlet clientSrc: string | undefined;\nconst escape =")
host=replace(host,'async render() {','async render(ctx: any) {')
host=replace(host,'const html = `',"if (!clientSrc) { const entry = Object.values(ctx.assets.clientManifest).find((e: any) => e.isEntry) as any; if (!entry) throw new Error('Missing Vue client entry'); clientSrc = '/' + entry.file; }\n                const island = await renderIsland();\n                const html = `")
host=replace(host,'</main></body></html>','</main>${island}<script type="module" src="${clientSrc}"></script></body></html>')
host=replace(host,'state.diagnostic = {','state.diagnostic = { vueVariant: '+json.dumps(case)+',')
host=host.replace("'client JS/CSS and Vue compiler', 'Vue SSR and UI frames/fixed page bodies'","'main-site client/style registry', 'main-site UI frames/fixed page bodies'")
(dest/native/'host.ts').write_text(host)
config=(repo/helper/'combined/vite.config.ts.txt').read_text();config=replace(config,"import { defineConfig } from 'vite';","import { defineConfig } from 'vite';\nimport vue from '@vitejs/plugin-vue';");config=replace(config,'plugins: [instrument(),','plugins: [instrument(), vue(),');config=config.replace('// Minimal diagnostic: no compatibility plugins, Vue compiler, UnoCSS or PostCSS.','// All-off diagnostic plus the official Vue compiler; no site UI/MDC/CSS pipeline.');(dest/native/'vite.config.ts').write_text(config)
shutil.copy(repo/helper/'vue/Button.vue.txt',dest/native/'DiagnosticButton.vue')
client='createSSRApp'if case=='vue-island'else'createApp';(dest/native/'diagnostic-client.ts').write_text(f"import {{ {client} }} from 'vue';\nimport Button from './DiagnosticButton.vue';\n{client}(Button).mount('#diagnostic-vue-root');\n")
server="export async function renderIsland() { return '<div id=\"diagnostic-vue-root\"></div>'; }\n"
if case=='vue-island':server="""import {createSSRApp} from 'vue';
import {renderToString} from 'vue/server-renderer';
import Button from './DiagnosticButton.vue';
export async function renderIsland() {
 const app=createSSRApp(Button),errors:unknown[]=[];app.config.errorHandler=(error)=>errors.push(error);
 const html=await renderToString(app);if(errors.length)throw new AggregateError(errors,'Minimal Vue SSR failed');
 return '<div id="diagnostic-vue-root">'+html+'</div>';
}
"""
(dest/native/'diagnostic-vue-server.ts').write_text(server)
files={str(p.relative_to(dest)):hashlib.sha256(p.read_bytes()).hexdigest()for p in sorted(dest.rglob('*'))if p.is_file()and not p.is_symlink()and'node_modules'not in p.parts}
patches=[str(native/p)for p in ['host.ts','vite.config.ts','DiagnosticButton.vue','diagnostic-client.ts','diagnostic-vue-server.ts']]
(dest/'diagnostic-source.json').write_text(json.dumps({'ref':ref,'name':case,'patches':patches,'files':files},indent=2)+'\n');print(dest)
