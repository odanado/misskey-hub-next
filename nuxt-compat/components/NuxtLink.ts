import { defineComponent, h } from "vue";
import { useSiteContext } from "../injection";
export const NuxtLink = defineComponent({
	inheritAttrs: false,
	props: ["to", "href", "target"],
	setup(props, { attrs, slots }) {
		const context = useSiteContext();
		return () => {
			const raw = props.to ?? props.href;
			let href = raw;
			if (
				typeof raw === "string" &&
				!raw.startsWith("/") &&
				!/^[a-z][a-z+.-]*:/i.test(raw)
			) {
				const url = new URL(
					raw,
					"https://misskey-hub.net" + context.route.path,
				);
				href = url.pathname + url.search + url.hash;
			}
			return h(
				"a",
				{
					...attrs,
					href,
					target: props.target,
					rel:
						attrs.rel ??
						(props.target === "_blank" || /^https?:\/\//.test(href)
							? "noopener noreferrer"
							: undefined),
				},
				slots.default?.(),
			);
		};
	},
});
