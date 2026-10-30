import { artifactPath } from './scope.mjs';
export const compiler = process.env.HUB_VUE_COMPILER ?? 'vue';
if (!['vue', 'vize'].includes(compiler)) throw new Error('HUB_VUE_COMPILER must be vue or vize');
export const artifactMode = (mode) => artifactPath(compiler === 'vize' ? `${mode}-vize` : mode);
export async function vueCompiler(options = {}) {
	if (compiler === 'vize') {
		const { default: vize } = await import('@vizejs/vite-plugin');
		return vize({ configMode: false, scanPatterns: [], ...options });
	}
	const { default: vue } = await import('@vitejs/plugin-vue');
	return vue(options);
}
