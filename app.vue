<script setup lang="ts">
import TopIco from "bi/chevron-up.svg";
import GAiChan from "./components/g/AiChan.vue";
import { uwu } from "./assets/js/misc/uwu";
const route = useRoute();
const scrollPos = useState("miHub_global_scrollPos", () => 0);
const isUwu = useState("miHub_uwu");
if (import.meta.client) isUwu.value = uwu();
const hideFrom = computed(() => route.meta.scrollButton?.hideFrom ?? -45);
const sbPositionX = computed(
	() => route.meta.scrollButton?.customPosition?.x ?? "32px",
);
const sbPositionY = computed(
	() => route.meta.scrollButton?.customPosition?.y ?? "32px",
);
function scrollToTop() {
	window.scrollTo({ top: 0, behavior: "smooth" });
}
</script>
<template>
	<ClientOnly><GAiChan /></ClientOnly>
	<button
		v-if="route.meta.scrollButton !== false"
		class="_plainButton"
		:class="[
			hideFrom >= scrollPos
				? 'opacity-75 hover:opacity-100'
				: 'opacity-0 pointer-events-none',
			route.meta.scrollButton?.customClass ?? '',
			$style.scrollToTopButton,
		]"
		aria-label="Back to top"
		@click="scrollToTop"
	>
		<TopIco style="width: 20px; height: 20px" />
	</button>
</template>
<style module>
.scrollToTopButton {
	display: grid;
	place-content: center;
	position: fixed;
	z-index: 9999;
	bottom: v-bind(sbPositionY);
	right: v-bind(sbPositionX);
	width: 50px;
	height: 50px;
	border-radius: 100%;
	background: #9ad11b;
	color: #000;
}
</style>
