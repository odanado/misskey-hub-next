import { spawn } from 'node:child_process';
import { rm, readFile, writeFile, mkdir } from 'node:fs/promises';
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
for (const mode of modes) {
	console.log('Verifying ' + mode);
	await rm(`.pilot/${mode}/vrt/captures`, { recursive: true, force: true });
	await run('pnpm', ['pilot:vrt'], { ...process.env, HUB_CONTENT_PILOT: mode });
	await run(process.execPath, ['experiments/ssg/tooling/vrt-summary.mjs', mode]);
	const summary = JSON.parse(await readFile(`.pilot/${mode}/vrt/summary.json`, 'utf8'));
	if (summary.passed !== 16 || summary.failed) throw new Error('Incomplete VRT ' + mode);
	summaries.push(summary);
}
await mkdir('experiments/ssg/results', { recursive: true });
await writeFile(
	'experiments/ssg/results/vrt.json',
	JSON.stringify(
		{
			recordedAt: new Date().toISOString(),
			imagesPerMode: 20,
			pixelPolicy: 'exact decoded RGBA, no masks, no baseline updates',
			semanticAssertions:
				'SEO, headings, links, alt text, code, menu, TOC, navigation, color-mode persistence',
			summaries,
		},
		null,
		2,
	) + '\n',
);
