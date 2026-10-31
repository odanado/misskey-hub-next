"""Sequential diagnostic runs. Output stays isolated from normal VRT/builds.

python3 experiments/ssg/tooling/native-comparison/benchmark.py CASE [RUNS]
CASE: pr1-full, pr1-md, pr1-no-md-client, pr2, pr1-cpu
"""
from pathlib import Path
import subprocess, os, sys, time, json, hashlib, statistics, re

repo = Path.cwd()
case = sys.argv[1]
count = int(sys.argv[2]) if len(sys.argv) > 2 else 3
assert case in ['pr1-full','pr1-md','pr1-no-md-client','pr2','pr1-cpu']
ref = 'c52b733c227aaf5f91341544aebe4c3977800cee' if case == 'pr2' else 'ab4eec512675e6403e0ed8d142a3e3620dce9b60'
helper = Path('experiments/ssg/tooling/native-comparison')
checkout = repo/'.pilot/native-comparison'/case
if not checkout.exists():
    subprocess.run(['python3', str(helper/'prepare.py'), ref, case], check=True)
evidence = json.loads((checkout/'diagnostic-source.json').read_text())
output = repo/'experiments/ssg/results/native-comparison/2026-10-31'/case
output.mkdir(parents=True, exist_ok=True)
(output/'source.json').write_text(json.dumps({k:v for k,v in evidence.items() if k!='files'},indent=2)+'\n')
def fingerprint():
    digest=hashlib.sha256()
    for file, expected in sorted(evidence['files'].items()):
        value=(checkout/file).read_bytes()
        assert hashlib.sha256(value).hexdigest()==expected, file
        digest.update(file.encode());digest.update(value)
    return digest.hexdigest()
source=fingerprint()
env=os.environ.copy()
env.update({'HUB_PILOT_PAGES':'all','NODE_ENV':'production','HUB_VUE_COMPILER':'vue','HUB_SSG_PROFILE':'1'})
for key in ['HUB_CONTENT_PILOT','HUB_SSG_CPU_PROFILE']:
    env.pop(key,None)
results=[]
for run in range(1,count+1):
    assert fingerprint()==source
    profile=output/f'run-{run}.json'
    env['HUB_COMPARE_OUTPUT']=str(profile)
    env['HUB_COMPARE_CPU']='1' if case=='pr1-cpu' else '0'
    env['HUB_COMPARE_CPU_FILE']=str(checkout/'profile.cpuprofile')
    start=time.perf_counter()
    log=output/f'run-{run}.log'
    with log.open('wb') as stream:
        built=subprocess.run(['/usr/bin/time','-l','node',str(helper/'run.mjs')],cwd=checkout,env=env,stdout=stream,stderr=subprocess.STDOUT)
    elapsed=time.perf_counter()-start
    assert built.returncode==0, str(log)
    data=json.loads(profile.read_text())
    expected=1343 if case=='pr2' else 1342 if case in ['pr1-md','pr1-no-md-client'] else 1991
    assert data['output']['htmlFiles']==len(data['pages'])==expected
    # Use the original verifier after timing. MD-only compatibility builds expose
    # the same filtered route list, so their original verifier remains applicable.
    check=subprocess.run(['pnpm','pilot:ox-native:verify'],cwd=checkout,env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True)
    (output/f'verify-{run}.log').write_text(check.stdout)
    assert check.returncode==0,check.stdout
    rss=re.search(r'^\s*(\d+)\s+maximum resident set size\s*$',log.read_text(),re.M)
    row={'run':run,'processSeconds':elapsed,'buildSeconds':data['marks']['buildComplete']/1000,'htmlFiles':expected,'exitCode':built.returncode,'verifyExitCode':check.returncode,'peakRssBytes':int(rss[1]) if rss else None,'profileSha256':hashlib.sha256(profile.read_bytes()).hexdigest(),'logSha256':hashlib.sha256(log.read_bytes()).hexdigest()}
    results.append(row)
    print(json.dumps({'case':case,**row}),flush=True)
    assert fingerprint()==source
    (output/'summary.json').write_text(json.dumps({'case':case,'ref':ref,'sourceFingerprint':source,'sourceUnchanged':True,'runs':results,'medianBuildSeconds':statistics.median(x['buildSeconds'] for x in results),'medianProcessSeconds':statistics.median(x['processSeconds'] for x in results),'policy':'Instrumented isolated snapshot; processSeconds includes Node startup and post-build output enumeration; compare buildSeconds for stages. Original verifier outside timer. OS caches retained. No VRT.'},indent=2)+'\n')
