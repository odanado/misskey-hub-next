"""Create isolated, instrumented snapshots; assert every source patch matches.

Usage: python3 experiments/ssg/tooling/native-comparison/prepare.py REF NAME
All experiments use the same diagnostic hooks; actual site code is never edited.
"""
from pathlib import Path
import subprocess, sys, shutil, hashlib, json

repo = Path.cwd()
ref, name = sys.argv[1:]
dest = repo / '.pilot/native-comparison' / name
if dest.exists():
    raise SystemExit('Refusing to overwrite existing checkout: ' + str(dest))
dest.mkdir(parents=True)
archive = subprocess.run(['git', 'archive', ref], stdout=subprocess.PIPE, check=True).stdout
subprocess.run(['tar', '-x', '-C', str(dest)], input=archive, check=True)
(dest / 'node_modules').symlink_to(repo / 'node_modules', target_is_directory=True)
assert (dest / 'pnpm-lock.yaml').read_bytes() == (repo / 'pnpm-lock.yaml').read_bytes()
helper = Path('experiments/ssg/tooling/native-comparison')
shutil.copytree(repo / helper, dest / helper, dirs_exist_ok=True)
changes = []
def patch(file, old, new):
    p = dest / file
    text = p.read_text()
    assert text.count(old) == 1, (file, old, text.count(old))
    p.write_text(text.replace(old, new))
    changes.append(file)

native = 'experiments/ssg/ox-native/'
config = dest / native / 'vite.config.ts'
config.rename(config.with_name('vite.base.ts'))
config.write_text("""import base from './vite.base';
import { instrument } from '../tooling/native-comparison/probe.mjs';
export default async (env) => {
  const config = typeof base === 'function' ? await base(env) : await base;
  return {...config, plugins: [instrument(), ...config.plugins]};
};
""")
changes.extend([native+'vite.config.ts', native+'vite.base.ts'])

host = native + 'host.ts'
patch(host, "import { resolve } from 'node:path';", "import { resolve } from 'node:path';\nimport { now, add, mark, state } from '../tooling/native-comparison/probe.mjs';")
patch(host, 'async routes() {', "async routes() {\nmark('hostRoutesStart'); state.stage='host-data'; const dataStart=now();")
compat = name.startswith('pr1')
load = "const pages = await prepareData('ox-native');" if compat else 'const pages = await loadPages();'
patch(host, load, load+"\nadd('host.data', dataStart); mark('hostDataEnd'); state.stage='host-render';")
mapping = 'return pages.map((payload)' if compat else "return [{ path: '/', source: undefined }, ...pages].map((page)"
if name.endswith('md') or name.endswith('no-md-client'):
    # PR #1 and #2 now render exactly the same 1,342 Markdown paths, without index.
    patch(host, mapping, 'return pages.filter((p) => p.source?.endsWith(\'.md\')).map((payload)' if compat else 'return pages.map((page)')
patch(host, 'async render(ctx) {', 'async render(ctx) {\nconst pageStart=now(), loadStart=now();')
patch(host, 'const app = createSSRApp', "const loadMs=add('host.loadMarkdown',loadStart); const appStart=now();\nconst app = createSSRApp")
if compat:
    patch(host, 'const body = await renderToString(app);', "add('host.appCreateConfigure',appStart); const ssrStart=now();\nconst body = await renderToString(app);\nconst ssrMs=add('host.vueSsr',ssrStart,Buffer.byteLength(body)); const docStart=now();")
    patch(host, '\t\t\t\treturn {\n\t\t\t\t\ttitle: payload.document.title,', '\t\t\t\tconst result = {\n\t\t\t\t\ttitle: payload.document.title,')
else:
    patch(host, 'const body = (await renderToString(app)).replace(', "add('host.appCreateConfigure',appStart); const ssrStart=now();\nconst renderedBody=await renderToString(app);\nconst ssrMs=add('host.vueSsr',ssrStart,Buffer.byteLength(renderedBody)); const docStart=now();\nconst body = renderedBody.replace(")
    patch(host, '\t\t\t\treturn {\n\t\t\t\t\ttitle,', '\t\t\t\tconst result = {\n\t\t\t\t\ttitle,')
patch(host, '\n\t\t\t\t};\n\t\t\t},', "\n\t\t\t\t};\nconst docMs=add('host.documentAndAssets',docStart,Buffer.byteLength(result.html));\nstate.pages.push({path:"+('payload.path,kind:payload.kind' if compat else 'page.path')+",loadMs,ssrMs,docMs,totalMs:now()-pageStart,htmlBytes:Buffer.byteLength(result.html)});\nmark('lastPageEnd'); return result;\n\t\t\t},")

if compat:
    patch(host, 'const stylesheet = ctx.assets.stylesheets({', "const assetsStart=now();\nconst stylesheet = ctx.assets.stylesheets({")
    patch(host, '\t\t\t\tconst result = {\n\t\t\t\t\ttitle: payload.document.title,', "add('host.assets',assetsStart); const htmlStart=now();\n\t\t\t\tconst result = {\n\t\t\t\t\ttitle: payload.document.title,")
    patch(host, "const docMs=add('host.documentAndAssets'", "add('host.html',htmlStart);\nconst docMs=add('host.documentAndAssets'")
    p = 'experiments/ssg/tooling/profiling.mjs'
    patch(p, 'const phases = new Map(),\n\tpages = [],\n\tfetches = [],\n\tcheckpoints = [];', "const {phases,pages,fetches,checkpoints}=(globalThis[Symbol.for('hub.native-legacy-state')]??={phases:new Map(),pages:[],fetches:[],checkpoints:[]});\nglobalThis[Symbol.for('hub.native-legacy')]=()=>({phases:Object.fromEntries(phases),fetches,checkpoints});")
    p = 'experiments/ssg/shared/content/markdown.mjs'
    patch(p, "import { expanded, fullSite } from '../scope.mjs';", "import { expanded, fullSite } from '../scope.mjs';\nimport {now,add,state} from '../../tooling/native-comparison/probe.mjs';")
    patch(p, 'export async function parseMdc(body, source) {', "export async function parseMdc(body,source){const t=now(),stage=state.stage;try{return await parseMdcImpl(body,source);}finally{add('mdc.parse.'+stage,t);}}\nasync function parseMdcImpl(body, source) {")
    if name.endswith('no-md-client'):
        patch(native+'client.ts', "import documents from 'virtual:ox-native-documents';", 'const documents = {}; // Diagnostic ablation: omit Markdown client module graph.')
    if name.endswith('md') or name.endswith('no-md-client'):
        patch(native+'routes.ts', 'return pages;', "return pages.filter((p)=>p.source?.endsWith('.md'));")

# The compatibility snapshot needs the same generated Nuxt TS configuration as
# the original workspace. Preparation is a prerequisite, outside SSG timing.
# The minimal PR #2 snapshot does not need or run Nuxt prepare.
if compat:
    with (dest/'nuxt-prepare.log').open('wb') as log:
        subprocess.run(['pnpm','exec','nuxt','prepare'],cwd=dest,stdout=log,stderr=subprocess.STDOUT,check=True)

# Explicit path inventory and hashes make the experiments inspectable/reproducible.
records = {}
for p in sorted(dest.rglob('*')):
    if p.is_file() and not p.is_symlink() and 'node_modules' not in p.parts:
        records[str(p.relative_to(dest))] = hashlib.sha256(p.read_bytes()).hexdigest()
(dest/'diagnostic-source.json').write_text(json.dumps({'ref':ref,'name':name,'patches':sorted(set(changes)),'files':records},indent=2)+'\n')
print(dest)
