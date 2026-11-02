declare const __HUB_PUBLIC_CONFIG__: {
	baseUrl: string;
	serverListApiBaseUrl: string;
};
import appConfig from "../app.config";
import packageJson from "../package.json";
export const runtimeConfig = {
	app: { baseURL: "/" },
	public: {
		misskeyJsVersion: packageJson.devDependencies["misskey-js"],
		...__HUB_PUBLIC_CONFIG__,
		repositoryUrl: "https://github.com/misskey-dev/misskey-hub-next",
		locales: [],
		mdc: {
			components: { prose: true, map: { code: "ProseCodeInline" } },
			headings: {
				anchorLinks: {
					h1: false,
					h2: true,
					h3: true,
					h4: true,
					h5: false,
					h6: false,
				},
			},
		},
	},
};
export const useRuntimeConfig = () => runtimeConfig;
export function defineAppConfig(config: any) {
	return config;
}
export const useAppConfig = () => appConfig;
