// Compare the unmodified PR #2 static theme against the frozen Nuxt references.
// Static readiness replaces only the unavailable hydration wait; pixels, DOM
// contracts and required UI states are still compared without tolerance/masks.
import { chromium } from '@playwright/test';
import { PNG } from 'pngjs';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import { readFile, writeFile, mkdir, readdir, stat } from 'node:fs/promises';
import { resolve, dirname, extname, sep } from 'node:path';
import { pilotPages as pages } from '../shared/pilot-pages.mjs';
import { baselineHashes } from '../ox-native/evidence.mjs';
if (process.env.HUB_PILOT_PAGES !== '30' || pages.length !== 30)
	throw new Error('Use HUB_PILOT_PAGES=30');
const commit = 'c52b733c227aaf5f91341544aebe4c3977800cee';
const checkout = resolve(process.argv[2] ?? '.pilot/pr2-standalone');
const output = 'experiments/ssg/results/pr2-standalone/2026-10-31';
const artifacts = resolve('.pilot/pr2-vrt-30');
const publicDir = resolve(checkout, '.pilot/30/ox-native-theme/public');
const sha = (data) => createHash('sha256').update(data).digest('hex');
const files = execFileSync('git', ['ls-tree', '-r', '--name-only', commit], { encoding: 'utf8' }).trim().split('\n');
async function fingerprint() {
	const hash = createHash('sha256');
	for (const file of [...files].sort()) hash.update(file).update(await readFile(resolve(checkout, file)));
	return hash.digest('hex');
}
await mkdir(output, { recursive: true });
await mkdir(artifacts, { recursive: true });
const source = await fingerprint();
const standalone = JSON.parse(await readFile(output + '/timings.json', 'utf8'));
if (source !== standalone.sourceFingerprint) throw new Error('PR #2 source differs from unmodified benchmark');
if (!Buffer.from(await readFile(resolve(checkout, 'pnpm-lock.yaml'))).equals(await readFile('pnpm-lock.yaml')))
	throw new Error('Dependency lock differs');
