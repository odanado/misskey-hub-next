declare module '*.vue' {
	import type { Component } from 'vue';
	const component: Component;
	export default component;
}
declare module '*.md' {
	import type { Component } from 'vue';
	const component: Component;
	export default component;
}

declare module 'virtual:ox-native-documents' {
	import type { Component } from 'vue';
	const documents: Record<string, () => Promise<{ default: Component }>>;
	export default documents;
}
