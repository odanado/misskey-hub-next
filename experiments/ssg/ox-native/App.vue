<script setup lang="ts">
import Overview from './overview.md';
import ReadingTools from './ReadingTools.vue';
import type { PageView } from './routes.ts';
defineProps<PageView>();
</script>

<template>
	<header>
		<a href="/">Misskey Hub</a>
		<span>Ox Content + Vue · reference implementation</span>
		<div data-reading-tools><ReadingTools /></div>
	</header>
	<div class="layout">
		<aside aria-label="Related pages">
			<p>{{ page.kind === 'home' ? 'Content' : 'In this section' }}</p>
			<nav>
				<a
					v-for="entry in navigation.slice(0, 40)"
					:key="entry.path"
					:href="entry.path"
				>
					{{ entry.title }}
				</a>
			</nav>
		</aside>
		<main>
			<Overview v-if="page.kind === 'home'" />
			<article
				v-else-if="page.kind === 'markdown' || page.kind === 'guide'"
				v-html="body"
			/>
			<article v-else>
				<h1>{{ page.title }}</h1>
				<ul>
					<li v-for="entry in navigation" :key="entry.path">
						<a :href="entry.path">{{ entry.title }}</a>
					</li>
				</ul>
			</article>
		</main>
	</div>
	<footer>
		Source-backed Markdown and directory indexes. Nuxt/MDC component
		compatibility is outside this reference.
	</footer>
</template>
