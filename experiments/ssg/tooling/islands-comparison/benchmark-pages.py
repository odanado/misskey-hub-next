"""Interleave original Vue pages with the previous CSS/minimal-counter control."""
from pathlib import Path
import subprocess,json,hashlib,os,time,statistics,re,datetime
repo=Path.cwd();out=repo/'experiments/ssg/results/islands-comparison/2026-10-31/vue-pages';out.mkdir(parents=True,exist_ok=True);cases=['vue-island-css','vue-pages'];evidence={};fingerprints={}
def source(case):
 h=hashlib.sha256();base=repo/'.pilot/islands-comparison'/case
 for name,expected in sorted(evidence[case]['files'].items()):
  b=(base/name).read_bytes();assert hashlib.sha256(b).hexdigest()==expected,(case,name);h.update(name.encode());h.update(b)
 return h.hexdigest()
for case in cases:
 evidence[case]=json.loads((repo/'.pilot/islands-comparison'/case/'diagnostic-source.json').read_text());fingerprints[case]=source(case)
 (out/(case+'-source.json')).write_text(json.dumps({k:v for k,v in evidence[case].items()if k!='files'},indent=2)+'\n')
reference=evidence[cases[0]]['files'];candidate=evidence[cases[1]]['files']
for directory in ['content','public','pages','layouts','locales']:
 assert {k:v for k,v in reference.items()if k.startswith(directory+'/')}=={k:v for k,v in candidate.items()if k.startswith(directory+'/')},directory
allowed={'assets/data/i18n-members.ts','assets/js/mi/io-emojis.ts','components/index/mobile.vue'}
differing=[p for p in sorted(set(reference)|set(candidate))if p.startswith(('assets/','components/'))and reference.get(p)!=candidate.get(p)];assert set(differing)<=allowed,differing
result={'startedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sourceFingerprints':fingerprints,'identicalInputs':['content','public','pages','layouts','locales'],'supportDifferences':differing,'policy':'Three fresh PNPM-startup builds per case, order alternated per round, no concurrent browser/VRT. Full 1434 raw Ox Markdown and 156 YAML reads, all 1991 URLs and public copy. Candidate restores 287 original Vue URLs (26 .client), layouts/i18n/data and hydration. Nuxt prepare outside timer. Live contributors API fetched per candidate process and cached into hydration payload; auxiliary browser APIs outside SSG. Verification outside timer; OS caches retained.','runs':[]}
for round in range(3):
 for case in(cases if round%2==0 else cases[::-1]):
  assert source(case)==fingerprints[case];base=repo/'.pilot/islands-comparison'/case;env=os.environ.copy();env.update(HUB_PILOT_PAGES='all',NODE_ENV='production',HUB_VUE_COMPILER='vue',HUB_COMPARE_CASE=case)
  for key in ['HUB_CONTENT_PILOT','HUB_SSG_PROFILE','HUB_SSG_CPU_PROFILE','NODE_OPTIONS']:env.pop(key,None)
  log=out/f'{case}-{round+1}.log';start=time.perf_counter()
  with log.open('wb')as stream:process=subprocess.run(['/usr/bin/time','-l','pnpm','pilot:ox-islands:build'],cwd=base,env=env,stdout=stream,stderr=subprocess.STDOUT)
  seconds=time.perf_counter()-start;assert process.returncode==0,log;text=log.read_text();assert 'Custom host generated 1991 output files'in text
  public=base/'.pilot/full/ox-native-islands/public';inventory=json.loads((base/'experiments/ssg/results/public-url-count.json').read_text())['urls'];paths=[path for group in inventory.values()for path in group];assert len(set(paths))==len(list(public.rglob('*.html')))==1991
  manifest=json.loads((public/'.vite/manifest.json').read_text());js=sorted({entry['file']for entry in manifest.values()if entry['file'].endswith('.js')});css=sorted({f for entry in manifest.values()for f in entry.get('css',[])});assert css and not any(k.endswith('.md')for k in manifest)
  counts={'staticUrls':0,'ssrVueUrls':0,'clientVueUrls':0,'languageEntryUrls':0,'rawContentUrls':0};components=set();contributors=None
  for path in paths:
   html=(public/path.lstrip('/')/'index.html').read_text();assert '<!DOCTYPE html>'in html and '<title>'in html,path
   assert re.search(r'<link rel="stylesheet" href="/assets/[^\"]+\.css"',html),path
   if case=='vue-pages':
    assert 'data-diagnostic-ui-omitted'not in html and 'UI omitted for this diagnostic'not in html,path
    if path in inventory['static']:
     counts['staticUrls']+=1;match=re.search(r'<script id="vue-page-data" type="application/json">(.*?)</script>',html,re.S);assert match,path;payload=json.loads(match[1]);file=payload['pageFile'];components.add(file);assert 'data-original-vue-page="'+file+'"'in html,path
     if file.endswith('.client.vue'):counts['clientVueUrls']+=1
     else:counts['ssrVueUrls']+=1;assert len(html.split('<script id="vue-page-data"')[0])>1000,path
     if path=='/ja/about-us/team/':contributors=len(next(iter(payload['fetchCache'].values()))['contributors'])
    elif path in inventory['languageEntry']:
     counts['languageEntryUrls']+=1;assert 'data-language-entry'in html and 'location.replace'in html,path
    else:counts['rawContentUrls']+=1;assert 'data-raw-ox-content'in html,path
   else:assert 'id="diagnostic-vue-button"'in html,path
  if case=='vue-pages':assert counts=={'staticUrls':287,'ssrVueUrls':261,'clientVueUrls':26,'languageEntryUrls':233,'rawContentUrls':1471},counts;assert contributors>0
  assert source(case)==fingerprints[case];rss=re.search(r'^\s*(\d+)\s+maximum resident set size\s*$',text,re.M)
  row={'case':case,'round':round+1,'seconds':seconds,'exitCode':0,'verifiedUrls':1991,'counts':counts if case=='vue-pages'else None,'originalVueFiles':len(components)if components else None,'contributors':contributors,'jsFiles':len(js),'jsBytes':sum((public/f).stat().st_size for f in js),'cssFiles':len(css),'cssBytes':sum((public/f).stat().st_size for f in css),'peakRssBytes':int(rss[1])if rss else None,'logSha256':hashlib.sha256(log.read_bytes()).hexdigest()};result['runs'].append(row);print(json.dumps(row),flush=True)
  result['medians']={c:statistics.median(r['seconds']for r in result['runs']if r['case']==c)for c in{r['case']for r in result['runs']}};result['sourceUnchanged']=True;result['finishedAt']=datetime.datetime.now(datetime.timezone.utc).isoformat();(out/'summary.json').write_text(json.dumps(result,indent=2)+'\n')
