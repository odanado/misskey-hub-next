"""Use one measured median-total run per case so stage rows remain additive."""
from pathlib import Path
from collections import Counter,defaultdict
import json,statistics,hashlib
root=Path('experiments/ssg/results/islands-comparison/2026-10-31');out={}
for case in ['full','pr2','md-only','no-client','no-theme','no-shiki','static-links','cpu','full-end','combined']:
 p=root/case/'summary.json'
 if not p.exists():continue
 s=json.loads(p.read_text());rows=[]
 for run in s['runs']:
  d=json.loads((p.parent/f"run-{run['run']}.json").read_text());m=d['marks']
  stages={'viteStartupClient':m['customHostStart'],'serverModuleLoad':m['hostRoutesStart']-m['customHostStart'],'prepareData':m['hostRoutesEnd']-m['hostRoutesStart'],'renderPages':m['lastPageEnd']-m['hostRoutesEnd'],'writeAndTail':m['buildComplete']-m['lastPageEnd']}
  assert min(stages.values())>=0 and abs(sum(stages.values())-m['buildComplete'])<0.01
  totals=d['totals'];vue={key:{'calls':v['count'],'seconds':v['ms']/1000}for key,v in sorted(totals.items(),key=lambda kv:-kv[1]['ms'])if key.startswith('vue.ssr.')}
  kinds={}
  for page in d['pages']:
   row=kinds.setdefault(page.get('kind','index'if page['path']=='/'else'markdown'),{'urls':0,'renderSeconds':0});row['urls']+=1;row['renderSeconds']+=page['totalMs']/1000
  rows.append({'run':run['run'],'seconds':d['marks']['buildComplete']/1000,'stageSeconds':{k:v/1000 for k,v in stages.items()},'hostTotals':{k:{'calls':v['count'],'seconds':v['ms']/1000}for k,v in totals.items()if k.startswith(('host.','parser.'))},'vue':vue,'byKind':kinds,'bundle':d['bundle'],'output':d['output'],'legacy':d.get('legacy'),'fetches':d['fetches']})
 out[case]={'medianSeconds':s['medianBuildSeconds'],'representativeRun':sorted(rows,key=lambda r:r['seconds'])[len(rows)//2],'runs':rows}
if 'full'in out and 'pr2'in out:
 a=out['full']['representativeRun']['stageSeconds'];b=out['pr2']['representativeRun']['stageSeconds'];out['stageDeltaSeconds']={k:a[k]-b[k]for k in a}
 assert abs(sum(out['stageDeltaSeconds'].values())-(out['full']['medianSeconds']-out['pr2']['medianSeconds']))<0.001
if 'md-only'in out:
 def paths(case):
  i=out[case]['representativeRun']['run'];return {p['path']for p in json.loads((root/case/f'run-{i}.json').read_text())['pages']}
 assert paths('md-only')==paths('pr2')-{'/'}
 out['matchingMarkdownPaths']={'equal':True,'urls':1342,'pr2ExtraIndex':'/','note':'md-only still prepares all source Markdown/YAML and full client registry; isolates extra URL rendering, not all full-site feature cost.'}
for case in ['md-only','no-client','no-theme','no-shiki','static-links']:
 if case in out:out[case]['secondsSavedVsFull']=out['full']['medianSeconds']-out[case]['medianSeconds']
cpu=Path('.pilot/islands-comparison/islands/profile.cpuprofile')
if cpu.exists():
 d=json.loads(cpu.read_text());nodes={n['id']:n for n in d['nodes']};counts=Counter()
 for node,delta in zip(d['samples'],d['timeDeltas']):
  f=nodes[node]['callFrame'];counts[(f['functionName'],f['url'],f['lineNumber']+1)]+=delta/1000
 c={'sha256':hashlib.sha256(cpu.read_bytes()).hexdigest(),'sampledSeconds':sum(counts.values())/1000,'gcSelfSeconds':sum(v for k,v in counts.items()if k[0]=='(garbage collector)')/1000,'policy':'One additional full run, self samples. Includes idle/GC samples, excludes child-process CPU; not additive to wall-clock phases. Raw file retained locally.','topFunctions':[{'function':k[0],'url':k[1],'line':k[2],'selfMs':v}for k,v in counts.most_common(80)]}
 (root/'cpu-functions.json').write_text(json.dumps(c,indent=2)+'\n')
(root/'comparison.json').write_text(json.dumps(out,indent=2)+'\n');print(json.dumps({k:round(v['medianSeconds'],3)for k,v in out.items()if isinstance(v,dict)and'medianSeconds'in v},indent=2))
