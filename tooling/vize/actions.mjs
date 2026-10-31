import { spawn, execFileSync } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { readFile, writeFile, mkdir, stat, rm, appendFile } from 'node:fs/promises';
import { cpus } from 'node:os';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { summarizeProfile } from './benchmark.mjs';
import { loadPages } from '../../ssg/routes.mjs';
const directory = '.vrt/vize-actions';
await mkdir(directory, { recursive: true });
const pages = await loadPages();
const result = { commit: execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(), node: process.version, cpu: cpus()[0].model, cpuCount: cpus().length, publicUrls: pages.length, runs: [] };
for (const compiler of ['vue','vize']) {
  await rm('node_modules/.vite',{recursive:true,force:true});
  await rm('node_modules/.vize',{recursive:true,force:true});
  const profileFile = resolve(directory,compiler+'-profile.json');
  const log = createWriteStream(directory+'/'+compiler+'.log');
  const start = performance.now();
  const child = spawn('pnpm',['generate'],{stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',TZ:'Asia/Tokyo',HUB_VUE_COMPILER:compiler,HUB_COMPILER_PROFILE:profileFile,VIZE_PRECOMPILE_CACHE:'0'}});
  child.stdout.pipe(log,{end:false});child.stderr.pipe(log,{end:false});
  const code = await new Promise((ok,fail)=>{child.once('close',ok);child.once('error',fail)});
  const seconds = (performance.now()-start)/1000;
  await new Promise(ok=>log.end(ok));
  assert.equal(code,0,compiler);
  for (const page of pages) assert.ok((await stat('.output/public'+page.path+'index.html')).size>0,page.path);
  assert.ok((await stat('.output/public/404.html')).size>0);
  const manifest = JSON.parse(await readFile('.output/public/.vite/manifest.json','utf8'));
  assert.ok(!Object.keys(manifest).some(key=>key.endsWith('.md')));
  const profile = JSON.parse(await readFile(profileFile,'utf8'));
  const metrics = summarizeProfile(profile);
  const logText = await readFile(directory+'/'+compiler+'.log','utf8');
  const row={compiler,seconds,clientBuildSeconds:Number(/built in ([\d.]+)s/.exec(logText)?.[1]),verifiedPublicUrls:pages.length,...metrics};
  result.runs.push(row);
  await writeFile(directory+'/results.json',JSON.stringify(result,null,2)+'\n');
  console.log('[vize-actions] '+JSON.stringify({compiler,seconds,clientBuildSeconds:row.clientBuildSeconds,allCompilerApiMs:metrics.allCompilerApiMs,sfcPluginHookMs:metrics.sfcPluginHookMs,publicUrls:pages.length}));
}
if(process.env.GITHUB_STEP_SUMMARY)await appendFile(process.env.GITHUB_STEP_SUMMARY,
  '## Vue compiler comparison (one full SSG each)\n\n| Compiler | Full SSG | Client Vite build | SFC compiler APIs | SFC plugin hooks | URLs |\n| --- | --- | --- | --- | --- | --- |\n'+
  result.runs.map(row=>`| ${row.compiler} | ${row.seconds.toFixed(3)}s | ${row.clientBuildSeconds}s | ${(row.allCompilerApiMs/1000).toFixed(3)}s | ${(row.sfcPluginHookMs/1000).toFixed(3)}s | ${row.verifiedPublicUrls} + 404 |`).join('\n')+
  `\n\nNode ${result.node}; ${result.cpu}, ${result.cpuCount} vCPU. Sequential fresh pnpm generate processes, compiler probes enabled, persistent caches off/cleared. Full output validation outside timer.\n`);
