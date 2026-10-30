import { spawn } from 'node:child_process';
import { rm } from 'node:fs/promises';

async function run(command, args, env = process.env) {
	const child = spawn(command, args, { stdio: 'inherit', env });
	const code = await new Promise((resolve, reject) => {
		child.once('error', reject);
		child.once('close', resolve);
	});
	if (code !== 0) throw new Error(`${command} ${args.join(' ')} failed (${code})`);
}
for (const mode of ['baseline', 'query', 'native']) {
	console.log(`Verifying ${mode}`);
	await rm(`.pilot/${mode}/vrt/captures`, { recursive: true, force: true });
	await run('pnpm', ['pilot:vrt'], { ...process.env, HUB_CONTENT_PILOT: mode });
	await run(process.execPath, ['experiments/ssg/tooling/vrt-summary.mjs', mode]);
}
