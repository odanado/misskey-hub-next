import { readFile, writeFile, mkdir, stat, cp } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { spawn, execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { cpus, platform, arch } from 'node:os';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { loadPages } from '../../ssg/routes.mjs';
import { sourceFingerprint } from '../../tests/vrt/evidence.mjs';

export function unionMilliseconds(events) {
  let total = 0, end = -Infinity;
  for (const event of [...events].sort((a, b) => a.startMs - b.startMs)) {
    total += Math.max(0, event.endMs - Math.max(end, event.startMs));
    end = Math.max(end, event.endMs);
  }
  return total;
}
export function summarizeProfile(profile) {
  assert.ok(profile.instances.length >= 2, 'Missing client or SSR compiler instance');
  assert.ok(profile.api.length > 0, 'Compiler API probes were not exercised');
  assert.ok(!profile.api.some(row => row.failed), 'Failed compiler API call');
  const core = profile.api.filter(row => !row.api.toLowerCase().includes('style'));
  const styles = profile.api.filter(row => row.api.toLowerCase().includes('style'));
  const sfc = profile.events.filter(row => row.hook === 'buildStart' ||
    (['load', 'transform'].includes(row.hook) && (row.id?.includes('.vue') || row.id?.includes('vize:all-styles'))));
  const apiBreakdown = Object.fromEntries(Object.entries(Object.groupBy(profile.api, row => row.api + '/' + (row.ssr ? 'ssr' : 'client')))
    .map(([api, rows]) => [api, { calls: rows.length, milliseconds: unionMilliseconds(rows), files: new Set(rows.flatMap(row => row.files ?? [row.file])).size }]));
  return {
    // Core compiler entry points are synchronous: their union is actual elapsed
    // time inside the APIs. Vue's separate async SFC style pass is also exposed.
    coreCompilerMs: unionMilliseconds(core),
    vueSfcStyleMs: unionMilliseconds(styles),
    allCompilerApiMs: unionMilliseconds(profile.api),
    sfcPluginHookMs: unionMilliseconds(sfc),
    apiBreakdown,
    compiledFiles: [...new Set(profile.api.flatMap(row => row.files ?? [row.file]).filter(Boolean))]
      .map(file => file.replace(resolve('.') + '/', '')).sort(),
    plugins: profile.instances.map(instance => instance.plugins),
  };
}
if (process.argv[1] !== new URL(import.meta.url).pathname) process.exitCode ??= 0;
else {
  const directory = resolve('.vrt/vize-benchmark');
  await mkdir(directory, { recursive: true });
  const pages = await loadPages();
  async function fingerprint() {
    const hash = createHash('sha256').update(await sourceFingerprint());
    for (const name of ['benchmark.mjs', 'profile.mjs', 'compat.mjs']) hash.update(await readFile(new URL(name, import.meta.url)));
    return hash.digest('hex');
  }
  const source = await fingerprint();
  const result = {
    startedAt: new Date().toISOString(),
    base: 'c0aa1d20e1c2225f8c792996c4d5215477d04881',
    commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    dirty: !!execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim(),
    sourceFingerprint: source,
    node: process.version, platform: platform() + '-' + arch(), cpu: cpus()[0].model, cpuCount: cpus().length,
    publicUrls: pages.length,
    versions: { vue: '3.5.25', pluginVue: '6.0.10', vize: '0.609.0', vite: '8.3.5', oxContent: '3.4.3' },
    policy: 'Three sequential fresh pnpm build processes per compiler, alternating order. Full production build through redirects and 404, client JS/CSS and all public URLs; compiler API/hook probes enabled equally, output checks and copying outside timer. VIZE_PRECOMPILE_CACHE=0; Vite default disk precompilation/dependency caches deleted before each run; OS caches retained. No concurrent VRT or builds. No compiler fallback. Standard Vue static-frame parse/compileStyle bridge remains in both variants and is outside compiler probes.',
    runs: [],
  };
  const { rm } = await import('node:fs/promises');
  for (let round = 1; round <= 3; round++) for (const compiler of round % 2 ? ['vue', 'vize'] : ['vize', 'vue']) {
    assert.equal(await fingerprint(), source, 'Sources changed during benchmark');
    await rm('node_modules/.vite', { recursive: true, force: true });
    await rm('node_modules/.vize', { recursive: true, force: true });
    const name = `${round}-${compiler}`, profileFile = resolve(directory, name + '-profile.json');
    const log = createWriteStream(resolve(directory, name + '.log'));
    const began = performance.now();
    const child = spawn('pnpm', ['build'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, NODE_ENV: 'production', TZ: 'Asia/Tokyo', HUB_VUE_COMPILER: compiler, HUB_COMPILER_PROFILE: profileFile, VIZE_PRECOMPILE_CACHE: '0' },
    });
    child.stdout.pipe(log, { end: false }); child.stderr.pipe(log, { end: false });
    const exitCode = await new Promise((ok, fail) => { child.once('error', fail); child.once('close', ok); });
    const seconds = (performance.now() - began) / 1000;
    await new Promise(ok => log.end(ok));
    assert.equal(exitCode, 0, name);
    for (const page of pages) assert.ok((await stat('.output/public' + page.path + 'index.html')).size > 0, page.path);
    assert.ok((await stat('.output/public/404.html')).size > 0);
    const manifest = JSON.parse(await readFile('.output/public/.vite/manifest.json', 'utf8'));
    assert.ok(!Object.keys(manifest).some(key => key.endsWith('.md')));
    const profile = JSON.parse(await readFile(profileFile, 'utf8'));
    assert.equal(profile.compiler, compiler);
    const metrics = summarizeProfile(profile);
    const logText = await readFile(resolve(directory, name + '.log'), 'utf8');
    const clientBuildSeconds = Number(/built in ([\d.]+)s/.exec(logText)?.[1]);
    const row = { round, compiler, seconds, clientBuildSeconds, verifiedPublicUrls: pages.length, exitCode, ...metrics };
    result.runs.push(row);
    console.log(JSON.stringify({ round, compiler, seconds, clientBuildSeconds, coreCompilerMs: metrics.coreCompilerMs, allCompilerApiMs: metrics.allCompilerApiMs, sfcPluginHookMs: metrics.sfcPluginHookMs }));
    assert.equal(await fingerprint(), source, 'Sources changed during benchmark');
    await writeFile(resolve(directory, 'results.json'), JSON.stringify(result, null, 2) + '\n');
    // Keep both final artifacts for reproducible compiler-to-compiler VRT.
    if (round === 3) {
      const target = resolve(directory, compiler, '.output/public');
      await rm(target, { recursive: true, force: true });
      await cp('.output/public', target, { recursive: true });
    }
  }
  const median = numbers => [...numbers].sort((a, b) => a - b)[1];
  result.summary = Object.fromEntries(['vue', 'vize'].map(compiler => {
    const rows = result.runs.filter(row => row.compiler === compiler);
    return [compiler, Object.fromEntries(['seconds', 'clientBuildSeconds', 'coreCompilerMs', 'vueSfcStyleMs', 'allCompilerApiMs', 'sfcPluginHookMs'].map(key => [key, median(rows.map(row => row[key]))]))];
  }));
  result.finishedAt = new Date().toISOString();
  await writeFile(resolve(directory, 'results.json'), JSON.stringify(result, null, 2) + '\n');
  console.table(result.summary);
}
