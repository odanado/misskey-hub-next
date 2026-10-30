// Invoked from an instrumented archive; the normal migration source is untouched.
import { writeFile, readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { state, mark } from './probe.mjs';
const native = process.env.HUB_COMPARE_CASE === 'pr2' ? 'ox-native' : 'ox-native-islands';
const fetchImpl = globalThis.fetch;
state.fetches=[];
globalThis.fetch = async (...args) => {
	const start=performance.now();try {const response=await fetchImpl(...args);state.fetches.push({url:String(args[0]),status:response.status,ms:performance.now()-start});return response;}
	catch(error){state.fetches.push({url:String(args[0]),error:String(error),ms:performance.now()-start});throw error;}
};
let session;
if(process.env.HUB_COMPARE_CPU==='1') {
	const {Session}=await import('node:inspector');session=new Session();session.connect();
	await new Promise((ok,fail)=>session.post('Profiler.enable',e=>e?fail(e):ok()));
	await new Promise((ok,fail)=>session.post('Profiler.start',e=>e?fail(e):ok()));
}
try {
	const {build}=await import('vite');
	await build({configFile:resolve('experiments/ssg/'+native+'/vite.config.ts')});mark('buildComplete');
	if(session){const {profile}=await new Promise((ok,fail)=>session.post('Profiler.stop',(e,r)=>e?fail(e):ok(r)));await writeFile(process.env.HUB_COMPARE_CPU_FILE,JSON.stringify(profile));session.disconnect();}
	const {outDir}=await import(resolve('experiments/ssg/'+native+'/routes.ts'));
	const paths=(await readdir(outDir,{recursive:true})).filter(f=>f.endsWith('.html'));
	let htmlBytes=0;for(const path of paths)htmlBytes+=(await readFile(resolve(outDir,path))).length;
	state.output={htmlFiles:paths.length,htmlBytes};
	state.legacy=globalThis[Symbol.for('hub.islands-legacy')]?.();
	const pages=state.pages;
	await writeFile(process.env.HUB_COMPARE_OUTPUT,JSON.stringify({...state,pages:'__ROWS__',node:process.version,resourceUsage:process.resourceUsage()},null,2).replace('"__ROWS__"','[\n'+pages.map(p=>'    '+JSON.stringify(p)).join(',\n')+'\n  ]')+'\n');
	process.exit(0);
}catch(error){console.error(error);process.exit(1);}
