<script setup lang="ts">
import { defineAsyncComponent } from 'vue';
import { usePortContext, ClientOnly } from './runtime';
import DocsLayout from '#port-docs-layout';
import DefaultLayout from '../../../layouts/default.vue';
import LandingLayout from '../../../layouts/landing.vue';
import SlimLayout from '../../../layouts/slim.vue';
import ToolsLayout from '../../../layouts/tools.vue';
const files = import.meta.glob(['../../../pages/**/*.vue', '!../../../pages/**/*.client.vue'], {
	eager: true,
	import: 'default',
});
const clientFiles = import.meta.glob('../../../pages/**/*.client.vue');
const context = usePortContext();
const payload = context;
const layout =
	payload.kind === 'docs'
		? DocsLayout
		: payload.pageFile?.includes('/tools/')
			? ToolsLayout
			: payload.pageFile === 'pages/index.vue'
				? LandingLayout
				: payload.pageFile === 'pages/ns.vue'
					? SlimLayout
					: DefaultLayout;
const isClient = payload.pageFile?.endsWith('.client.vue');
const component = isClient
	? defineAsyncComponent(clientFiles['../../../' + payload.pageFile] as any)
	: files['../../../' + payload.pageFile];
if (payload.kind !== 'languageEntry' && !component)
	throw new Error('Unported public page ' + payload.pageFile);
</script>
<template>
	<div v-if="payload.kind === 'languageEntry'">
		<p>Please enable Javascript to see this page properly.</p>
		<a v-for="locale in payload.locales" :href="'/' + locale.code + payload.path">{{
			locale.name
		}}</a>
	</div>
	<component v-else :is="layout"
		><ClientOnly v-if="isClient"><component :is="component" /></ClientOnly
		><component v-else :is="component"
	/></component>
</template>
