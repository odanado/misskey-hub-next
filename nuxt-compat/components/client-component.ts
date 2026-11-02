import { defineAsyncComponent, defineComponent, h, onMounted, ref } from "vue";

/** Nuxt .client.vue components must not execute during SSR or initial hydration. */
export function clientComponent(load: () => Promise<any>) {
	const Component = defineAsyncComponent(load);
	return defineComponent({
		inheritAttrs: false,
		setup(_props, { attrs, slots }) {
			const mounted = ref(false);
			onMounted(() => { mounted.value = true; });
			return () => mounted.value ? h(Component, attrs, slots) : null;
		},
	});
}
