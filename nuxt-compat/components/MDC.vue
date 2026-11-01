<script setup lang="ts">
import MDCRenderer from "@nuxtjs/mdc/runtime/components/MDCRenderer.vue";
import { computed } from "vue";
import { useSiteContext } from "../injection";
const props = defineProps<{ value: any; tag?: any }>();
const context = useSiteContext();
const body = computed(() =>
	typeof props.value === "string"
		? context.inlineMarkdown?.[props.value]
		: (props.value?.body ?? props.value),
);
if (typeof props.value === "string" && !body.value)
	throw new Error("Inline MDC was not compiled: " + props.value.slice(0, 100));
</script>
<template>
	<MDCRenderer v-if="body" :body="body" :tag="tag ?? 'div'" />
</template>
