<script setup lang="ts">
import { inject } from 'vue';
import { contextKey } from './runtime-bridge.mjs';
defineProps<{ value?: any }>();
const context = inject<any>(contextKey)!;
</script>
<template><div v-html="context.staticMarkdownHtml ?? ''" /></template>
