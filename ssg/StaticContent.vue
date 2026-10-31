<script setup lang="ts">
import { computed } from "vue";
import { useSiteContext } from "./runtime";
const props = defineProps<{ value?: any }>();
const context = useSiteContext();
const html = computed(
	() => props.value?.html ?? context.staticMarkdownHtml ?? "",
);
</script>
<template><div v-html="html" /></template>
