import { parentPort, workerData } from "node:worker_threads";
import { cpSync, rmSync } from "node:fs";

try {
	cpSync(workerData.publicDir, workerData.outDir, { recursive: true, dereference: true });
	parentPort.postMessage({ type: "copied" });
	if (workerData.previous) rmSync(workerData.previous, { recursive: true, force: true });
	parentPort.postMessage({ type: "done" });
} catch (error) {
	parentPort.postMessage({ type: "error", error: error.stack ?? String(error) });
}
parentPort.close();
