import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const directory='experiments/ssg/results/ox-native-islands/2026-10-31/full-vrt';
const old='experiments/ssg/results/full/2026-10-30';
const read=async path=>JSON.parse(await readFile(path,'utf8'));
const lines=async path=>(await readFile(path,'utf8')).trim().split('\n').map(line=>JSON.parse(line));
const summary=await read(directory+'/vrt.json'),evidence=await read(directory+'/evidence.json');
assert.equal(summary.finished,true);assert.equal(summary.processed,1991);
assert.equal(evidence.artifactUnchanged,true);assert.equal(evidence.sourceUnchanged,true);
const rows=await lines(directory+'/vrt-rows.jsonl'),historicalRows=await lines(old+'/vrt-rows.jsonl'),historicalRun=await read(old+'/vrt-run.json');
assert.equal(rows.length,1991);assert.equal(new Set(rows.map(row=>row.path)).size,1991);
assert.deepEqual(rows.map(row=>row.path).sort(),historicalRows.map(row=>row.path).sort());
// Verify the reused capture module against the previously recorded combined
// script hash; runner options changed, but the actual capture/pixel policy did not.
const oldRunner=execFileSync('git',['show','618dae3:experiments/ssg/tooling/full-vrt.mjs']);
const capture=await readFile('experiments/ssg/tooling/full-vrt-capture.mjs');
assert.equal(createHash('sha256').update(oldRunner).update(capture).digest('hex'),historicalRun.scriptHash);
for(const key of ['viewport','colorScheme','locale','timezone','clockTime','browserVersion','workers','policy'])assert.deepEqual(summary[key],historicalRun[key],key);
const historicalByPath=new Map(historicalRows.map(row=>[row.path,row]));
const comparable=rows.filter(row=>row.reference.status==='captured');
const common=comparable.filter(row=>historicalByPath.get(row.path).reference.status==='captured');
const count=(values,key)=>Object.fromEntries([...new Set(values.map(key))].sort().map(value=>[value,values.filter(item=>key(item)===value).length]));
const mode='ox-native-islands';
const kinds=Object.fromEntries([...new Set(rows.map(row=>row.kind))].map(kind=>{const group=rows.filter(row=>row.kind===kind);return[kind,{total:group.length,passed:group.filter(row=>row.results[mode].status==='passed').length,comparable:group.filter(row=>row.reference.status==='captured').length,counts:count(group,row=>row.results[mode].status)}];}));
const pilot=await read('experiments/ssg/results/30/baseline.json');
const pilotPaths=new Set(pilot.pages.map(page=>page.path));
const pilotRows=rows.filter(row=>pilotPaths.has(row.path));assert.equal(pilotRows.length,30);
const oldModes=Object.keys(historicalRows[0].results);
const commonRates=[...oldModes,mode].map(name=>{const passed=common.filter(row=>(name===mode?row:historicalByPath.get(row.path)).results[name].status==='passed').length;return{mode:name,total:common.length,passed,passRatePercent:passed/common.length*100};});
const failures=rows.filter(row=>row.results[mode].status!=='passed'&&row.results[mode].status!=='reference-unavailable');
const result={
 createdAt:new Date().toISOString(),total:1991,mode,summary:summary.summary.find(row=>row.mode===mode),
 reference:summary.summary.find(row=>row.mode==='baseline'),
 referenceFailureCounts:count(rows.filter(row=>row.reference.status!=='captured'),row=>row.reference.status),
 historicalReferenceUnavailable:historicalRows.filter(row=>row.reference.status!=='captured').length,
 historicalReferenceNowAvailable:comparable.filter(row=>historicalByPath.get(row.path).reference.status!=='captured').map(row=>row.path),
 historicalReferenceNowUnavailable:rows.filter(row=>row.reference.status!=='captured'&&historicalByPath.get(row.path).reference.status==='captured').map(row=>row.path),
 commonComparable:common.length,commonComparableRates:commonRates,kinds,
 fullArtifactPilot30:{total:30,passed:pilotRows.filter(row=>row.results[mode].status==='passed').length,counts:count(pilotRows,row=>row.results[mode].status)},
 candidateSsgMedianSeconds:evidence.candidateSsgMedianSeconds,
 elapsedSeconds:(Date.parse(evidence.finishedAt)-Date.parse(evidence.startedAt))/1000,
 capturePolicyMatchesHistorical:true,
 representativeFailures:Object.fromEntries([...new Set(failures.map(row=>row.results[mode].status))].map(status=>[status,failures.filter(row=>row.results[mode].status===status).slice(0,5)])),
};
await writeFile(directory+'/comparison.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