const baseline = await baselineHashes();
async function command(script, name) {
	const env = { ...process.env, HUB_PILOT_PAGES: '30', NODE_ENV: 'production' };
	for (const name of ['HUB_CONTENT_PILOT', 'HUB_SSG_PROFILE', 'HUB_SSG_CPU_PROFILE', 'HUB_VUE_COMPILER']) delete env[name];
	const child = spawn('pnpm', [script], { cwd: checkout, env, stdio: ['ignore', 'pipe', 'pipe'] });
	let log = '';
	child.stdout.on('data', (bytes) => { log += bytes; });
	child.stderr.on('data', (bytes) => { log += bytes; });
	const code = await new Promise((ok, fail) => { child.once('error', fail); child.once('close', ok); });
	await writeFile(resolve(artifacts, name + '.log'), log);
	if (code !== 0) throw new Error(script + ' failed: ' + log);
	return { script, exitCode: code, logSha256: sha(log) };
}
const startedAt = new Date().toISOString();
const build = await command('pilot:ox-native:build', 'build');
const verification = await command('pilot:ox-native:verify', 'verify');
const htmlFiles = (await readdir(publicDir, { recursive: true })).filter((p) => p.endsWith('.html'));
if (htmlFiles.length !== 31) throw new Error('Expected 30 selected pages + index');
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.woff2': 'font/woff2', '.woff': 'font/woff' };
const server = createServer(async (req, res) => {
	try {
		let file = resolve(publicDir, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
		if (file !== publicDir && !file.startsWith(publicDir + sep)) throw new Error('Forbidden');
		if ((await stat(file)).isDirectory()) file = resolve(file, 'index.html');
		const bytes = await readFile(file);
		res.writeHead(200, { 'Content-Type': mime[extname(file)] ?? 'application/octet-stream' }); res.end(bytes);
	} catch { res.writeHead(404); res.end('Not found'); }
});
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const origin = 'http://127.0.0.1:' + server.address().port;
const projects = ['light', 'dark'].flatMap((theme) => ['desktop', 'mobile'].map((device) => ({
	name: device + '-' + theme, theme, mobile: device === 'mobile',
	viewport: device === 'mobile' ? { width: 390, height: 844 } : { width: 1440, height: 900 },
})));
const tasks = projects.flatMap((project) => pages.map((entry, index) => ({ project, entry, index })));
const rows = [];
let cursor = 0, browser;
async function compareImage(page, project, name, fullPage) {
	await page.mouse.move(0, 0);
	await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
	await page.waitForTimeout(450);
	const animated = page.url().includes('/features/mfm/');
	const animations = animated ? 'allow' : 'disabled';
	let previous, bytes, stable = false;
	for (let i = 0; i < 8; i++) {
		bytes = await page.screenshot({ fullPage, animations });
		const current = PNG.sync.read(bytes);
		if (previous && current.width === previous.width && current.height === previous.height && current.data.equals(previous.data)) { stable = true; break; }
		previous = current;
	}
	const dir = resolve(artifacts, 'captures', project.name);
	await mkdir(dir, { recursive: true }); await writeFile(resolve(dir, name), bytes);
	const expectedBytes = await readFile(resolve('tests/vrt/snapshots/30', project.name, name));
	const expected = PNG.sync.read(expectedBytes), actual = PNG.sync.read(bytes);
	const dimensionsEqual = expected.width === actual.width && expected.height === actual.height;
	let differentOverlapPixels = 0;
	const width = Math.min(expected.width, actual.width), height = Math.min(expected.height, actual.height);
	for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
		const a = (y * actual.width + x) * 4, b = (y * expected.width + x) * 4;
		if ([0, 1, 2, 3].some((c) => actual.data[a + c] !== expected.data[b + c])) differentOverlapPixels++;
	}
	const equal = dimensionsEqual && actual.data.equals(expected.data);
	return { name, status: stable && equal ? 'passed' : 'different', stable, expected: [expected.width, expected.height], actual: [actual.width, actual.height], dimensionsEqual, differentOverlapPixels, rgbaEqual: equal, actualPngSha256: sha(bytes), expectedPngSha256: sha(expectedBytes) };
}
async function check({ project, entry, index }) {
	const context = await browser.newContext({ viewport: project.viewport, colorScheme: project.theme, isMobile: project.mobile, hasTouch: project.mobile, locale: 'ja-JP', timezoneId: 'Asia/Tokyo', reducedMotion: 'reduce', serviceWorkers: 'block' });
	const row = { project: project.name, path: entry.path, index: index + 1, images: [], errors: [] };
	const page = await context.newPage();
	try {
		const animated = entry.path.includes('/features/mfm/');
		if (animated) await page.clock.install();
		await page.route('**/*', (route) => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
		await page.addInitScript(({ theme }) => {
			if (window !== window.top) return;
			localStorage.setItem('miHub_io_emoji', JSON.stringify({ emojis: [] }));
			if (!localStorage.getItem('pilot-initialized')) {
				localStorage.setItem('nuxt-color-mode', theme); localStorage.setItem('miHub_aichan_mode', 'false'); localStorage.setItem('pilot-initialized', 'true');
			}
		}, { theme: project.theme });
		page.on('pageerror', (error) => row.errors.push(error.message));
		page.on('console', (msg) => { if (/hydration/i.test(msg.text())) row.errors.push(msg.text()); });
		page.on('response', (res) => { if (new URL(res.url()).hostname === '127.0.0.1' && res.status() >= 400) row.errors.push(res.status() + ' ' + new URL(res.url()).pathname); });
		const html = await context.request.get(origin + entry.path);
		row.ssgStatus = html.status(); row.ssgContainsTitle = (await html.text()).includes(entry.title);
		const response = await page.goto(origin + entry.path);
		row.browserStatus = response?.status();
		row.imageDecodeErrors = await page.evaluate(async () => {
			document.querySelectorAll('img').forEach((img) => { img.loading = 'eager'; });
			const errors = [];
			await Promise.all([...document.images].filter((img) => img.getAttribute('src') && new URL(img.src, location.href).hostname === location.hostname).map((img) => img.decode().catch(() => errors.push(img.getAttribute('src')))));
			await document.fonts.ready; return errors;
		});
		if (animated) await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 1000);
		await page.evaluate(() => {
			const animations = document.getAnimations();
			for (const animation of animations) {
				if (animation.effect?.getTiming().iterations === Infinity) { animation.pause(); animation.currentTime = 0; }
				else { try { animation.finish(); } catch {} }
			}
			for (const animation of animations) { try { animation.commitStyles(); } catch {} }
		});
		await page.addStyleTag({ content: '*, *::before, *::after { animation: none !important; transition: none !important; }' });
		row.surface = await page.evaluate(() => ({ readyMarker: document.documentElement.dataset.pilotReady === 'true', markdownRoot: !!document.querySelector('.markdown-body'), firstHeading: document.querySelector('h1')?.textContent, themeButton: !!document.querySelector('button[aria-label="Change Color Mode"]') }));
		const contract = await page.evaluate(() => ({
			title: document.title, lang: document.documentElement.lang,
			canonical: document.querySelector('link[rel="canonical"]')?.getAttribute('href'), description: document.querySelector('meta[name="description"]')?.getAttribute('content'),
			headings: [...document.querySelectorAll('.markdown-body h1, .markdown-body h2, .markdown-body h3')].map((el) => ({ id: el.id, text: el.textContent })),
			links: [...document.querySelectorAll('.main-content a')].map((el) => ({ text: el.textContent, href: el.getAttribute('href'), rel: el.getAttribute('rel'), target: el.getAttribute('target') })),
			images: [...document.querySelectorAll('.markdown-body img')].map((el) => ({ src: el.getAttribute('src'), alt: el.getAttribute('alt') })), code: [...document.querySelectorAll('.markdown-body pre')].map((el) => el.textContent),
		}));
		const expected = await readFile(resolve('tests/vrt/snapshots/30', project.name, `page-${index + 1}-semantics.json`));
		const semantic = Buffer.from(JSON.stringify(contract, null, 2));
		row.semanticsEqual = semantic.equals(expected);
		row.semanticActual = contract;
		row.semanticSha256 = { actual: sha(semantic), expected: sha(expected) };
		row.images.push(await compareImage(page, project, `page-${index + 1}.png`, true));
		if (entry.expandDetails) {
			const name = `page-${index + 1}-details.png`, details = page.locator('.markdown-body details').first();
			if (!(await details.count())) row.images.push({ name, status: 'unavailable', reason: 'Existing details/summary control is absent' });
			else {
				await details.locator('summary').click();
				row.images.push(await compareImage(page, project, name, true));
				await details.locator('summary').click();
			}
		}
		if (index === 0 && project.mobile) {
			for (const [name, selector] of [['docs-menu.png', '.lg\\:hidden.sticky button'], ['docs-toc.png', '.lg\\:hidden.sticky summary']]) {
				const control = page.locator(selector);
				if (!(await control.count())) row.images.push({ name, status: 'unavailable', reason: 'Existing mobile navigation control is absent' });
				else { await control.click(); row.images.push(await compareImage(page, project, name, false)); await control.click(); }
			}
		}
		row.status = row.images.every((image) => image.status === 'passed') && row.semanticsEqual && row.surface.readyMarker && row.ssgStatus === 200 && row.browserStatus === 200 && row.ssgContainsTitle && !row.errors.length && !row.imageDecodeErrors.length ? 'passed' : 'failed';
	} catch (error) { row.status = 'error'; row.error = String(error.stack ?? error); }
	finally { await context.close(); }
	rows.push(row);
	await writeFile(resolve(artifacts, 'progress.json'), JSON.stringify({ completed: rows.length, total: tasks.length, passed: rows.filter((r) => r.status === 'passed').length }));
	if (rows.length % 10 === 0) console.log('[pr2-vrt] ' + rows.length + '/' + tasks.length);
}
try {
	browser = await chromium.launch();
	await Promise.all(Array.from({ length: 2 }, async () => { while (cursor < tasks.length) await check(tasks[cursor++]); }));
} finally { await browser?.close(); await new Promise((ok) => server.close(ok)); }
rows.sort((a, b) => projects.findIndex((p) => p.name === a.project) - projects.findIndex((p) => p.name === b.project) || a.index - b.index);
if ((await fingerprint()) !== source) throw new Error('PR #2 sources changed');
if (JSON.stringify(await baselineHashes()) !== JSON.stringify(baseline)) throw new Error('Frozen baseline changed');
const images = rows.flatMap((row) => row.images);
const counts = (items, key) => items.reduce((out, row) => { out[row[key]] = (out[row[key]] ?? 0) + 1; return out; }, {});
const result = {
	startedAt, finishedAt: new Date().toISOString(), commit, sourceFingerprint: source, sourceUnchanged: true,
	build, verification, generatedHtml: htmlFiles.length, pages: pages.length, conditions: projects,
	comparisonCases: rows.length, passed: rows.filter((row) => row.status === 'passed').length, caseStatuses: counts(rows, 'status'),
	expectedImageStates: 144, observedImageStates: images.length, imageStatuses: counts(images, 'status'),
	semanticsPassed: rows.filter((row) => row.semanticsEqual).length,
	baselineUnchanged: true, baselineHashes: baseline,
	policy: 'Unmodified PR #2 head, 30-page scope; existing 264 Nuxt reference files; exact PNG dimensions and decoded RGBA, no masks/tolerance/baseline updates. Same viewport/theme/locale/timezone/offline/font/emoji/motion policy. Static font/image readiness instead of absent hydration marker, recorded separately as missing. This is a dedicated comparison harness, not a claim that the original docs.spec.ts passed. Unavailable detail/menu states count as failures, never skips.',
	rows,
};
await writeFile(output + '/vrt-30.json', JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ cases: result.comparisonCases, passed: result.passed, caseStatuses: result.caseStatuses, images: result.imageStatuses, semanticsPassed: result.semanticsPassed, baselineUnchanged: true }));
if (rows.length !== 120 || images.length !== 144 || rows.some((row) => row.status === 'error')) process.exitCode = 2;
