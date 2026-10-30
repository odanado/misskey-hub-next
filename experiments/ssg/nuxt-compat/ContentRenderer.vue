<template><MDCRenderer :body="value.body" :data="value" tag="div" /></template>
<script setup lang="ts">
import MDCRenderer from '@nuxtjs/mdc/runtime/components/MDCRenderer.vue';
defineProps<{ value: any }>();
</script>
