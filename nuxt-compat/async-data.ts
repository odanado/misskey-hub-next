import { ref } from "vue";
import { useSiteContext } from "./injection";
export const useGAsyncData = async (key: string, fn: () => any) => {
	const c = useSiteContext();
	c.asyncData ??= {};
	if (!Object.prototype.hasOwnProperty.call(c.asyncData, key))
		c.asyncData[key] = await fn();
	return { data: ref(c.asyncData[key]) };
};
