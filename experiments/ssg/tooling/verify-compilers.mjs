import { spawn } from 'node:child_process';
import { rm, readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { dirname } from 'node:path';
const outputFile =
	process.argv.find((arg) => arg.startsWith('--output='))?.slice(9) ??
	'experiments/ssg/results/compiler-vrt.json';
const modes = ['baseline', 'ox-ported', 'astro', 'astro-ox'];
async function run(command, args, env = process.env) {
	const child = spawn(command, args, { stdio: 'inherit', env });
	const code = await new Promise((resolve, reject) => {
		child.once('error', reject);
		child.once('close', resolve);
	});
	if (code !== 0) throw new Error(`Failed: ${command} ${args.join(' ')}`);
}
const summaries = [];
for (const mode of modes)
	for (const compiler of ['vue', 'vize']) {
		const artifact = compiler === 'vize' ? `${mode}-vize` : mode;
		console.log('Verifying ' + artifact);
		await rm(`.pilot/${artifact}/vrt/captures`, { recursive: true, force: true });
		await run('pnpm', ['pilot:vrt'], { ...process.env, HUB_CONTENT_PILOT: artifact });
		await run(process.execPath, ['experiments/ssg/tooling/vrt-summary.mjs', artifact]);
		const summary = JSON.parse(await readFile(`.pilot/${artifact}/vrt/summary.json`, 'utf8'));
		if (summary.passed !== 16 || summary.failed) throw new Error('Incomplete VRT ' + artifact);
		const captures = (await readdir(`.pilot/${artifact}/vrt/captures`, { recursive: true })).filter(
			(file) => file.endsWith('.png'),
		);
		if (captures.length !== 20)
			throw new Error(`Expected 20 actual captures: ${artifact}; got ${captures.length}`);
		summaries.push({ ...summary, compiler, exactImages: captures.length });
	}
await mkdir(dirname(outputFile), { recursive: true });
await writeFile(
	outputFile,
	JSON.stringify(
		{
			recordedAt: new Date().toISOString(),
			imagesPerMode: 20,
			pixelPolicy: 'exact decoded RGBA, no masks, no baseline updates',
			summaries,
		},
		null,
		2,
	) + '\n',
);
