import { test } from 'node:test';
import assert from 'node:assert/strict';
import { unionMilliseconds, summarizeProfile } from './benchmark.mjs';
test('overlapping and nested async hook intervals are counted once', () => {
  assert.equal(unionMilliseconds([{startMs: 8,endMs: 20},{startMs: 0,endMs: 10},{startMs: 2,endMs: 3},{startMs: 30,endMs: 35}]),25);
  assert.equal(unionMilliseconds([]),0);
});
test('compiler profile requires both build instances and actual API work', () => {
  assert.throws(() => summarizeProfile({instances:[{},{}],api:[],events:[]}), /not exercised/);
  assert.throws(() => summarizeProfile({instances:[{}],api:[],events:[]}), /Missing/);
});
test('compiler API time and broad SFC hook time stay separate', () => {
  const profile={instances:[{plugins:['vite:vue']},{plugins:['vite:vue']}],api:[{api:'parse',file:'a.vue',startMs:0,endMs:5},{api:'compileStyleAsync',file:'a.vue',startMs:10,endMs:15}],events:[{hook:'transform',id:'a.vue',startMs:0,endMs:20}]};
  assert.deepEqual(Object.fromEntries(Object.entries(summarizeProfile(profile)).filter(([key])=>key.endsWith('Ms'))),{coreCompilerMs:5,vueSfcStyleMs:5,allCompilerApiMs:10,sfcPluginHookMs:20});
});
