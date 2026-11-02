import { defineComponent } from "vue";
import { useSiteContext } from "../injection";
export const ContentNavigation = defineComponent({
	props: ["query"],
	setup(props, { slots }) {
		const context = useSiteContext();
		return () => {
			const base = props.query?.path?.replace(/\/$/, "");
			const filter = (nodes: any[]): any[] =>
				nodes
					.filter((node) => node._path !== base || node.children)
					.map((node) => ({
						...node,
						...(node.children ? { children: filter(node.children) } : {}),
					}));
			return slots.default?.({
				navigation: base ? filter(context.navigation) : context.navigation,
			});
		};
	},
});
