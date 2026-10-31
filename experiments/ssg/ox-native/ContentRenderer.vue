<script setup lang="ts">
import { inject } from 'vue';
import MDCRenderer from '@nuxtjs/mdc/runtime/components/MDCRenderer.vue';
defineProps<{ value: any }>();
const markdown = inject<any>(Symbol.for('ox-native-markdown'), null);
</script>
<template>
	<component v-if="markdown" :is="markdown" /><MDCRenderer
		v-else
		:body="value.body"
		:data="value"
		tag="div"
	/>
</template>
