"""Instrument immutable git archives; never patch the normal migration code."""
from pathlib import Path
import subprocess,sys,shutil,hashlib,json
repo=Path.cwd();name=sys.argv[1];assert name in ['islands','pr2']
ref='6cbe059c5d3b358557f6493b606f196c2ca06e8a' if name=='islands' else 'c52b733c227aaf5f91341544aebe4c3977800cee'
dest=repo/'.pilot/islands-comparison'/name
assert not dest.exists(),dest
dest.mkdir(parents=True)
a=subprocess.run(['git','archive',ref],check=True,stdout=subprocess.PIPE).stdout
subprocess.run(['tar','-x','-C',str(dest)],input=a,check=True)
(dest/'node_modules').symlink_to(repo/'node_modules',target_is_directory=True)
assert (dest/'pnpm-lock.yaml').read_bytes()==(repo/'pnpm-lock.yaml').read_bytes()
helper='experiments/ssg/tooling/islands-comparison'
shutil.copytree(repo/helper,dest/helper,dirs_exist_ok=True)
shutil.copy(repo/'experiments/ssg/tooling/native-comparison/probe.mjs',dest/helper/'probe.mjs')
changes=[]
def patch(file,old,new):
 p=dest/file;s=p.read_text();assert s.count(old)==1,(file,old,s.count(old));p.write_text(s.replace(old,new));changes.append(file)
native='experiments/ssg/'+('ox-native-islands' if name=='islands' else 'ox-native')+'/'
config=dest/native/'vite.config.ts';config.rename(config.with_name('vite.base.ts'))
config.write_text("""import base from './vite.base';
import { instrument } from '../tooling/islands-comparison/probe.mjs';
export default async (env) => { const config=typeof base==='function'?await base(env):await base;
return {...config,plugins:[instrument(),...config.plugins]}; };
""");changes.extend([native+'vite.config.ts',native+'vite.base.ts'])
probe="import {now,add,mark,state} from '../tooling/islands-comparison/probe.mjs';\n"
host=native+'host.ts';patch(host,"import { resolve } from 'node:path';",probe+"import { resolve } from 'node:path';")
if name=='islands':
 patch(host,'async routes(host) {',"async routes(host) { mark('hostRoutesStart');state.stage='data';const dataStart=now();")
 load="const pages = await prepareData('ox-native-islands', { parseDocument: createDocumentParser(host) });"
 patch(host,load,load+"\nadd('host.prepareData',dataStart);mark('hostDataEnd');state.stage='render';")
 patch(host,'return pages.map((original: any) => {',"const selected=process.env.HUB_COMPARE_CASE==='md-only'?pages.filter((p:any)=>p.source?.endsWith('.md')):pages;\nmark('hostRoutesEnd');\nreturn selected.map((original: any) => {")
 patch(host,'async render(ctx) {',"async render(ctx) { const pageStart=now();const assetsStart=now();")
 patch(host,'const context = createContext(payload), ui = createDecorations(context);',"add('host.assets',assetsStart);const bodyStart=now();\nconst context = createContext(payload), ui = createDecorations(context);")
 patch(host,'context.staticMarkdownHtml = body;',"const bodyMs=add('host.bodyHtml',bodyStart);context.staticMarkdownHtml = body; const themeStart=now();")
 patch(host,'const content = await fullTheme(payload, body, ui);',"const content = process.env.HUB_COMPARE_CASE==='no-theme'?body:await fullTheme(payload,body,ui);const themeMs=add('host.theme',themeStart);const docStart=now();")
 patch(host,'return { title: payload.document.title, html:', 'const result = { title: payload.document.title, html:')
 patch(host,'</body></html>` };','</body></html>` };\nconst docMs=add(\'host.document\',docStart,Buffer.byteLength(result.html));state.pages.push({path:payload.path,kind:payload.kind,bodyMs,themeMs,docMs,totalMs:now()-pageStart});mark(\'lastPageEnd\');return result;')
 patch(host,"modules: [resolve(root, 'experiments/ssg/ox-native-islands/client.ts')]", "modules: [resolve(root, 'experiments/ssg/ox-native-islands/' + (process.env.HUB_COMPARE_CASE==='no-client'?'diagnostic-client.ts':'client.ts'))]")
 # The original verifier sees the same filtered inventory in md-only cases.
 patch(native+'routes.ts','return pages;',"return process.env.HUB_COMPARE_CASE==='md-only'?pages.filter((p)=>p.source?.endsWith('.md')):pages;")
 patch(native+'vite.base.ts',"input: resolve(import.meta.dirname, 'client.ts')", "input: resolve(import.meta.dirname, process.env.HUB_COMPARE_CASE==='no-client'?'diagnostic-client.ts':'client.ts')")
 (dest/native/'diagnostic-client.ts').write_text("import './diagnostic-client.css';\n")
 (dest/native/'diagnostic-client.css').write_text('body { --diagnostic: 1; }\n')
 patch(native+'decorations.ts',"import { renderToString } from 'vue/server-renderer';",probe+"import { renderToString } from 'vue/server-renderer';")
 patch(native+'decorations.ts','const component = components[name as keyof typeof components] ?? await full.resolveComponent(name);',"const start=now();const component = components[name as keyof typeof components] ?? await full.resolveComponent(name);add('vue.load.'+name,start);const appStart=now();")
 patch(native+'decorations.ts','const html = await renderToString(app);',"add('vue.app.'+name,appStart);const ssrStart=now();const html = await renderToString(app);add('vue.ssr.'+name,ssrStart,Buffer.byteLength(html));")
 patch(native+'html.ts',"return decorations.render('ProseA', props, { default: children });", "return process.env.HUB_COMPARE_CASE==='static-links'?`<a${attributes(props)}>${children}</a>`:decorations.render('ProseA', props, { default: children });")
 patch(native+'markdown.ts',"import { root } from './routes';",probe+"import { root } from './routes';")
 patch(native+'markdown.ts','const prepared = prepareNativeMarkdown',"const prepStart=now();const prepared = prepareNativeMarkdown")
 patch(native+'markdown.ts','const result = await host.markdown.render({',"add('parser.preprocess',prepStart);const oxStart=now();\nconst result = await host.markdown.render({")
 patch(native+'markdown.ts','return result.metadata;',"add('parser.oxApiInclusive',oxStart);return result.metadata;")
 legacy='experiments/ssg/tooling/profiling.mjs'
 patch(legacy,'const phases = new Map(),\n\tpages = [],\n\tfetches = [],\n\tcheckpoints = [];',"const {phases,pages,fetches,checkpoints}=(globalThis[Symbol.for('hub.islands-legacy-state')]??={phases:new Map(),pages:[],fetches:[],checkpoints:[]});\nglobalThis[Symbol.for('hub.islands-legacy')]=()=>({phases:Object.fromEntries(phases),fetches,checkpoints});")
 md='experiments/ssg/shared/content/markdown.mjs'
 patch(md,"import { expanded, fullSite } from '../scope.mjs';", "import {expanded,fullSite} from '../scope.mjs';\nimport {now,add,state} from '../../tooling/islands-comparison/probe.mjs';")
 patch(md,'export async function parseMdc(body, source) {',"export async function parseMdc(body,source){const t=now();try{return await parseMdcImpl(body,source);}finally{add('mdc.'+source,t);}}\nasync function parseMdcImpl(body, source) {")
 patch(md,'createMarkdownParser(parserOptions)', "createMarkdownParser(process.env.HUB_COMPARE_CASE==='no-shiki'?{...parserOptions,rehype:{plugins:{}}}:parserOptions)")
 with (dest/'nuxt-prepare.log').open('wb') as log:subprocess.run(['pnpm','exec','nuxt','prepare'],cwd=dest,stdout=log,stderr=subprocess.STDOUT,check=True)
