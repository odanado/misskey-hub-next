import { createSSRApp } from 'vue';
import { renderToString } from 'vue/server-renderer';
import PortApp from '../nuxt-compat/PortApp.vue';
import { configure } from '../nuxt-compat/registry';
export async function render(payload: any) {
	const app = createSSRApp(PortApp, { payload });
	configure(app);
	// Vue SSR catches rejected async setup promises. A throwing error handler
	// alone is insufficient because that rejection can be caught again.
	const errors: unknown[] = [];
	if (payload.fullSite)
		app.config.errorHandler = (error) => {
			errors.push(error);
		};
	const html = await renderToString(app);
	if (errors.length) throw new AggregateError(errors, 'SSR failed: ' + payload.path);
	return html;
}
