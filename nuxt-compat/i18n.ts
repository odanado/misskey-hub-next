import { useSiteContext } from "./injection";
export { Translation as I18nT } from "vue-i18n";
export const useI18n = () => useSiteContext().i18n.global;
export const useGLocalePath = () => {
	const context = useSiteContext();
	return (path: string, targetLocale?: any) => {
		if (
			/^https?:|^x-mi-web:|^\/(ja|en|id|ko|it|pl|fr|th|es|de|cn|tw|ja-ks)\//.test(
				path,
			)
		)
			return path;
		// Nuxt i18n resolves a route object: query slashes are readable, while
		// an already encoded hash is encoded again. Retain the original URLs.
		const [base, hash] = path.split("#");
		const normalized = base.includes("?")
			? decodeURIComponent(base.replace("/?", "?"))
			: base;
		const locale = /^\/blog(?:\/|\?|$)/.test(normalized)
			? "ja"
			: (targetLocale?.value ?? targetLocale ?? context.locale.value);
		return `/${locale}${normalized.startsWith("/") ? normalized : "/" + normalized}${hash === undefined ? "" : "#" + encodeURI(hash)}`;
	};
};
export const useGSwitchLocalePath = () => {
	const context = useSiteContext();
	return (locale: string) =>
		context.kind === "error" ? `/${locale}/` :
		context.route.path.startsWith("/ja/blog/")
			? context.route.path
			: context.route.path.replace(/^\/[a-z-]+\//, `/${locale}/`);
};
export const defineI18nRoute = (_options: any) => {};
