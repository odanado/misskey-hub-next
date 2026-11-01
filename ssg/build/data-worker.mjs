import { parentPort, workerData, Worker } from "node:worker_threads";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { parseFrontmatter, buildCollectionManifest } from "@ox-content/napi";
import { prepareNativeMarkdown } from "../markdown-native.mjs";
import { assignLanes, preparePayloads } from "./payloads.mjs";
import { legacyMdcSources } from "../../nuxt-compat/legacy-sources.ts";

const started = performance.now(),
	timings = {};
const children = [];
const observed = (promise) => (void promise.catch(() => {}), promise);
try {
	const snippets = new Set(),
		bodies = new Map();
	const files = (await readdir(resolve(workerData.root, "content"), { recursive: true })).sort();
	for (const source of files) {
		if (!source.endsWith(".md") || source.split("/").some((part) => part.startsWith("."))) continue;
		const body = parseFrontmatter(
			await readFile(resolve(workerData.root, "content", source), "utf8"),
		).content;
		bodies.set(source, body);
		if (legacyMdcSources.has(source)) continue;
		const prepared = prepareNativeMarkdown(
			{ source, body },
			{ mdcIslands: true, allowUnclosedContainers: true },
		);
		for (const snippet of prepared.snippets) snippets.add(snippet);
	}
	timings.scanned = performance.now() - started;
	const batches = Array.from({ length: workerData.count }, () => []);
	let index = 0;
	for (const snippet of snippets) batches[index++ % batches.length].push(snippet);
	const tasks = batches.map((snippets) => {
		const worker = new Worker(new URL("./markdown-worker.mjs", import.meta.url), {
			workerData: { root: workerData.root, snippets },
			execArgv: ["--experimental-strip-types"],
		});
		const waiting = new Map();
		let failure;
		const childTiming = {};
		(timings.workers ??= []).push(childTiming);
		worker.on("message", (message) => {
			if (message.type === "snippets") childTiming.snippetsMs = message.ms;
			if (message.type === "documents") Object.assign(childTiming, message.timing);
			if (message.type === "error") {
				failure = new Error(message.error);
				for (const task of waiting.values()) task.reject(failure);
			} else {
				const task = waiting.get(message.type);
				if (!task) throw new Error("Unexpected Markdown worker result: " + message.type);
				waiting.delete(message.type);
				task.resolve(message.rows);
			}
		});
		const fail = (error) => {
			failure ??= error;
			for (const task of waiting.values()) task.reject(failure);
			waiting.clear();
		};
		worker.on("error", fail);
		worker.on("exit", (code) => {
			if (code || waiting.size) fail(new Error("Markdown worker exited before finishing: " + code));
		});
		const receive = (type) =>
			observed(
				new Promise((resolve, reject) => {
					if (failure) reject(failure);
					else waiting.set(type, { resolve, reject });
				}),
			);
		children.push(worker);
		return { worker, snippets: receive("snippets"), documents: receive("documents") };
	});
	const compiled = (await Promise.all(tasks.map((task) => task.snippets))).flat();
	timings.snippets = performance.now() - started;
	const entries = JSON.parse(
		buildCollectionManifest({
			srcDir: "content",
			extensions: ["md"],
			collections: [{ name: "all", source: ["**/*.md"], include: ["body"] }],
		}),
	).collections.all;
	const groups = Array.from({ length: tasks.length }, () => []),
		loads = groups.map(() => 0),
		duplicateBodies = new Map();
	const jobs = [];
	for (const entry of entries) {
		const body = bodies.get(entry.source),
			legacy = legacyMdcSources.has(entry.source);
		if (legacy && duplicateBodies.has(body))
			duplicateBodies.get(body).entries.push({ ...entry, body });
		else {
			const job = { entries: [{ ...entry, body }], weight: body.length * (legacy ? 20 : 1) };
			jobs.push(job);
			if (legacy) duplicateBodies.set(body, job);
		}
	}
	for (const job of jobs.sort((left, right) => right.weight - left.weight)) {
		const lane = loads.indexOf(Math.min(...loads));
		groups[lane].push(...job.entries);
		loads[lane] += job.weight;
	}
	tasks.forEach((task, index) =>
		task.worker.postMessage({ type: "documents", snippets: compiled, entries: groups[index] }),
	);
	const documents = new Map((await Promise.all(tasks.map((task) => task.documents))).flat());
	timings.documents = performance.now() - started;
	const { prepareData, withFallbackPage } = await import("../data.mjs");
	const pages = preparePayloads(withFallbackPage(await prepareData(undefined, documents)));
	const lanes = assignLanes(pages, workerData.ports.length);
	for (let index = 0; index < lanes.length; index++) {
		const port = workerData.ports[index];
		port.postMessage({ entries: lanes[index].map((index) => [index, pages[index]]) });
		port.close();
	}
	timings.payloads = performance.now() - started;
	parentPort.postMessage({
		type: "data",
		timings,
		pages: pages.map(({ path, source, locale, kind, pageFile }) => ({
			path,
			source,
			locale,
			kind,
			pageFile,
		})),
		lanes,
	});
} catch (error) {
	parentPort.postMessage({ type: "error", error: error.stack ?? String(error) });
} finally {
	await Promise.allSettled(children.map((worker) => worker.terminate()));
	for (const port of workerData.ports) port.close();
	parentPort.close();
}
