import { defineConfig } from '@playwright/test';
import { expanded, fullSite, artifactPath } from './experiments/ssg/shared/scope.mjs';
if (fullSite)
	throw new Error('Full-site scope has no approved VRT baseline; use HUB_PILOT_PAGES=4 or 30');
const artifact = artifactPath(process.env.HUB_CONTENT_PILOT ?? 'baseline');

export default defineConfig({
	testDir: './tests/vrt',
	snapshotPathTemplate: `{testDir}/snapshots/${expanded ? '30/' : ''}{projectName}/{arg}{ext}`,
	fullyParallel: false,
	workers: expanded ? 2 : 1,
	outputDir: `.pilot/${artifact}/vrt/test-results`,
	retries: 0,
	updateSnapshots: 'none',
	timeout: 60_000,
	expect: { toHaveScreenshot: { maxDiffPixels: 0, threshold: 0 } },
	reporter: [
		['list'],
		['html', { open: 'never', outputFolder: `.pilot/${artifact}/vrt/html` }],
		['json', { outputFile: `.pilot/${artifact}/vrt/results.json` }],
	],
	use: {
		baseURL: 'http://127.0.0.1:4173',
		locale: 'ja-JP',
		timezoneId: 'Asia/Tokyo',
		reducedMotion: 'reduce',
		serviceWorkers: 'block',
	},
	webServer: {
		command: 'node experiments/ssg/tooling/serve.mjs',
		url: 'http://127.0.0.1:4173/ja/docs/for-users/features/note/',
		reuseExistingServer: false,
	},
	projects: ['light', 'dark'].flatMap((colorScheme) => [
		{
			name: `desktop-${colorScheme}`,
			use: { viewport: { width: 1440, height: 900 }, colorScheme: colorScheme as 'light' | 'dark' },
		},
		{
			name: `mobile-${colorScheme}`,
			use: {
				viewport: { width: 390, height: 844 },
				colorScheme: colorScheme as 'light' | 'dark',
				isMobile: true,
				hasTouch: true,
			},
		},
	]),
});
