export default defineNuxtPlugin((app) => {
	app.hook('app:mounted', () => {
		document.documentElement.dataset.pilotReady = 'true';
	});
});
