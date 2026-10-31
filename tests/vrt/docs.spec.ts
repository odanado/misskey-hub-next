import { test, expect } from '@playwright/test';
import { pilotPages as pages } from '../../experiments/ssg/shared/pilot-pages.mjs';
import { expanded, artifactPath } from '../../experiments/ssg/shared/scope.mjs';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { PNG } from 'pngjs';

test.beforeEach(async ({ page }, testInfo) => {
	if (expanded && testInfo.title.includes('/features/mfm/')) await page.clock.install();
	if (testInfo.config.updateSnapshots !== 'none' && process.env.HUB_CONTENT_PILOT !== 'baseline') {
		throw new Error('Snapshots may only be updated from HUB_CONTENT_PILOT=baseline');
	}
	// Both variants use exactly the same offline font policy. No content masking.
	await page.route('**/*', (route) =>
		new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort(),
	);
	await page.addInitScript(
		({ theme }) => {
			if (window !== window.top) return;
			// Same offline emoji-provider fixture for the baseline and every candidate.
			localStorage.setItem('miHub_io_emoji', JSON.stringify({ emojis: [] }));
			if (!localStorage.getItem('pilot-initialized')) {
				localStorage.setItem('nuxt-color-mode', theme);
				localStorage.setItem('miHub_aichan_mode', 'false');
				localStorage.setItem('pilot-initialized', 'true');
			}
		},
		{ theme: testInfo.project.name.endsWith('dark') ? 'dark' : 'light' },
	);
});

test.afterEach(async ({ page }, testInfo) => {
	if (
		!process.env.CI ||
		!expanded ||
		!/^(10|18):/.test(testInfo.title) ||
		!testInfo.project.name.startsWith('desktop')
	)
		return;
	const file = `.pilot/${artifactPath(process.env.HUB_CONTENT_PILOT!)}/vrt/diagnostics/${testInfo.project.name}-${testInfo.title.split(':')[0]}.json`;
	try {
		const diagnostics = await page.evaluate(() => {
			const inspect = (element: Element, allCss = false) => {
				const style = getComputedStyle(element);
				return {
					tag: element.tagName,
					class: element.getAttribute('class'),
					style: element.getAttribute('style'),
					bounds: element.getBoundingClientRect().toJSON(),
					scroll: {
						width: element.scrollWidth,
						height: element.scrollHeight,
						clientWidth: element.clientWidth,
						clientHeight: element.clientHeight,
						left: element.scrollLeft,
						top: element.scrollTop,
					},
					allCss: allCss
						? Object.fromEntries([...style].map((key) => [key, style.getPropertyValue(key)]))
						: undefined,
					css: Object.fromEntries(
						[
							'fontFamily',
							'fontSize',
							'fontWeight',
							'lineHeight',
							'backgroundColor',
							'padding',
							'boxSizing',
							'display',
							'height',
							'overflowX',
							'overflowY',
							'scrollbarColor',
							'scrollbarWidth',
							'opacity',
							'transform',
							'colorScheme',
							'backgroundClip',
							'boxShadow',
							'borderRadius',
							'contain',
							'willChange',
						].map((key) => [key, (style as any)[key]]),
					),
				};
			};
			return {
				devicePixelRatio,
				userAgent: navigator.userAgent,
				pre: [...document.querySelectorAll('.markdown-body pre')].map((pre) => ({
					...inspect(pre, true),
					htmlStart: pre.innerHTML.slice(0, 2000),
					htmlEnd: pre.innerHTML.slice(-1000),
					children: [...pre.querySelectorAll('code, .line')].map((child) =>
						inspect(child, child.tagName === 'CODE'),
					),
					ancestors: (() => {
						const result = [];
						let parent = pre.parentElement;
						for (let i = 0; i < 6 && parent; i++, parent = parent.parentElement)
							result.push(inspect(parent));
						return result;
					})(),
				})),
			};
		});
		await mkdir(dirname(file), { recursive: true });
		await writeFile(file, JSON.stringify(diagnostics, null, 2) + '\n');
	} catch {
		/* Diagnostics must not replace the original test result. */
	}
});

