import { reactive, watch } from "vue";
import { useSiteContext } from "./injection";
export function createColorMode(pageMeta: any) {
	const colorMode = reactive({
		preference: "system",
		value: pageMeta?.colorMode ?? "light",
		forced: !!pageMeta?.colorMode,
	});
	if (typeof window !== "undefined") {
		colorMode.preference =
			localStorage.getItem("nuxt-color-mode") ?? "system";
		colorMode.forced = !!pageMeta?.colorMode;
		const applyTheme = () => {
			colorMode.value =
				!pageMeta?.colorMode &&
				colorMode.preference === "system"
					? matchMedia("(prefers-color-scheme: dark)").matches
						? "dark"
						: "light"
					: (pageMeta?.colorMode ?? colorMode.preference);
			document.documentElement.classList.remove("light", "dark");
			document.documentElement.classList.add(colorMode.value);
			document.documentElement.dataset.bsTheme = colorMode.value;
		};
		applyTheme();
		watch(
			() => colorMode.preference,
			() => {
				localStorage.setItem("nuxt-color-mode", colorMode.preference);
				applyTheme();
			},
		);
	}
	return colorMode;
}
export const useColorMode = () => useSiteContext().colorMode;
