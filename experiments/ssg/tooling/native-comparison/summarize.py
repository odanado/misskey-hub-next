"""Summarize non-overlapping wall-clock phases and optional CPU self samples."""
from pathlib import Path
from collections import defaultdict, Counter
import json, statistics

root = Path('experiments/ssg/results/native-comparison/2026-10-31')
summary = {}
for case in ['pr1-full','pr1-md','pr1-no-md-client','pr2','pr1-cpu']:
    directory = root/case
    if not (directory/'summary.json').exists(): continue
    runs = []
    for file in sorted(directory.glob('run-*.json')):
        d = json.loads(file.read_text()); m = d['marks']; t = d['totals']
        value = lambda key: t.get(key,{}).get('ms',0)
        stages = {
            'startupConfig':m['buildStart'],
            'clientGraph':m['graphEnd']-m['buildStart'],
            'clientRenderWrite':m['customHostStart']-m['graphEnd'],
            'hostStartupImports':m['hostRoutesStart']-m['customHostStart'],
            'data':m['hostDataEnd']-m['hostRoutesStart'],
            'markdownModuleLoad':value('host.loadMarkdown'),
            'appCreateConfigure':value('host.appCreateConfigure'),
            'vueSsr':value('host.vueSsr'),
            'htmlAssetsPayload':value('host.documentAndAssets'),
            'hostRenderOther':m['lastPageEnd']-m['hostDataEnd']-sum(value(k) for k in ['host.loadMarkdown','host.appCreateConfigure','host.vueSsr','host.documentAndAssets']),
            'finalOutputs':m['customHostEnd']-m['lastPageEnd'],
            'tail':m['buildComplete']-m['customHostEnd'],
        }
        assert min(stages.values()) >= -0.01
        assert abs(sum(stages.values())-m['buildComplete'])<0.01
        by_kind={}
        for page in d['pages']:
            key=page.get('kind','markdown' if page['path']!='/' else 'index')
            row=by_kind.setdefault(key,{'pages':0,'ssrMs':0,'loadMs':0,'htmlBytes':0})
            row['pages']+=1
            for metric in ['ssrMs','loadMs','htmlBytes']:row[metric]+=page[metric]
        runs.append({'file':str(file.relative_to(root)),'buildSeconds':m['buildComplete']/1000,'stagesSeconds':{k:v/1000 for k,v in stages.items()},'byKind':by_kind,'bundle':d['bundle'],'output':d['output'],'mdcCalls':{k:v['count'] for k,v in t.items() if k.startswith('mdc.')},'markdownTransforms':{k:v['count'] for k,v in t.items() if k.startswith('hook.ox-native-mdc-output.transform') and k.endswith('.md')}})
    # Keep a single actual run's additive phases; medians of individual phases
    # do not generally add to the median of total times.
    selected=sorted(runs,key=lambda x:x['buildSeconds'])[len(runs)//2]
    summary[case]={'medianBuildSeconds':statistics.median(x['buildSeconds'] for x in runs),'representativeRun':selected,'runs':runs}

if 'pr2' in summary and 'pr1-md' in summary:
    paths=lambda case:set(x['path'] for x in json.loads((root/summary[case]['representativeRun']['file']).read_text())['pages'])
    a=paths('pr1-md'); b=paths('pr2')-{'/'}
    assert a==b and len(a)==1342
    summary['routeSetCheck']={'equalMarkdownPaths':True,'paths':len(a),'pr2ExtraIndex':'/'}
if 'pr1-no-md-client' in summary and 'pr1-md' in summary:
    assert paths('pr1-no-md-client')==paths('pr1-md')
    summary['routeSetCheck']['ablationPathsEqual']=True

cpu=Path('.pilot/native-comparison/pr1-cpu/profile.cpuprofile')
if cpu.exists():
    d=json.loads(cpu.read_text());nodes={n['id']:n for n in d['nodes']}
    totals=Counter()
    for node_id,delta in zip(d.get('samples',[]),d.get('timeDeltas',[])):
        f=nodes[node_id]['callFrame']; totals[(f['functionName'],f['url'],f['lineNumber']+1)]+=delta/1000
    cpu_summary={'sampledSeconds':sum(totals.values())/1000,'gcSelfSeconds':sum(v for k,v in totals.items() if k[0]=='(garbage collector)')/1000,'policy':'CPU self samples from one additional run; not additive to wall-clock stages. Child-process CPU not captured.','topFunctions':[{'function':k[0],'url':k[1],'line':k[2],'selfMs':v} for k,v in totals.most_common(50)]}
    (root/'cpu-functions.json').write_text(json.dumps(cpu_summary,indent=2)+'\n')
(root/'comparison.json').write_text(json.dumps(summary,indent=2)+'\n')
print(json.dumps({k:round(v['medianBuildSeconds'],3) for k,v in summary.items() if isinstance(v,dict) and 'medianBuildSeconds' in v},indent=2))
