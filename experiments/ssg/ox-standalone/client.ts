import '../nuxt-compat/styles';
import { createSSRApp } from 'vue';
import PortApp from '../nuxt-compat/PortApp.vue';
import { configure } from '../nuxt-compat/registry';
const payload = JSON.parse(document.querySelector('#port-data')!.textContent!);
const app = createSSRApp(PortApp, { payload });
configure(app);
app.mount('#__nuxt');
