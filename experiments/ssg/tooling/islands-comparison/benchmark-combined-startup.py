"""Same PNPM build boundary as the earlier 25.07-second result."""
from pathlib import Path
import json,hashlib,os,subprocess,time,statistics,re,datetime
repo=Path.cwd();checkout=repo/'.pilot/islands-comparison/combined';out=repo/'experiments/ssg/results/islands-comparison/2026-10-31/combined-startup';out.mkdir(parents=True,exist_ok=True)
evidence=json.loads((checkout/'diagnostic-source.json').read_text())
def source():
 h=hashlib.sha256()
 for name,expected in sorted(evidence['files'].items()):
  b=(checkout/name).read_bytes();assert hashlib.sha256(b).hexdigest()==expected,name;h.update(name.encode());h.update(b)
 return h.hexdigest()
fingerprint=source();env=os.environ.copy();env.update(HUB_PILOT_PAGES='all',NODE_ENV='production',HUB_VUE_COMPILER='vue',HUB_COMPARE_CASE='combined')
for k in ['HUB_CONTENT_PILOT','HUB_SSG_PROFILE','HUB_SSG_CPU_PROFILE','NODE_OPTIONS']:env.pop(k,None)
public=checkout/'.pilot/full/ox-native-islands/public';inventory=json.loads((checkout/'experiments/ssg/results/public-url-count.json').read_text());paths=[p for values in inventory['urls'].values()for p in values];assert len(set(paths))==1991
result={'startedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sourceFingerprint':fingerprint,'policy':'Three sequential fresh PNPM/Node builds; timer from PNPM invocation to awaited process exit. Same command boundary as earlier 25.07 seconds. Verification outside timer; full public copy; all 1434 Markdown/156 YAML read, all 1991 URLs output. Diagnostic removes visual/functionality work and unused supporting dependencies.','runs':[]}
for index in range(1,4):
 assert source()==fingerprint;log=out/f'run-{index}.log';start=time.perf_counter()
 with log.open('wb')as stream:p=subprocess.run(['/usr/bin/time','-l','pnpm','pilot:ox-islands:build'],cwd=checkout,env=env,stdout=stream,stderr=subprocess.STDOUT)
 seconds=time.perf_counter()-start;assert p.returncode==0,log;text=log.read_text();assert 'Custom host generated 1991 output files'in text
 assert len(list(public.rglob('*.html')))==1991
 for path in paths:
  html=(public/path.lstrip('/')/'index.html').read_text();assert '<!DOCTYPE html>'in html and 'data-diagnostic-combined'in html and '<title>'in html,path
 assert source()==fingerprint
 rss=re.search(r'^\s*(\d+)\s+maximum resident set size\s*$',text,re.M)
 row={'run':index,'seconds':seconds,'exitCode':0,'verifiedUrls':1991,'peakRssBytes':int(rss[1])if rss else None,'logSha256':hashlib.sha256(log.read_bytes()).hexdigest()};result['runs'].append(row);print(json.dumps(row),flush=True)
 result['medianSeconds']=statistics.median(r['seconds']for r in result['runs']);result['sourceUnchanged']=True;result['finishedAt']=datetime.datetime.now(datetime.timezone.utc).isoformat();(out/'summary.json').write_text(json.dumps(result,indent=2)+'\n')
