import { parentPort, workerData } from "node:worker_threads";
import { once } from "node:events";

const fetches = new Map();
let nextFetch = 0;
parentPort.on("message", (message) => {
	if (message.type !== "fetch-result") return;
	const task = fetches.get(message.id);
	if (!task) return;
	fetches.delete(message.id);
	if (message.error) task.reject(new Error(message.error));
	else task.resolve(message.data);
});
const payloads = new Promise((resolve, reject) => {
	let received = false;
	workerData.port.once("message", (message) => {
		received = true;
		resolve(new Map(message.entries));
		workerData.port.close();
	});
	workerData.port.once("messageerror", reject);
	workerData.port.once("close", () => {
		if (!received) reject(new Error("Payload port closed before data arrived"));
	});
});
void payloads.catch(() => {});
try {
	const [bundle] = await once(parentPort, "message");
	if (bundle.type !== "bundle") throw new Error("Missing renderer bundle");
	const { renderPage, setServerFetch } = await import(bundle.url);
	setServerFetch(
		(url) =>
			new Promise((resolve, reject) => {
				const id = ++nextFetch;
				fetches.set(id, { resolve, reject });
				parentPort.postMessage({ type: "fetch", id, url });
			}),
	);
	parentPort.postMessage({ type: "ready" });
	parentPort.once("message", async (job) => {
		try {
			if (job.type !== "render") throw new Error("Expected render jobs");
			const data = await payloads;
			let results = [];
			const flush = () => {
				parentPort.postMessage(
					{ type: "batch", results },
					results.map(({ result }) => result.body.buffer),
				);
				results = [];
			};
			for (const index of job.indices) {
				if (!data.has(index)) throw new Error("Missing page payload: " + index);
				const { html, ...result } = await renderPage(data.get(index), job.assets, job.pages);
				results.push({
					index,
					result: { ...result, contentType: "text/html", body: new TextEncoder().encode(html) },
				});
				if (results.length === 32) flush();
			}
			if (results.length) flush();
			parentPort.postMessage({
				type: "done",
				asideCache: globalThis[Symbol.for("misskey-hub.ssg.aside-stats")],
			});
		} catch (error) {
			parentPort.postMessage({ type: "error", error: error.stack ?? String(error) });
		}
		parentPort.close();
	});
} catch (error) {
	parentPort.postMessage({ type: "error", error: error.stack ?? String(error) });
	parentPort.close();
}
