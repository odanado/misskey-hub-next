import { ref } from "vue";
import { useSiteContext } from "./injection";
export function useState<T>(key: string, init?: () => T) {
	const context = useSiteContext();
	return (context.state[key] ??= ref(init?.()));
}
