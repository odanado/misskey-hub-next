import { Worker, MessageChannel } from "node:worker_threads";
import { availableParallelism } from "node:os";
import { mkdtempSync, mkdirSync, existsSync, renameSync } from "node:fs";
import { rm } from "node:fs/promises";
import { resolve } from "node:path";
import { resolvePageAssets } from "../page-assets.mjs";
import { createBuildFetch } from "./fetch-cache.mjs";

const observed = (promise) => (void promise.catch(() => {}), promise);
const deferred = () => {
	let resolve, reject;
	const promise = observed(
		new Promise((ok, fail) => {
			resolve = ok;
			reject = fail;
		}),
	);
	return { promise, resolve, reject };
};

export function createBuildPipeline(root) {
	const started = performance.now(),
		marks = { node: process.version };
	const fetchJson = createBuildFetch();
	const cores = availableParallelism(),
		count = Math.min(8, Math.max(1, cores - 4));
	const channels = Array.from({ length: count }, () => new MessageChannel());
	const workers = [],
		pending = new Map(),
		data = deferred(),
		copied = deferred(),
		outputDone = deferred(),
		ready = [],
		done = [];
	let failure,
		submitted = false,
		disposal;
	const cache = resolve(root, ".cache/ssg");
	mkdirSync(cache, { recursive: true });
	const outDir = mkdtempSync(resolve(cache, "renderer-"));
	const fail = (error) => {
		failure ??= error;
		data.reject(failure);
		copied.reject(failure);
		outputDone.reject(failure);
		for (const task of pending.values()) task.reject(failure);
		for (const task of [...ready, ...done]) task.reject(failure);
	};
	const create = (file, options, handle) => {
		const worker = new Worker(new URL(file, import.meta.url), options);
		workers.push(worker);
		let finished = false;
		worker.on("message", (message) => {
			if (message.type === "error") fail(new Error(message.error));
			else if (message.type === "fetch") {
				observed(
					fetchJson(message.url)
						.then(
							(data) => worker.postMessage({ type: "fetch-result", id: message.id, data }),
							(error) =>
								worker.postMessage({
									type: "fetch-result",
									id: message.id,
									error: error.stack ?? String(error),
								}),
						)
						.catch(fail),
				);
			} else {
				finished = handle(message) || finished;
			}
		});
		worker.on("error", fail);
		worker.on("exit", (code) => {
			if (!disposal && (code || !finished))
				fail(new Error("SSG worker exited early: " + file + " (" + code + ")"));
		});
		return worker;
	};
	const publicOut = resolve(root, ".output/public"),
		outputCache = mkdtempSync(resolve(cache, "output-"));
	const previous = existsSync(publicOut) ? resolve(outputCache, "previous") : undefined;
	if (previous) renameSync(publicOut, previous);
	mkdirSync(publicOut, { recursive: true });
	create(
		"./output-worker.mjs",
		{ workerData: { publicDir: resolve(root, "public"), outDir: publicOut, previous } },
		(message) => {
			if (message.type === "copied") {
				marks.publicCopied = performance.now() - started;
				copied.resolve();
			} else if (message.type === "done") {
				outputDone.resolve();
				return true;
			}
		},
	);
	const renderers = channels.map((channel) => {
		const initialized = deferred(),
			complete = deferred();
		ready.push(initialized);
		done.push(complete);
		return create(
			"./render-worker.mjs",
			{ workerData: { port: channel.port2 }, transferList: [channel.port2] },
			(message) => {
				if (message.type === "ready") {
					marks["rendererReady" + ready.indexOf(initialized)] = performance.now() - started;
					initialized.resolve();
				} else if (message.type === "done") {
					(marks.asideCache ??= [])[done.indexOf(complete)] = message.asideCache;
					marks["rendererDone" + done.indexOf(complete)] = performance.now() - started;
					complete.resolve();
					return true;
				} else if (message.type === "batch") {
					for (const { index, result } of message.results) {
						const task = pending.get(index);
						if (!task) {
							fail(new Error("Unscheduled rendered page: " + index));
							break;
						}
						pending.delete(index);
						task.resolve(result);
					}
				}
			},
		);
	});
	create(
		"./renderer-compiler.mjs",
		{
			workerData: { root, outDir },
			env: { ...process.env, MISSKEY_SSG_RENDERER_BUILD: "1" },
		},
		(message) => {
			if (message.type !== "bundle") {
				fail(new Error("Unexpected renderer compiler result"));
				return false;
			}
			marks.bundleReady = performance.now() - started;
			for (const worker of renderers) worker.postMessage(message);
			return true;
		},
	);
	create(
		"./data-worker.mjs",
		{
			workerData: {
				root,
				count: Math.min(4, Math.max(1, Math.floor(cores / 2))),
				ports: channels.map((channel) => channel.port1),
			},
			transferList: channels.map((channel) => channel.port1),
			execArgv: ["--experimental-strip-types"],
		},
		(message) => {
			if (message.type !== "data") {
				fail(new Error("Unexpected prepared dataset"));
				return false;
			}
			marks.dataReady = performance.now() - started;
			marks.dataPhases = message.timings;
			data.resolve(message);
			return true;
		},
	);
	return {
		copyPublic: () => copied.promise,
		host: {
			async routes() {
				const { pages, lanes } = await data.promise;
				if (failure) throw failure;
				const tasks = pages.map((_, index) => {
					const task = deferred();
					pending.set(index, task);
					return task.promise;
				});
				return pages.map((page, index) => ({
					path: page.path,
					...(page.source ? { inputPath: resolve(root, "content", page.source) } : {}),
					async render(context) {
						if (!submitted) {
							submitted = true;
							const assets = resolvePageAssets(context, pages);
							marks.clientReady = performance.now() - started;
							observed(
								Promise.all(ready.map((task) => task.promise))
									.then(() => {
										if (failure) throw failure;
										renderers.forEach((worker, index) =>
											worker.postMessage({ type: "render", indices: lanes[index], assets, pages }),
										);
									})
									.catch(fail),
							);
						}
						return tasks[index];
					},
				}));
			},
		},
		async close() {
			await outputDone.promise;
			if (submitted && !failure) await Promise.all(done.map((task) => task.promise));
			if (failure) throw failure;
			if (process.env.MISSKEY_SSG_PROFILE === "1")
				console.log("[ssg-workers] " + JSON.stringify(marks));
		},
		dispose() {
			return (disposal ??= (async () => {
				await Promise.allSettled(workers.map((worker) => worker.terminate()));
				channels.forEach(({ port1, port2 }) => {
					port1.close();
					port2.close();
				});
				await rm(outDir, { recursive: true, force: true });
				await rm(outputCache, { recursive: true, force: true });
			})());
		},
	};
}
