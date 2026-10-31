// Run after timed builds, not concurrently. Counts only; no optimization applied.
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { parseFrontmatter } from '@ox-content/napi';
import { prepareNativeMarkdown } from '../../shared/content/ox-native.mjs';
import { createHash } from 'node:crypto';
const sets={all:new Set(),code:new Set(),component:new Set()}, counts={all:0,code:0,component:0};
let sources=0;
for(const source of (await readdir('content',{recursive:true})).filter(p=>p.endsWith('.md')&&!p.split('/').some(x=>x.startsWith('.')))) {
	const body=parseFrontmatter(await readFile('content/'+source,'utf8')).content;
	const prepared=prepareNativeMarkdown({source,body},{mdcIslands:true,allowUnclosedContainers:true});sources++;
	for(const [index,snippet] of prepared.snippets.entries()){
		const kind=index<prepared.componentSnippets?'component':'code';
		const key=createHash('sha256').update(snippet).digest('hex');
		counts.all++;counts[kind]++;sets.all.add(key);sets[kind].add(key);
	}
}
const output={sources,counts,unique:Object.fromEntries(Object.entries(sets).map(([k,v])=>[k,v.size])),policy:'Exact byte-identical source snippets only. Potential cache reuse count, not measured speedup. Cached ASTs would need immutable handling and parser/highlighter configuration in the key.'};
await writeFile('experiments/ssg/results/islands-comparison/2026-10-31/snippets.json',JSON.stringify(output,null,2)+'\n');console.log(output);