for (const [index, entry] of pages.entries()) {
	test(`${index + 1}: ${entry.path}`, async ({ page, request }, testInfo) => {
		const animated = expanded && entry.path.includes('/features/mfm/');
		async function screenshot(name: string, fullPage = false) {
			if (expanded) {
				await page.mouse.move(0, 0);
				await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
				await page.waitForTimeout(450);
			}
			const animations = animated ? 'allow' : 'disabled';
			const file = `.pilot/${artifactPath(process.env.HUB_CONTENT_PILOT!)}/vrt/captures/${testInfo.project.name}/${name}`;
			await mkdir(dirname(file), { recursive: true });
			let bytes: Buffer;
			if (animated) {
				// Chromium settles MFM's full-page layout on the first capture.
				// Capture without toHaveScreenshot's animation/layout reset, then
				// require two consecutive frames to match before comparing Nuxt.
				let previous = PNG.sync.read(await page.screenshot({ fullPage, animations }));
				const deadline = Date.now() + 5000;
				let stable = false;
				do {
					bytes = await page.screenshot({ fullPage, animations });
					const current = PNG.sync.read(bytes);
					stable =
						current.width === previous.width &&
						current.height === previous.height &&
						current.data.equals(previous.data);
					previous = current;
				} while (!stable && Date.now() < deadline);
				expect(stable, 'Two consecutive identical MFM frames within 5 seconds').toBe(true);
				await writeFile(file, bytes);
				expect(bytes).toMatchSnapshot(name, { maxDiffPixels: 0, threshold: 0 });
			} else {
				await expect(page).toHaveScreenshot(name, { fullPage, animations });
				bytes = await page.screenshot({ path: file, fullPage, animations });
			}
			const actual = PNG.sync.read(bytes);
			const expected = PNG.sync.read(await readFile(testInfo.snapshotPath(name)));
			// Also compare raw RGBA, including antialias pixels, after Playwright's
			// stable-frame capture. This does not rely on a perceptual tolerance.
			expect([actual.width, actual.height]).toEqual([expected.width, expected.height]);
			expect(actual.data.equals(expected.data), `Exact RGBA comparison: ${name}`).toBe(true);
		}
		const errors: string[] = [];
		page.on('pageerror', (error) => errors.push(error.message));
		page.on('console', (msg) => {
			if (/hydration/i.test(msg.text())) errors.push(msg.text());
		});
		page.on('response', (response) => {
			if (new URL(response.url()).hostname === '127.0.0.1' && response.status() >= 400)
				errors.push(`${response.status()} ${response.url()}`);
		});
		// Confirm actual SSG HTML, not an SPA fallback that happens to render later.
		const html = await request.get(entry.path);
		expect(html.status()).toBe(200);
		expect(await html.text()).toContain(entry.title);
		const response = await page.goto(entry.path);
		expect(response?.status()).toBe(200);
		const standalone = process.env.HUB_CONTENT_PILOT === 'standalone';
		if (!standalone) {
			await page.waitForSelector('html[data-pilot-ready="true"]', { state: 'attached' });
			await expect(page.locator('.markdown-body h1')).toHaveText(entry.title);
		} else {
			await expect(page.locator('h1').first()).toHaveText(entry.title);
		}
		await page.evaluate(async () => {
			document.querySelectorAll('img').forEach((img) => {
				img.loading = 'eager';
			});
			await Promise.all(
				[...document.images]
					.filter(
						(img) =>
							img.getAttribute('src') &&
							new URL(img.src, location.href).hostname === location.hostname,
					)
					.map((img) => img.decode()),
			);
			await document.fonts.ready;
		});
		if (animated) {
			const now = await page.evaluate(() => Date.now());
			await page.clock.pauseAt(now + 1000);
		}
		if (expanded) {
			// Commit the first frame before disabling motion. MFM sparkle uses
			// scale: 0 in its first keyframe; simply removing animation would show
			// randomly placed particles and change the screenshot/overflow height.
			await page.evaluate(() => {
				const animations = document.getAnimations();
				for (const animation of animations) {
					if (animation.effect?.getTiming().iterations === Infinity) {
						animation.pause();
						animation.currentTime = 0;
					} else {
						try {
							animation.finish();
						} catch {}
					}
				}
				for (const animation of animations) {
					try {
						animation.commitStyles();
					} catch {}
				}
			});
			await page.addStyleTag({
				content:
					'*, *::before, *::after { animation: none !important; transition: none !important; }',
			});
		}
		expect(errors).toEqual([]);
		if (!standalone) {
			const contract = await page.evaluate(() => ({
				title: document.title,
				lang: document.documentElement.lang,
				canonical: document.querySelector('link[rel="canonical"]')?.getAttribute('href'),
				description: document.querySelector('meta[name="description"]')?.getAttribute('content'),
				headings: [
					...document.querySelectorAll('.markdown-body h1, .markdown-body h2, .markdown-body h3'),
				].map((el) => ({ id: el.id, text: el.textContent })),
				links: [...document.querySelectorAll('.main-content a')].map((el) => ({
					text: el.textContent,
					href: el.getAttribute('href'),
					rel: el.getAttribute('rel'),
					target: el.getAttribute('target'),
				})),
				images: [...document.querySelectorAll('.markdown-body img')].map((el) => ({
					src: el.getAttribute('src'),
					alt: el.getAttribute('alt'),
				})),
				code: [...document.querySelectorAll('.markdown-body pre')].map((el) => el.textContent),
			}));
			expect(JSON.stringify(contract, null, 2)).toMatchSnapshot(`page-${index + 1}-semantics.json`);
		}
		await screenshot(`page-${index + 1}.png`, true);
		if (expanded && (entry as any).expandDetails) {
			const details = page.locator('.markdown-body details').first();
			await details.locator('summary').click();
			await expect(details).toHaveAttribute('open', '');
			await screenshot(`page-${index + 1}-details.png`, true);
			await details.locator('summary').click();
		}
		if (!standalone && index === 0 && testInfo.project.name.startsWith('mobile')) {
			// The docs menu button is immediately before the document body.
			await page.locator('.lg\\:hidden.sticky button').click();
			await screenshot('docs-menu.png');
			await page.locator('.lg\\:hidden.sticky button').click();
			await page.locator('.lg\\:hidden.sticky summary').click();
			await screenshot('docs-toc.png');
			await page.locator('.lg\\:hidden.sticky summary').click();
		}
		if (!standalone && index === 0) {
			await page
				.locator('.markdown-body')
				.getByRole('link', { name: 'ハッシュタグ', exact: true })
				.click();
			await expect(page).toHaveURL(/\/ja\/docs\/for-users\/features\/hashtag\/$/);
			await expect(page.locator('.markdown-body h1')).toHaveText('ハッシュタグ');
			await page.waitForSelector('html[data-pilot-ready="true"]', { state: 'attached' });
			if (testInfo.project.name === 'desktop-light') {
				await page.getByRole('button', { name: 'Change Color Mode' }).click();
				await expect(page.locator('html')).toHaveClass(/dark/);
				await page.reload();
				await page.waitForSelector('html[data-pilot-ready="true"]', { state: 'attached' });
				await expect(page.locator('html')).toHaveClass(/dark/);
			}
			expect(errors).toEqual([]);
		}
	});
}
