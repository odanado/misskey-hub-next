// Import existing SFC style blocks without importing their UI scripts/templates.
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, relative, dirname } from 'node:path';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { parse } from '@vue/compiler-sfc';
import unocss from 'unocss/vite';
import autoprefixer from 'autoprefixer';
import cssnano from 'cssnano';
const require=createRequire(import.meta.url);
export const cssOptions={postcss:{plugins:[autoprefixer(),cssnano({preset:'default'})]}};
export function cssPlugins(root, {includeUno=true}={}) {
 const files=['components','pages','layouts'].flatMap(dir=>readdirSync(resolve(root,dir),{recursive:true}).filter(f=>f.endsWith('.vue')).map(f=>resolve(root,dir,f)));
 const content=dirname(require.resolve('@nuxt/content'));
 for(const name of ['ProsePre','ProseCode','ProseCodeInline'])files.push(resolve(content,'runtime/components/Prose/'+name+'.vue'));
 const requests=[],counts={sfcFiles:files.length,styledFiles:0,styleBlocks:0,cssModules:0,scopedBlocks:0,scssBlocks:0};
 for(const file of files){
  const source=readFileSync(file,'utf8'),{descriptor,errors}=parse(source,{filename:file});if(errors.length)throw new Error(JSON.stringify(errors));
  const hash=createHash('sha256').update(relative(root,file)+source).digest('hex').slice(0,8);
  if(descriptor.styles.some(style=>style.content.trim()))counts.styledFiles++;
  for(const [index,style]of descriptor.styles.entries()){
   if(!style.content.trim())continue;if(style.src)throw Error('External SFC style not supported: '+file);
   counts.styleBlocks++;if(style.module)counts.cssModules++;if(style.scoped)counts.scopedBlocks++;if(style.lang==='scss')counts.scssBlocks++;
   requests.push(file+'?vue&type=style&index='+index+(style.scoped?'&scoped='+hash:'')+(style.module?'&module=true':'')+'&lang.'+(style.module?'module.':'')+(style.lang??'css'));
  }
 }
 return [...(includeUno?[unocss({configFile:resolve(root,'uno.config.ts'),content:{filesystem:['components/**/*.vue','layouts/**/*.vue','pages/**/*.vue','experiments/ssg/**/*.vue'].map(glob=>resolve(root,glob))}})]:[]),{
  name:'diagnostic-all-site-css',
  resolveId(id){if(id==='virtual:diagnostic-site-styles')return '\0'+id;},
  load(id){if(id==='\0virtual:diagnostic-site-styles')return{code:requests.map(id=>'import '+JSON.stringify(id)+';').join('\n'),moduleSideEffects:'no-treeshake'};},
  moduleParsed(info){if(info.id.includes('?vue&type=style'))info.moduleSideEffects='no-treeshake';},
  buildStart(){console.log('[diagnostic-css] '+JSON.stringify(counts));},
 }];
}
