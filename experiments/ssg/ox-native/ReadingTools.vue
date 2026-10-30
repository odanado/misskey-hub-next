<script setup lang="ts">
import { ref, watch } from 'vue';
const size = ref(100);
watch(size, (value) =>
	document.documentElement.style.setProperty('--reading-scale', `${value}%`),
);
</script>

<template>
	<div class="reading-tools" aria-label="Reading size">
		<button
			:disabled="size <= 80"
			@click="size -= 10"
			aria-label="Decrease text size"
		>
			A−
		</button>
		<output aria-live="polite">{{ size }}%</output>
		<button
			:disabled="size >= 160"
			@click="size += 10"
			aria-label="Increase text size"
		>
			A+
		</button>
	</div>
</template>
