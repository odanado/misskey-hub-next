import { ref } from "vue";
import { useSiteContext } from "./injection";
const fetchPromises = new Map<string, Promise<any>>();
export async function useFetch(url: string) {
	const context = useSiteContext();
	context.fetchCache ??= {};
	if (Object.prototype.hasOwnProperty.call(context.fetchCache, url))
		return {
			data: ref(context.fetchCache[url]),
			pending: ref(false),
			error: ref(null),
		};
	let promise = fetchPromises.get(url);
	if (!promise) {
		promise = fetch(url, { signal: AbortSignal.timeout(15000) }).then(
			(response) => {
				if (!response.ok)
					throw new Error("Full SSG fetch " + response.status + " " + url);
				return response.json();
			},
		);
		fetchPromises.set(url, promise);
	}
	context.fetchCache[url] = await promise;
	return {
		data: ref(context.fetchCache[url]),
		pending: ref(false),
		error: ref(null),
	};
}
