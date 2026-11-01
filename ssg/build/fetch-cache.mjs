/** One fetch per URL for the complete build, shared by all renderer workers. */
export function createBuildFetch(fetcher = fetch) {
	const requests = new Map();
	return (url) => {
		let request = requests.get(url);
		if (!request) {
			request = fetcher(url, { signal: AbortSignal.timeout(15000) }).then((response) => {
				if (!response.ok) throw new Error("Full SSG fetch " + response.status + " " + url);
				return response.json();
			});
			requests.set(url, request);
		}
		return request;
	};
}
