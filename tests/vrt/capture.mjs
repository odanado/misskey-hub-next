import { PNG } from "pngjs";

// Identical PNG bytes necessarily contain identical pixels. Decode only when
// encoded bytes differ; metadata/compression differences still use strict RGBA.
export function compareCaptures(reference, candidate) {
	if (reference.bytes.equals(candidate.bytes))
		return { equal: true, differentPixels: 0 };
	reference.png ??= PNG.sync.read(reference.bytes);
	candidate.png ??= PNG.sync.read(candidate.bytes);
	return comparePixels(reference.png, candidate.png);
}

export function comparePixels(reference, candidate) {
	if (
		reference.width !== candidate.width ||
		reference.height !== candidate.height
	)
		return {
			equal: false,
			reason: "dimensions",
			reference: [reference.width, reference.height],
			candidate: [candidate.width, candidate.height],
		};
	if (reference.data.equals(candidate.data))
		return { equal: true, differentPixels: 0 };
	let differentPixels = 0;
	for (let i = 0; i < reference.data.length; i += 4) {
		if (
			reference.data[i] !== candidate.data[i] ||
			reference.data[i + 1] !== candidate.data[i + 1] ||
			reference.data[i + 2] !== candidate.data[i + 2] ||
			reference.data[i + 3] !== candidate.data[i + 3]
		)
			differentPixels++;
	}
	return {
		equal: false,
		reason: "pixels",
		differentPixels,
		totalPixels: reference.width * reference.height,
	};
}

export async function capturePage(page, url, { clockTime } = {}) {
	const clock = /\/features\/mfm\//.test(url) || !/\/(docs|blog)\//.test(url);
	const errors = [];
	const pendingLocalRequests = new Set();
	page.on("request", (request) => {
		if (new URL(request.url()).hostname === "127.0.0.1")
			pendingLocalRequests.add(request);
	});
	page.on("requestfinished", (request) => pendingLocalRequests.delete(request));
	page.on("requestfailed", (request) => pendingLocalRequests.delete(request));
	const report = (message) => {
		if (errors.length < 20) errors.push(String(message).slice(0, 1000));
	};
	page.on("pageerror", (error) => report(error.message));
	page.on("console", (message) => {
		if (/hydration/i.test(message.text())) report(message.text());
	});
	page.on("response", (response) => {
		if (
			new URL(response.url()).hostname === "127.0.0.1" &&
			response.status() >= 400
		)
			report(`${response.status()} ${response.url()}`);
	});
	try {
		if (clock)
			await page.clock.install({ time: new Date(clockTime ?? Date.now()) });
		const response = await page.goto(url, {
			waitUntil: "load",
			timeout: 20_000,
		});
		if (response?.status() !== 200)
			throw new Error("HTTP " + response?.status());
		await page.waitForSelector('html[data-site-ready="true"]', {
			state: "attached",
			timeout: 8000,
		});
		// A client-only tool can request its chunk after the root mounts.
		const requestDeadline = Date.now() + 5000;
		while (pendingLocalRequests.size && Date.now() < requestDeadline)
			await page.waitForTimeout(50);
		await page.evaluate(async () => {
			document.querySelectorAll("img").forEach((img) => {
				img.loading = "eager";
			});
			await document.fonts.ready;
			await Promise.allSettled(
				[...document.images]
					.filter(
						(img) =>
							img.getAttribute("src") &&
							new URL(img.src, location.href).hostname === location.hostname,
					)
					.map((img) => img.decode()),
			);
		});
		// Let layout/IntersectionObserver callbacks update the docs TOC before
		// pausing time. Freezing the application clock too early races scrollspy.
		// Use an absolute clock for deterministic WebGL shader timestamps as well.
		await page.waitForTimeout(200);
		if (clock) await page.clock.pauseAt(new Date(clockTime).getTime() + 30_000);
		await page.mouse.move(0, 0);
		await page.evaluate(() => {
			window.scrollTo({ top: 0, behavior: "instant" });
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
				"*, *::before, *::after { animation: none !important; transition: none !important; }",
		});
		if (errors.length)
			return {
				status: "runtime-error",
				errors,
				finalPath: new URL(page.url()).pathname,
			};
		const started = Date.now();
		let previous = {
			bytes: await page.screenshot({
				fullPage: true,
				animations: "allow",
				timeout: 10_000,
			}),
		};
		let bytes,
			stable = false;
		do {
			bytes = await page.screenshot({
				fullPage: true,
				animations: "allow",
				timeout: 10_000,
			});
			const current = { bytes };
			stable = compareCaptures(previous, current).equal;
			previous = current;
		} while (!stable && Date.now() - started < 5000);
		if (!stable)
			return {
				status: "unstable",
				errors: ["No two consecutive identical frames within 5 seconds"],
			};
		return {
			status: errors.length ? "runtime-error" : "captured",
			errors,
			bytes,
			finalPath: new URL(page.url()).pathname,
		};
	} catch (error) {
		return { status: "capture-error", errors: [error.message, ...errors] };
	}
}

export async function createFixtureContext(browser, options = {}) {
	const context = await browser.newContext({
		viewport: options.viewport ?? { width: 1440, height: 900 },
		locale: "ja-JP",
		timezoneId: "Asia/Tokyo",
		colorScheme: options.colorScheme ?? "light",
		reducedMotion: "reduce",
		serviceWorkers: "block",
	});
	await context.route("**/*", (route) =>
		new URL(route.request().url()).hostname === "127.0.0.1"
			? route.continue()
			: route.abort(),
	);
	await context.addInitScript(() => {
		if (window !== window.top) return;
		localStorage.setItem("miHub_io_emoji", JSON.stringify({ emojis: [] }));
		localStorage.setItem("nuxt-color-mode", "light");
		localStorage.setItem("miHub_aichan_mode", "false");
		// Reproducible client-side randomness for static/canvas examples as well.
		let state = 0x12345678;
		Math.random = () => {
			state ^= state << 13;
			state ^= state >>> 17;
			state ^= state << 5;
			return (state >>> 0) / 4294967296;
		};
	});
	return context;
}
