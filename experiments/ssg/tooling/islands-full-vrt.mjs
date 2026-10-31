// Compare the 25-second, 30-page-VRT-gated implementation, not the diagnostic
// raw-content copies. Reuse the historical full-VRT capture implementation.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { platform, arch, cpus } from 'node:os';
import { fingerprint, baselineHashes } from '../ox-native/evidence.mjs';
import { fullPages } from '../shared/full-pages.mjs';

assert.equal(platform(), 'darwin', 'This report targets macOS only');
const output = 'experiments/ssg/results/ox-native-islands/2026-10-31/full-vrt';
await mkdir(output, { recursive: true });
const historical = 'experiments/ssg/results/full/2026-10-30';
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const source = () => fingerprint(['experiments/ssg/ox-native-islands']);
const gate = JSON.parse(await readFile(output + '/../vrt-30.json'));
const timingBytes = await readFile(output + '/../timings-full.json');
const timing = JSON.parse(timingBytes);
assert.equal(gate.tests, 120); assert.equal(gate.exactRgbaImages, 144);
assert.equal(await source(), gate.sourceFingerprint);
assert.equal(timing.sourceFingerprint, gate.sourceFingerprint);
const originalCapture = await readFile('experiments/ssg/tooling/full-vrt-capture.mjs');
const pages = await fullPages(); assert.equal(pages.length, 1991);
const referenceRun = JSON.parse(await readFile(historical + '/vrt-run.json'));
assert.deepEqual([...referenceRun.pages].sort(), pages.map(p => p.path).sort());
const baselineBefore = await baselineHashes();
assert.deepEqual(baselineBefore, gate.baselineHashes);
async function artifact(mode) {
 const directory = '.pilot/full/' + mode + '/public';
 for (const page of pages) assert.ok((await readFile(directory + page.path + 'index.html')).length > 0, mode + page.path);
 const files = (await readdir(directory, {recursive:true})).sort();
 const hash = createHash('sha256'); let count=0, bytes=0;
 for (const file of files) {
  // The trees contain directories as well as regular files.
  let data; try { data=await readFile(directory + '/' + file); } catch(error) { if(error.code==='EISDIR')continue; throw error; }
  count++;bytes+=data.length;hash.update(file).update('\0').update(data);
 }
 return {directory,files:count,bytes,sha256:hash.digest('hex'),verifiedPublicUrls:pages.length};
}
const before = Object.fromEntries(await Promise.all(['baseline','ox-native-islands'].map(async mode => [mode,await artifact(mode)])));
const candidateManifest = await readFile(before['ox-native-islands'].directory + '/.vite/manifest.json');
assert.equal(sha(candidateManifest), timing.runs.at(-1).client.manifestSha256);
const args = ['experiments/ssg/tooling/full-vrt.mjs','--modes=baseline,ox-native-islands','--workers=6','--benchmark-file='+historical+'/compiler-timings.json','--output-dir='+output];
const evidence = {
 startedAt:new Date().toISOString(),node:process.version,platform:platform()+'-'+arch(),cpu:cpus()[0].model,
 sourceFingerprint:gate.sourceFingerprint,sourceCommit:'618dae3',captureModuleSha256:sha(originalCapture),
 historicalRunSha256:sha(await readFile(historical+'/vrt-run.json')),candidateTimingSha256:sha(timingBytes),
 candidateSsgMedianSeconds:timing.medianSeconds,candidateClientManifestSha256:sha(candidateManifest),
 artifactBefore:before,baselineSnapshots:264,command:[process.execPath,...args],
 policy:'Reuse historical Nuxt full output and capture module, frozen clock, all 1991 URLs, macOS desktop/light only. Fresh reference captures per URL. Exact RGBA/dimensions with no masks, tolerances, retries, Vize, or implementation fixes. Images excluded from Git. SSG time is the previously recorded three-run median; this command measures VRT only. Candidate output was regenerated during the earlier Vue-pages investigation; current full artifact hashes are recorded here.',
};
await writeFile(output+'/evidence.json',JSON.stringify(evidence,null,2)+'\n');
const log=createWriteStream(output+'/vrt.log');
const child=spawn(process.execPath,args,{env:{...process.env,HUB_PILOT_PAGES:'all',HUB_CONTENT_PILOT:'ox-native-islands',HUB_VUE_COMPILER:'vue'},stdio:['ignore','pipe','pipe']});
for(const stream of [child.stdout,child.stderr]) {stream.pipe(log,{end:false});stream.pipe(process.stdout,{end:false});}
const exitCode=await new Promise((ok,fail)=>{child.once('error',fail);child.once('close',ok);});
await new Promise(ok=>log.end(ok));assert.equal(exitCode,0,'Full VRT runner failed');
assert.equal(await source(),gate.sourceFingerprint);
assert.deepEqual(await baselineHashes(),baselineBefore);
assert.deepEqual(await readFile('experiments/ssg/tooling/full-vrt-capture.mjs'),originalCapture);
const after=Object.fromEntries(await Promise.all(['baseline','ox-native-islands'].map(async mode=>[mode,await artifact(mode)])));
assert.deepEqual(after,before);
const result=JSON.parse(await readFile(output+'/vrt.json'));
assert.equal(result.processed,1991);assert.equal(result.finished,true);
assert.deepEqual(result.modes,['baseline','ox-native-islands']);
assert.equal(result.clockTime,referenceRun.clockTime);
assert.equal(result.browserVersion,referenceRun.browserVersion);
Object.assign(evidence,{finishedAt:new Date().toISOString(),sourceUnchanged:true,baselineUnchanged:true,artifactUnchanged:true,artifactAfter:after,captureModuleUnchanged:true,exitCode,logSha256:sha(await readFile(output+'/vrt.log'))});
await writeFile(output+'/evidence.json',JSON.stringify(evidence,null,2)+'\n');
