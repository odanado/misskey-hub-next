"""Structural/asset checks, deliberately not a visual compatibility verifier."""
from pathlib import Path
import json,hashlib
base=Path('.pilot/islands-comparison/combined');public=base/'.pilot/full/ox-native-islands/public';r=Path('experiments/ssg/results/islands-comparison/2026-10-31');summary=json.loads((r/'combined/summary.json').read_text())
assert len(list(public.rglob('*.html')))==1991
manifest=json.loads((public/'.vite/manifest.json').read_text());entries=[v['file']for v in manifest.values()if v.get('isEntry')];assert len(entries)==1 and(public/entries[0]).stat().st_size==1
paths=[p for urls in json.loads((base/'experiments/ssg/results/public-url-count.json').read_text())['urls'].values()for p in urls];assert len(set(paths))==1991
for path in paths:
 html=(public/path.lstrip('/')/'index.html').read_text();assert '<!DOCTYPE html>'in html and 'data-diagnostic-combined'in html and '<title>'in html;assert entries[0]not in html
assets=[p for p in(base/'public').rglob('*')if p.is_file()];size=0
for p in assets:
 out=public/p.relative_to(base/'public');assert out.read_bytes()==p.read_bytes(),p;size+=p.stat().st_size
for run in summary['runs']:
 d=json.loads((r/f"combined/run-{run['run']}.json").read_text());assert d['diagnostic']['markdownSources']==1434 and d['diagnostic']['yamlSources']==156
 assert d['totals']['parser.rawOxMarkdown']['count']==1434;assert not[k for k in d['totals']if'vue'in k.lower()or k.startswith('mdc.')];assert not d['fetches'];assert d['bundle']['js']['bytes']==1 and'css'not in d['bundle']
normal=Path('.pilot/full/ox-native-islands/public');preserved=None
if(normal/'.vite/manifest.json').exists():
 saved=json.loads(Path('experiments/ssg/results/ox-native-islands/2026-10-31/timings-full.json').read_text());assert hashlib.sha256((normal/'.vite/manifest.json').read_bytes()).hexdigest()==saved['runs'][-1]['client']['manifestSha256'];assert len(list(normal.rglob('*.html')))==1991;preserved=True
out={'publicHtmlFiles':1991,'sourceMarkdown':1434,'sourceYaml':156,'rawOxMarkdownCallsPerRun':1434,'publicAssetsCopiedExactly':len(assets),'publicAssetBytes':size,'vueTransformHooks':0,'mdcCalls':0,'clientCssFiles':0,'clientEntryBytes':1,'clientEntryReferencedInHtml':False,'normalFullBuildStillPresent':preserved,'normalClientManifestMatchesSavedBenchmark':preserved,'policy':'Checks outside timer; raw Ox HTML, raw YAML text and explicit placeholders for omitted fixed/language UI. Not VRT or functional parity.'}
(r/'combined/verification.json').write_text(json.dumps(out,indent=2)+'\n');print(json.dumps(out))