else:
 patch(host,'async routes() {',"async routes() {mark('hostRoutesStart');const dataStart=now();")
 patch(host,'const pages = await loadPages();',"const pages=await loadPages();add('host.prepareData',dataStart);mark('hostDataEnd');mark('hostRoutesEnd');")
 patch(host,'async render(ctx) {',"async render(ctx) {const pageStart=now(),loadStart=now();")
 patch(host,'const app = createSSRApp',"const loadMs=add('host.loadMarkdown',loadStart);const appStart=now();const app = createSSRApp")
 patch(host,'const body = (await renderToString(app)).replace(',"add('host.app',appStart);const ssrStart=now();const renderedBody=await renderToString(app);const ssrMs=add('host.vueSsr',ssrStart);const docStart=now();const body = renderedBody.replace(")
 patch(host,'\t\t\t\treturn {\n\t\t\t\t\ttitle,','\t\t\t\tconst result = {\n\t\t\t\t\ttitle,')
 patch(host,'\n\t\t\t\t};\n\t\t\t},',"\n\t\t\t\t};const docMs=add('host.document',docStart);state.pages.push({path:page.path,loadMs,ssrMs,docMs,totalMs:now()-pageStart});mark('lastPageEnd');return result;\n\t\t\t},")
records={}
for p in sorted(dest.rglob('*')):
 if p.is_file() and not p.is_symlink() and 'node_modules'not in p.parts:records[str(p.relative_to(dest))]=hashlib.sha256(p.read_bytes()).hexdigest()
(dest/'diagnostic-source.json').write_text(json.dumps({'ref':ref,'name':name,'patches':sorted(set(changes)),'files':records},indent=2)+'\n')
print(dest)
