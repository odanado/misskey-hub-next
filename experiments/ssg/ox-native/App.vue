<script setup lang="ts">
import type { Component } from 'vue';
defineProps<{
	content?: Component | undefined;
	pages: readonly { path: string; title?: string }[];
}>();
</script>

<template>
	<header>
		<a href="/">Misskey Hub</a>
		<span>Ox Content + Vue</span>
	</header>
	<main>
		<component :is="content" v-if="content" />
		<template v-else>
			<h1>Misskey Hub articles</h1>
			<ul>
				<li v-for="page in pages" :key="page.path">
					<a :href="page.path">{{ page.title || page.path }}</a>
				</li>
			</ul>
		</template>
	</main>
</template>

<style>
:root {
	font-family: system-ui, sans-serif;
	color-scheme: light dark;
	line-height: 1.8;
}
body {
	margin: 0;
}
header {
	padding: 1rem 2rem;
	display: flex;
	gap: 2rem;
	border-bottom: 1px solid #8884;
}
header a {
	font-weight: bold;
}
main {
	max-width: 75ch;
	margin: auto;
	padding: 2rem 1rem;
}
a {
	color: light-dark(#176144, #9bdcaa);
	text-underline-offset: 0.2em;
}
h1,
h2,
h3 {
	line-height: 1.4;
}
pre,
table {
	overflow-x: auto;
	display: block;
}
pre {
	padding: 1rem;
	border: 1px solid #8884;
	border-radius: 0.5rem;
}
img {
	max-width: 100%;
	height: auto;
}
</style>
