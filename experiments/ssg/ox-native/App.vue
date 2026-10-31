<script setup lang="ts">
import PortApp from '../nuxt-compat/PortApp.vue';
defineProps<{ payload: any }>();
</script>
<template><PortApp :payload="payload" /></template>
