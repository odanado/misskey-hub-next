export default defineNuxtPlugin((app) => {
	const ready = async () => {
		if (app.isHydrating) return;
		await nextTick();
		document.documentElement.dataset.siteReady = "true";
	};
	app.hook("app:suspense:resolve", ready);
	app.hook("app:mounted", ready);
});
