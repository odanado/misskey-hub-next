// Historical mode IDs stay stable so recorded results and .pilot paths match.
export const strategies = {
	'ox-native': { directory: 'ox-native', engine: 'ox', entry: 'experiments/ssg/ox-native/build.mjs' },
	'ox-ported': {
		directory: 'ox-standalone',
		engine: 'ox',
		entry: 'experiments/ssg/ox-standalone/build.mjs',
	},
	astro: {
		directory: 'astro-mdc',
		engine: 'mdc',
		config: 'experiments/ssg/astro-mdc/astro.config.mjs',
	},
	'astro-ox': {
		directory: 'astro-ox',
		engine: 'ox',
		config: 'experiments/ssg/astro-ox/astro.config.mjs',
	},
};
export function getStrategy(mode) {
	const strategy = strategies[mode];
	if (!strategy) throw new Error('Unknown SSG strategy: ' + mode);
	return strategy;
}
