<script setup lang="ts">
import MDCRenderer from '@nuxtjs/mdc/runtime/components/MDCRenderer.vue';
defineProps<{ document: any }>();
</script>
<template><MDCRenderer :body="document.body" :data="document" tag="div" /></template>
