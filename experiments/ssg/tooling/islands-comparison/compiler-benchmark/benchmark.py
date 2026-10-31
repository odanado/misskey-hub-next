"""2 x 2: minimal CSS / restored pages, stock Vue / Vize. Never parallelize."""
from pathlib import Path
import datetime, hashlib, json, os, re, shutil, statistics, subprocess, time

repo = Path.cwd()
helper = repo / 'experiments/ssg/tooling/islands-comparison/compiler-benchmark'
plans = json.loads((repo / '.pilot/islands-comparison/compiler-inputs.json').read_text())
out = repo / 'experiments/ssg/results/islands-comparison/2026-10-31/vue-pages-vize'
logs = repo / '.pilot/islands-comparison/compiler-benchmark-logs'
out.mkdir(parents=True, exist_ok=True)
logs.mkdir(parents=True, exist_ok=True)

def fingerprint(case):
    digest = hashlib.sha256()
    for name, expected in sorted(plans[case]['files'].items()):
        content = (repo / plans[case]['directory'] / name).read_bytes()
        assert hashlib.sha256(content).hexdigest() == expected, (case, name)
        digest.update(name.encode()); digest.update(content)
    for path in sorted(helper.rglob('*')):
        if path.is_file() and '__pycache__' not in path.parts:
            digest.update(str(path.relative_to(helper)).encode()); digest.update(path.read_bytes())
    digest.update((repo / '.pilot/islands-comparison/vize-deps/pnpm-lock.yaml').read_bytes())
    return digest.hexdigest()

fingerprints = {case: fingerprint(case) for case in plans}

def union_ms(events):
    total, end = 0, float('-inf')
    for event in sorted(events, key=lambda row: row['startMs']):
        total += max(0, event['endMs'] - max(end, event['startMs']))
        end = max(end, event['endMs'])
    return total

def profile_metrics(path, compiler):
    data = json.loads(path.read_text())
    assert data['compiler'] == compiler
    assert len(data['instances']) >= 2 and data['api']
    assert not any(row['failed'] for row in data['api'])
    assert not any(row['failed'] for row in data['events'])
    if compiler == 'vize':
        assert any(row['api'] == 'compileSfc' and row['ssr'] for row in data['api'])
        assert any(row['api'] == 'compileSfc' and not row['ssr'] for row in data['api'])
    core = [row for row in data['api'] if 'style' not in row['api'].lower()]
    styles = [row for row in data['api'] if 'style' in row['api'].lower()]
    hooks = [row for row in data['events'] if row['hook'] == 'buildStart' or (row['hook'] in ['load', 'transform'] and ('.vue' in (row.get('id') or '') or 'vize:all-styles' in (row.get('id') or '')))]
    groups = {}
    for row in data['api']:
        groups.setdefault(row['api'] + ('/ssr' if row['ssr'] else '/client'), []).append(row)
    return {'coreCompilerMs': union_ms(core), 'vueSfcStyleMs': union_ms(styles),
            'allCompilerApiMs': union_ms(data['api']), 'sfcPluginHookMs': union_ms(hooks),
            'apiBreakdown': {key: {'calls': len(rows), 'milliseconds': union_ms(rows)} for key, rows in groups.items()},
            'compiledFileCount': len({file for row in data['api'] for file in row.get('files', [row.get('file')]) if file}),
            'plugins': [instance['plugins'] for instance in data['instances']]}

def verify(base, case):
    public = base / '.pilot/full/ox-native-islands/public'
    inventory = json.loads((base / 'experiments/ssg/results/public-url-count.json').read_text())['urls']
    paths = [path for group in inventory.values() for path in group]
    assert len(set(paths)) == len(list(public.rglob('*.html'))) == 1991
    manifest = json.loads((public / '.vite/manifest.json').read_text())
    js = sorted({entry['file'] for entry in manifest.values() if entry['file'].endswith('.js')})
    css = sorted({file for entry in manifest.values() for file in entry.get('css', [])})
    assert css and not any(key.endswith('.md') for key in manifest)
    counts = dict.fromkeys(['staticUrls', 'ssrVueUrls', 'clientVueUrls', 'languageEntryUrls', 'rawContentUrls'], 0)
    components, contributors = set(), None
    for path in paths:
        html = (public / path.lstrip('/') / 'index.html').read_text()
        assert '<!DOCTYPE html>' in html and '<title>' in html, path
        assert re.search(r'<link rel="stylesheet" href="/assets/[^\"]+\.css"', html), path
        if case == 'vue-pages':
            assert 'data-diagnostic-ui-omitted' not in html and 'UI omitted for this diagnostic' not in html
            if path in inventory['static']:
                counts['staticUrls'] += 1
                match = re.search(r'<script id="vue-page-data" type="application/json">(.*?)</script>', html, re.S)
                assert match, path
                payload = json.loads(match[1]); file = payload['pageFile']; components.add(file)
                assert 'data-original-vue-page="' + file + '"' in html
                if file.endswith('.client.vue'):
                    counts['clientVueUrls'] += 1
                else:
                    counts['ssrVueUrls'] += 1
                    assert len(html.split('<script id="vue-page-data"')[0]) > 1000
                if path == '/ja/about-us/team/':
                    contributors = len(next(iter(payload['fetchCache'].values()))['contributors'])
            elif path in inventory['languageEntry']:
                counts['languageEntryUrls'] += 1
                assert 'data-language-entry' in html and 'location.replace' in html
            else:
                counts['rawContentUrls'] += 1
                assert 'data-raw-ox-content' in html
        else:
            assert 'id="diagnostic-vue-button"' in html
    if case == 'vue-pages':
        assert counts == {'staticUrls': 287, 'ssrVueUrls': 261, 'clientVueUrls': 26, 'languageEntryUrls': 233, 'rawContentUrls': 1471}
        assert len(components) == 23 and contributors > 0
    return {'verifiedUrls': 1991, 'counts': counts if case == 'vue-pages' else None,
            'originalVueFiles': len(components), 'contributors': contributors,
            'jsFiles': len(js), 'jsBytes': sum((public / file).stat().st_size for file in js),
            'cssFiles': len(css), 'cssBytes': sum((public / file).stat().st_size for file in css)}

