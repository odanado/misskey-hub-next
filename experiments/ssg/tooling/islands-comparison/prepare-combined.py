"""Create a separate all-off diagnostic, preserving normal and prior outputs."""
from pathlib import Path
import subprocess,shutil,json,hashlib
repo=Path.cwd();ref='6cbe059c5d3b358557f6493b606f196c2ca06e8a';dest=repo/'.pilot/islands-comparison/combined';assert not dest.exists(),dest
dest.mkdir(parents=True);archive=subprocess.run(['git','archive',ref],check=True,stdout=subprocess.PIPE).stdout
subprocess.run(['tar','-x','-C',str(dest)],input=archive,check=True)
(dest/'node_modules').symlink_to(repo/'node_modules',target_is_directory=True)
assert(dest/'pnpm-lock.yaml').read_bytes()==(repo/'pnpm-lock.yaml').read_bytes()
helper=Path('experiments/ssg/tooling/islands-comparison');shutil.copytree(repo/helper,dest/helper)
shutil.copy(repo/'experiments/ssg/tooling/native-comparison/probe.mjs',dest/helper/'probe.mjs')
native=Path('experiments/ssg/ox-native-islands')
for name in ['host.ts','vite.config.ts']:shutil.copy(repo/helper/'combined'/(name+'.txt'),dest/native/name)
(dest/native/'diagnostic-client.ts').write_text('export {}; // Empty Vite entry; omitted from every output HTML.\n')
files={str(p.relative_to(dest)):hashlib.sha256(p.read_bytes()).hexdigest()for p in sorted(dest.rglob('*'))if p.is_file()and not p.is_symlink()and'node_modules'not in p.parts}
(dest/'diagnostic-source.json').write_text(json.dumps({'ref':ref,'name':'combined','patches':[str(native/p)for p in ['host.ts','vite.config.ts','diagnostic-client.ts']],'files':files},indent=2)+'\n')
print(dest)
