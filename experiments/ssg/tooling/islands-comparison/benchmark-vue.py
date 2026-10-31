"""Interleaved PNPM startup-inclusive builds: baseline, client Vue, SSR Vue."""
from pathlib import Path
import subprocess,json,hashlib,os,time,statistics,re,datetime,sys
repo=Path.cwd();css_mode='--css' in sys.argv;out=repo/'experiments/ssg/results/islands-comparison/2026-10-31'/('vue-css'if css_mode else'vue-only');out.mkdir(parents=True,exist_ok=True);cases=['vue-island','vue-island-css']if css_mode else['combined','vue-client','vue-island'];evidence={};fingerprints={}
def source(case):
 h=hashlib.sha256();base=repo/'.pilot/islands-comparison'/case
 for name,expected in sorted(evidence[case]['files'].items()):
  b=(base/name).read_bytes();assert hashlib.sha256(b).hexdigest()==expected,(case,name);h.update(name.encode());h.update(b)
 return h.hexdigest()
for case in cases:
 evidence[case]=json.loads((repo/'.pilot/islands-comparison'/case/'diagnostic-source.json').read_text());fingerprints[case]=source(case)
 inputs={k:v for k,v in evidence[case]['files'].items()if k.startswith(('content/','public/','components/','pages/','layouts/','locales/','assets/'))};reference={k:v for k,v in evidence[cases[0]]['files'].items()if k.startswith(('content/','public/','components/','pages/','layouts/','locales/','assets/'))};assert inputs==reference
 (out/(case+'-source.json')).write_text(json.dumps({k:v for k,v in evidence[case].items()if k!='files'},indent=2)+'\n')
result={'startedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'cssComparison':css_mode,'sourceFingerprints':fingerprints,'originalInputsIdentical':True,'policy':'Three fresh-process PNPM-startup-inclusive builds per case; rotated order each round. CSS case restores global CSS, UnoCSS, Sass, autoprefixer/cssnano and existing SFC style blocks without site UI scripts. Timer includes Vite/client build, all 1434 raw Ox Markdown and 156 YAML reads, all 1991 HTML and public copy. Verification outside timer. UI/MDC/Shiki/HAST compatibility remains off. OS caches retained.','runs':[]}
for round in range(3):
 for case in cases[round%len(cases):]+cases[:round%len(cases)]:
  assert source(case)==fingerprints[case];base=repo/'.pilot/islands-comparison'/case;env=os.environ.copy();env.update(HUB_PILOT_PAGES='all',NODE_ENV='production',HUB_VUE_COMPILER='vue',HUB_COMPARE_CASE=case)
  for k in ['HUB_CONTENT_PILOT','HUB_SSG_PROFILE','HUB_SSG_CPU_PROFILE','NODE_OPTIONS']:env.pop(k,None)
  log=out/f'{case}-{round+1}.log';start=time.perf_counter()
  with log.open('wb')as stream:p=subprocess.run(['/usr/bin/time','-l','pnpm','pilot:ox-islands:build'],cwd=base,env=env,stdout=stream,stderr=subprocess.STDOUT)
  elapsed=time.perf_counter()-start;assert p.returncode==0,log;text=log.read_text();assert 'Custom host generated 1991 output files'in text
  public=base/'.pilot/full/ox-native-islands/public';paths=[p for values in json.loads((base/'experiments/ssg/results/public-url-count.json').read_text())['urls'].values()for p in values];assert len(set(paths))==1991 and len(list(public.rglob('*.html')))==1991
  manifest=json.loads((public/'.vite/manifest.json').read_text());js=[e['file']for e in manifest.values()if e['file'].endswith('.js')];bytes=sum((public/f).stat().st_size for f in js)
  assert not any(k.endswith('.md')for k in manifest)
  css=sorted({f for e in manifest.values()for f in ([e['file']]if e['file'].endswith('.css')else[])+e.get('css',[])});css_bytes=sum((public/f).stat().st_size for f in css)
  assert bool(css)==(case=='vue-island-css')
  css_sources=None
  if css:
   css_sources=json.loads(re.search(r'^\[diagnostic-css\] (.+)$',text,re.M)[1]);content='\n'.join((public/f).read_text()for f in css)
   for token in ['.markdown-body','.form-control','text-accent-600','_docsLayoutWithAsideToc_']:assert token in content,token
   assert '@apply'not in content and '@screen'not in content
  for path in paths:
   html=(public/path.lstrip('/')/'index.html').read_text();assert 'data-diagnostic-combined'in html and '<!DOCTYPE html>'in html and '<title>'in html
   if case=='combined':assert 'diagnostic-vue-root'not in html
   else:
    assert 'id="diagnostic-vue-root"'in html and any('/'+f in html for f in js)
    assert ('id="diagnostic-vue-button"'in html)==(case not in ['combined','vue-client'])
   if css: assert all('href="/'+f+'"'in html for f in css)
  assert source(case)==fingerprints[case];rss=re.search(r'^\s*(\d+)\s+maximum resident set size\s*$',text,re.M)
  row={'case':case,'round':round+1,'seconds':elapsed,'exitCode':0,'verifiedUrls':1991,'clientJsBytes':bytes,'clientJsFiles':len(js),'clientCssBytes':css_bytes,'clientCssFiles':len(css),'cssSources':css_sources,'peakRssBytes':int(rss[1])if rss else None,'logSha256':hashlib.sha256(log.read_bytes()).hexdigest()};result['runs'].append(row);print(json.dumps(row),flush=True)
  result['medians']={c:statistics.median(r['seconds']for r in result['runs']if r['case']==c)for c in {r['case']for r in result['runs']}};result['sourceUnchanged']=True;result['finishedAt']=datetime.datetime.now(datetime.timezone.utc).isoformat();(out/'summary.json').write_text(json.dumps(result,indent=2)+'\n')
