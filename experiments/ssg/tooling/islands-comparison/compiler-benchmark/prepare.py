"""Preserve historical cases; stage identical inputs with a switchable compiler."""
from pathlib import Path
import json,hashlib,shutil
repo=Path.cwd();helper=repo/'experiments/ssg/tooling/islands-comparison/compiler-benchmark';plans={}
for case in ['vue-island-css','vue-pages']:
 source=repo/'.pilot/islands-comparison'/case;dest=repo/'.pilot/islands-comparison'/('compiler-'+case)
 assert not dest.exists(),dest
 evidence=json.loads((source/'diagnostic-source.json').read_text())
 for name,expected in evidence['files'].items():
  path=source/name;assert hashlib.sha256(path.read_bytes()).hexdigest()==expected,(case,name)
  target=dest/name;target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(path,target)
 (dest/'node_modules').symlink_to(repo/'node_modules',target_is_directory=True)
 config=dest/'experiments/ssg/ox-native-islands/vite.config.ts';text=config.read_text()
 for old in ["import vue from'@vitejs/plugin-vue';","import vue from '@vitejs/plugin-vue';"]:
  if old in text:text=text.replace(old,'import {compilerPlugins} from '+json.dumps(str(helper/'compiler.mjs'))+';')
 old="vue({template:{compilerOptions:{isCustomElement:(tag)=>tag==='model-viewer'}}})" if case=='vue-pages'else'vue()'
 assert text.count(old)==1,case;text=text.replace(old,'...await compilerPlugins(root)');config.write_text(text)
 files={name:hashlib.sha256((dest/name).read_bytes()).hexdigest()for name in evidence['files']}
 plans[case]={'directory':str(dest.relative_to(repo)),'historicalRef':evidence['ref'],'files':files}
(dest.parent/'compiler-inputs.json').write_text(json.dumps(plans,indent=2)+'\n')
print('Prepared:',list(plans))