pairs = [('vue-island-css', 'vue'), ('vue-island-css', 'vize'), ('vue-pages', 'vue'), ('vue-pages', 'vize')]
result = {'startedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
          'base': subprocess.check_output(['git', 'rev-parse', 'HEAD'], text=True).strip(),
          'historicalSourceRef': '6cbe059c5d3b358557f6493b606f196c2ca06e8a',
          'sourceFingerprints': fingerprints,
          'versions': {'vue': '3.5.25', 'pluginVue': '6.0.2', 'vite': '7.3.1', 'vize': '0.609.0', 'oxContent': '3.4.3', 'node': subprocess.check_output(['node', '--version'], text=True).strip()},
          'policy': 'Three fresh PNPM-startup builds for each of four cases; balanced sequential order, no parallel builds/browser. All 1434 Markdown and 156 YAML sources, 1991 URLs, public assets. Original 23 Vue pages/287 URLs, client JS/CSS, contributors live API, SSR and hydration code retained in page variant. Nuxt prepare outside timer as in historical case. Shared root dependencies unchanged; Vize 0.609.0 with Vite 7.3.1 isolated. On-demand SFC compilation (scanPatterns=[]), disk precompile cache disabled, Vite/Vize caches cleared; OS caches retained. Compiler API/hook probes in both variants. Output checks and artifact copying outside timer.',
          'runs': []}
for round in range(3):
    order = pairs if round == 0 else pairs[::-1] if round == 1 else pairs[2:] + pairs[:2]
    for case, compiler in order:
        assert fingerprint(case) == fingerprints[case]
        base = repo / plans[case]['directory']; name = f'{round+1}-{case}-{compiler}'
        profile = logs / (name + '-profile.json'); log = logs / (name + '.log')
        for cache in ['node_modules/.vite', 'node_modules/.vize']:
            shutil.rmtree(repo / cache, ignore_errors=True)
        env = os.environ.copy()
        env.update(HUB_PILOT_PAGES='all', NODE_ENV='production', HUB_VUE_COMPILER=compiler,
                   HUB_COMPARE_CASE=case, HUB_COMPILER_PROFILE=str(profile), VIZE_PRECOMPILE_CACHE='0')
        for key in ['HUB_CONTENT_PILOT', 'HUB_SSG_PROFILE', 'HUB_SSG_CPU_PROFILE', 'NODE_OPTIONS']:
            env.pop(key, None)
        start = time.perf_counter()
        with log.open('wb') as stream:
            process = subprocess.run(['/usr/bin/time', '-l', 'pnpm', 'pilot:ox-islands:build'], cwd=base, env=env, stdout=stream, stderr=subprocess.STDOUT)
        seconds = time.perf_counter() - start
        assert process.returncode == 0, log
        text = log.read_text(); assert 'Custom host generated 1991 output files' in text
        checked = verify(base, case); metrics = profile_metrics(profile, compiler)
        assert fingerprint(case) == fingerprints[case]
        row = {'case': case, 'compiler': compiler, 'round': round+1, 'seconds': seconds, 'exitCode': 0, **checked, **metrics, 'logSha256': hashlib.sha256(log.read_bytes()).hexdigest()}
        result['runs'].append(row)
        result['medians'] = {f'{c}/{v}': {key: statistics.median(r[key] for r in result['runs'] if r['case'] == c and r['compiler'] == v) for key in ['seconds', 'allCompilerApiMs', 'coreCompilerMs', 'vueSfcStyleMs', 'sfcPluginHookMs']} for c,v in pairs if any(r['case'] == c and r['compiler'] == v for r in result['runs'])}
        result['finishedAt'] = datetime.datetime.now(datetime.timezone.utc).isoformat()
        result['sourceUnchanged'] = True
        (out / 'summary.json').write_text(json.dumps(result, indent=2)+'\n')
        print(json.dumps({key: row[key] for key in ['case', 'compiler', 'round', 'seconds', 'allCompilerApiMs', 'sfcPluginHookMs', 'verifiedUrls']}), flush=True)
        if round == 2:
            target = repo / '.pilot/islands-comparison/compiler-artifacts' / case / compiler / 'public'
            shutil.rmtree(target, ignore_errors=True)
            shutil.copytree(base / '.pilot/full/ox-native-islands/public', target)
print(json.dumps(result['medians'], indent=2), flush=True)
