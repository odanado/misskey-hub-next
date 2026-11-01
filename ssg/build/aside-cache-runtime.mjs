import { inject as ssgInject, getCurrentInstance as ssgInstance } from "vue";
import { isSamePath as ssgSamePath } from "ufo";
const ssgAsideStats = (globalThis[Symbol.for("misskey-hub.ssg.aside-stats")] ??= {});
const ssgAsideInstances = new WeakMap();
const ssgAsideChunks = new WeakMap();
const ssgAsidePaths = new WeakMap();
function ssgNodePaths(node) {
	let paths = ssgAsidePaths.get(node);
	if (paths) return paths;
	paths = [];
	const seen = new WeakSet();
	function visit(value) {
		if (!value || typeof value !== "object" || seen.has(value)) return;
		seen.add(value);
		if (typeof value._path === "string") paths.push(value._path);
		for (const child of value.children ?? []) visit(child);
	}
	visit(node);
	ssgAsidePaths.set(node, paths);
	return paths;
}
function ssgFlatChunks(chunks) {
	let out = "";
	for (const chunk of chunks) {
		if (typeof chunk === "string") out += chunk;
		else if (Array.isArray(chunk)) {
			const child = ssgFlatChunks(chunk);
			if (child === undefined) return;
			out += child;
		} else return;
	}
	return out;
}
function ssgAsideRender(render, record, self, args) {
	const [ctx, push, parent, attrs] = args;
	const { props, context } = record ?? {};
	const node = props?.links?.[0];
	const manual = context?.state?.["miHub-docs-aside-manual-collapse"]?.value;
	if (!context || !node || props.depth <= 1 || Object.keys(manual ?? {}).length)
		return render.apply(self, args);
	const path = context.route.path;
	if (ssgNodePaths(node).some((p) => path.includes(p) || ssgSamePath(path, p)))
		return render.apply(self, args);
	let cache = ssgAsideChunks.get(node);
	if (!cache) {
		cache = new Map();
		ssgAsideChunks.set(node, cache);
	}
	let scopes = "";
	for (let p = parent; p; p = p.parent) scopes += "|" + (p.type?.__scopeId ?? "");
	const key = JSON.stringify([
		context.locale.value,
		props.depth,
		attrs,
		scopes,
		parent.appContext.config.idPrefix,
	]);
	const stats = ssgAsideStats;
	const cached = cache.get(key);
	if (cached !== undefined) {
		stats.asideHits = (stats.asideHits ?? 0) + 1;
		push(cached);
		return;
	}
	stats.asideMisses = (stats.asideMisses ?? 0) + 1;
	const chunks = [];
	const forwarded = [...args];
	forwarded[1] = (chunk) => chunks.push(chunk);
	const result = render.apply(self, forwarded);
	for (const chunk of chunks) push(chunk);
	const flat = ssgFlatChunks(chunks);
	if (flat !== undefined && !result?.then) cache.set(key, flat);
	else stats.asideAsync = (stats.asideAsync ?? 0) + 1;
	return result;
}
function wrapInactiveAside(component) {
	const setup = component.setup;
	component.setup = function (props, ctx) {
		const record = { props, context: ssgInject(Symbol.for("misskey-hub")) };
		ssgAsideInstances.set(ssgInstance(), record);
		const result = setup.call(this, props, ctx);
		return typeof result === "function"
			? function (...args) {
					return ssgAsideRender(result, record, this, args);
				}
			: result;
	};
	if (component.ssrRender) {
		const render = component.ssrRender;
		component.ssrRender = function (...args) {
			return ssgAsideRender(render, ssgAsideInstances.get(args[2]), this, args);
		};
	}
	return component;
}
