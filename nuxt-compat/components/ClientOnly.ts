import { defineComponent, onMounted, ref } from "vue";
export const ClientOnly = defineComponent({
	setup(_props, { slots }) {
		const mounted = ref(false);
		onMounted(() => {
			mounted.value = true;
		});
		return () => (mounted.value ? slots.default?.() : null);
	},
});
