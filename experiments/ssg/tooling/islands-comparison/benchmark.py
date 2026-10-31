"""Run one diagnostic case sequentially, preserving per-run evidence."""
from pathlib import Path
import subprocess,sys,os,json,time,hashlib,re,statistics,datetime
repo=Path.cwd();case=sys.argv[1];count=int(sys.argv[2])if len(sys.argv)>2 else 3
assert case in ['full','md-only','no-client','no-theme','static-links','no-shiki','pr2','cpu','full-end','combined']
checkout=repo/'.pilot/islands-comparison'/('pr2'if case=='pr2'else'combined'if case=='combined'else'islands')
evidence=json.loads((checkout/'diagnostic-source.json').read_text());output=repo/'experiments/ssg/results/islands-comparison/2026-10-31'/case;output.mkdir(parents=True,exist_ok=True)
(output/'source.json').write_text(json.dumps({k:v for k,v in evidence.items()if k!='files'},indent=2)+'\n')
def fingerprint():
 h=hashlib.sha256()
 for file,expected in sorted(evidence['files'].items()):
  b=(checkout/file).read_bytes();assert hashlib.sha256(b).hexdigest()==expected,file;h.update(file.encode());h.update(b)
 return h.hexdigest()
source=fingerprint();env=os.environ.copy();env.update(HUB_PILOT_PAGES='all',NODE_ENV='production',HUB_VUE_COMPILER='vue',HUB_SSG_PROFILE='1',HUB_COMPARE_CASE='full'if case in ['cpu','full-end']else case,HUB_COMPARE_CPU='1'if case=='cpu'else'0',HUB_COMPARE_CPU_FILE=str(checkout/'profile.cpuprofile'))
for key in ['HUB_CONTENT_PILOT','HUB_SSG_CPU_PROFILE','NODE_OPTIONS']:env.pop(key,None)
rows=[];started=datetime.datetime.now(datetime.timezone.utc).isoformat()
for index in range(1,count+1):
 assert fingerprint()==source
 file=output/f'run-{index}.json';env['HUB_COMPARE_OUTPUT']=str(file);log=output/f'run-{index}.log';t=time.perf_counter()
 with log.open('wb')as stream:p=subprocess.run(['/usr/bin/time','-l','node','experiments/ssg/tooling/islands-comparison/run.mjs'],cwd=checkout,env=env,stdout=stream,stderr=subprocess.STDOUT)
 seconds=time.perf_counter()-t;assert p.returncode==0,log
 data=json.loads(file.read_text());expected=1343 if case=='pr2'else 1342 if case=='md-only'else 1991
 assert data['output']['htmlFiles']==len(data['pages'])==expected
 text=log.read_text();assert 'Failed to resolve component'not in text and 'Unhandled error'not in text
 native='ox-native'if case=='pr2'else'ox-native-islands';artifact='ox-native-theme'if case=='pr2'else'ox-native-islands';public=checkout/'.pilot/full'/artifact/'public'
 # Structural checks for all cases. Ablations intentionally omit visual work.
 for row in data['pages']:
  html=(public/row['path'].lstrip('/')/'index.html').read_text();assert re.search(r'<!DOCTYPE html>',html,re.I)and '<title>'in html,row['path']
 verify=None
 if case not in ['no-theme','combined']:
  command=['pnpm','pilot:ox-native:verify'if case=='pr2'else'pilot:ox-islands:verify'];v=subprocess.run(command,cwd=checkout,env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True)
  (output/f'verify-{index}.log').write_text(v.stdout);assert v.returncode==0,v.stdout;verify=v.returncode
 rss=re.search(r'^\s*(\d+)\s+maximum resident set size\s*$',text,re.M)
 row={'run':index,'processSeconds':seconds,'buildSeconds':data['marks']['buildComplete']/1000,'htmlFiles':expected,'exitCode':p.returncode,'originalVerifierExitCode':verify,'peakRssBytes':int(rss[1])if rss else None,'profileSha256':hashlib.sha256(file.read_bytes()).hexdigest(),'logSha256':hashlib.sha256(log.read_bytes()).hexdigest()};rows.append(row);assert fingerprint()==source
 result={'case':case,'ref':evidence['ref'],'sourceFingerprint':source,'sourceUnchanged':True,'startedAt':started,'finishedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'runs':rows,'medianBuildSeconds':statistics.median(r['buildSeconds']for r in rows),'medianProcessSeconds':statistics.median(r['processSeconds']for r in rows),'policy':'Instrumented isolated archive. buildSeconds: before Vite import to awaited build completion; excludes PNPM/Node startup, output enumeration and verification. All cases sequential, OS caches retained. Ablations intentionally remove visual/functionality work, not migration candidates. Inclusive hook/async totals overlap and are not additive.'}
 (output/'summary.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({'case':case,**row}),flush=True)
