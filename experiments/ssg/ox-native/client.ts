import '../nuxt-compat/styles';
import { createSSRApp } from 'vue';
import App from './App.vue';
import { configure } from './runtime-bridge.mjs';
import documents from 'virtual:ox-native-documents';
async function mount() {
	const payload = JSON.parse(document.querySelector('#port-data')!.textContent!);
	const loader = payload.source?.endsWith('.md') ? documents[payload.source] : null;
	if (payload.source?.endsWith('.md') && !loader)
		throw new Error('Missing native Markdown module: ' + payload.source);
	const markdown = loader ? await loader() : null;
	const app = createSSRApp(App, { payload });
	configure(app);
	if (markdown) app.provide(Symbol.for('ox-native-markdown'), markdown.default);
	app.mount('#__nuxt');
}
void mount();
