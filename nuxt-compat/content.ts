import { useSiteContext } from "./injection";
export const queryContent = (...args: any[]) => {
	const context = useSiteContext(),
		filters: any[] = [];
	let fields: string[] | undefined, order: any;
	const query: any = {
		path:
			typeof args[0] === "string"
				? "/" + args[0].replace(/^\/+|\/+$/g, "")
				: args[0],
		where: (value: any) => {
			filters.push(value);
			return query;
		},
		only: (value: string[]) => {
			fields = value;
			return query;
		},
		sort: (value: any) => {
			order = value;
			return query;
		},
	};
	const matches = (item: any, filter: any) =>
		Object.entries(filter).every(([key, value]: any) => {
			const actual = ["_draft", "_partial"].includes(key)
				? (item[key] ?? false)
				: item[key];
			if (value && typeof value === "object") {
				if ("$eq" in value) return actual === value.$eq;
				if ("$ne" in value) return actual !== value.$ne;
				if ("$in" in value) return value.$in.includes(actual);
			}
			return actual === value;
		});
	query.find = async () => {
		let items = [...(context.related ?? [])].filter(
			(item) =>
				(!query.path ||
					item._path === query.path ||
					item._path?.startsWith(query.path.replace(/\/$/, "") + "/")) &&
				filters.every((filter) => matches(item, filter)),
		);
		if (order)
			items.sort((a, b) => {
				for (const [key, direction] of Object.entries(order)) {
					const result = String(a[key] ?? "").localeCompare(
						String(b[key] ?? ""),
					);
					if (result) return result * Number(direction);
				}
				return 0;
			});
		return fields
			? items.map((item) =>
					Object.fromEntries(
						fields.filter((key) => key in item).map((key) => [key, item[key]]),
					),
				)
			: items;
	};
	query.findOne = async () => context.document;
	query.findSurround = async () => context.surround;
	return query;
};
export const fetchContentNavigation = async (_query: unknown) =>
	useSiteContext().navigation;
