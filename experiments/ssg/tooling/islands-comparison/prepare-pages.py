"""Restore original Vue fixed pages/layouts over raw Ox Markdown + site CSS."""
from pathlib import Path
import subprocess,shutil,json,hashlib
repo=Path.cwd();ref='6cbe059c5d3b358557f6493b606f196c2ca06e8a';dest=repo/'.pilot/islands-comparison/vue-pages';assert not dest.exists(),dest
archive=subprocess.run(['git','archive',ref],check=True,stdout=subprocess.PIPE).stdout;dest.mkdir(parents=True);subprocess.run(['tar','-x','-C',str(dest)],input=archive,check=True)
(dest/'node_modules').symlink_to(repo/'node_modules',target_is_directory=True);assert(dest/'pnpm-lock.yaml').read_bytes()==(repo/'pnpm-lock.yaml').read_bytes()
helper=Path('experiments/ssg/tooling/islands-comparison');shutil.copytree(repo/helper,dest/helper,ignore=shutil.ignore_patterns('__pycache__','*.pyc'))
native=Path('experiments/ssg/ox-native-islands');mapping={'data.mjs':'pages-data.mjs','registry.ts':'pages-registry.ts','RawContent.vue':'RawContent.vue','app.ts':'pages-app.ts','client.ts':'pages-client.ts','host.ts':'host.ts','vite.config.ts':'vite.config.ts'}
for source,target in mapping.items():shutil.copy(repo/helper/'vue-pages'/(source+'.txt'),dest/native/target)
nav=(dest/'experiments/ssg/shared/navigation.mjs').read_text();old="import { generatePath, pathMeta } from './content/markdown.mjs';";assert nav.count(old)==1
nav=nav.replace(old,"import{createRequire}from'node:module';import{dirname,resolve}from'node:path';const require=createRequire(import.meta.url);const{default:pathMeta}=await import(resolve(dirname(require.resolve('@nuxt/content')),'runtime/transformers/path-meta.js'));")
(dest/native/'raw-navigation.mjs').write_text(nav)
patches=[str(native/name)for name in mapping.values()]+[str(native/'raw-navigation.mjs')]
runtime='experiments/ssg/nuxt-compat/runtime.ts'
def patch(file,old,new):
 p=dest/file;s=p.read_text();assert s.count(old)==1,(file,old,s.count(old));p.write_text(s.replace(old,new));patches.append(str(file))
patch(runtime,"baseUrl: 'https://misskey-hub.net',","baseUrl: 'https://misskey-hub.net',\n        serverListApiBaseUrl: 'https://instanceapp.misskey.page',")
patch(runtime,"export const useNuxtApp = () => ({ isHydrating: false });","export const useNuxtApp = () => ({ isHydrating: !!usePortContext().isHydrating });")
patch(runtime,"export const definePageMeta = (_meta: unknown) => {};","export const definePageMeta = (meta: any) => Object.assign(usePortContext().route.meta,meta);")
patch(runtime,"export const useHead = (_head: unknown) => {};","export const useHead = (input:any) => { const c=usePortContext(),value=typeof input==='function'?input():input; c.head??={htmlAttrs:{},meta:[]}; Object.assign(c.head.htmlAttrs,value?.htmlAttrs??{}); c.head.meta.push(...(value?.meta??[])); if(typeof document!=='undefined'){for(const [key,v]of Object.entries(value?.htmlAttrs??{}))document.documentElement.setAttribute(key,String(v)+(key==='class'?' '+c.colorMode.value:''));for(const meta of value?.meta??[]){const key=meta.name?'name':'property',name=meta[key];if(!name)continue;let element=document.querySelector('meta['+key+'=\"'+name+'\"]');if(!element){element=document.createElement('meta');element.setAttribute(key,name);document.head.appendChild(element);}element.setAttribute('content',String(meta.content??''));}} };")
patch(runtime,"export const useGAsyncData = async (_key: string, fn: () => any) => ({ data: ref(await fn()) });","export const useGAsyncData = async (key:string,fn:()=>any) => {const c=usePortContext();c.asyncData??={};if(!Object.prototype.hasOwnProperty.call(c.asyncData,key))c.asyncData[key]=await fn();return {data:ref(c.asyncData[key])};};")
patch(runtime,"export async function useFetch(url: string) {","export async function useFetch(url: string) {\nconst context=usePortContext();context.fetchCache??={};if(Object.prototype.hasOwnProperty.call(context.fetchCache,url))return {data:ref(context.fetchCache[url]),pending:ref(false),error:ref(null)};")
patch(runtime,"return { data: ref(await promise), pending: ref(false), error: ref(null) };","context.fetchCache[url]=await promise;return { data: ref(context.fetchCache[url]), pending: ref(false), error: ref(null) };")
patch('assets/js/mi/io-emojis.ts','init();',"void init().catch((error)=>{ console.warn('Emoji provider unavailable:',error); });")
patch('components/index/mobile.vue','const instanceRes = await fetch(`${runtimeConfig.public.serverListApiBaseUrl}/_hub/instances20.json`);\n\t\tinstances.value = await instanceRes.json();','const instancesResult = await fetch(`${runtimeConfig.public.serverListApiBaseUrl}/_hub/instances20.json`).then(response => response.ok ? response.json() : null).catch(() => null);\n\t\tif (instancesResult) instances.value = instancesResult;')
# Use the original prerequisites outside the SSG timer, as in the 25-second build.
with(dest/'nuxt-prepare.log').open('wb')as log:subprocess.run(['pnpm','exec','nuxt','prepare'],cwd=dest,stdout=log,stderr=subprocess.STDOUT,check=True)
files={str(p.relative_to(dest)):hashlib.sha256(p.read_bytes()).hexdigest()for p in sorted(dest.rglob('*'))if p.is_file()and not p.is_symlink()and'node_modules'not in p.parts}
(dest/'diagnostic-source.json').write_text(json.dumps({'ref':ref,'name':'vue-pages','patches':sorted(set(patches)),'files':files},indent=2)+'\n');print(dest)
