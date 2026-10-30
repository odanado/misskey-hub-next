import { createSSRApp } from 'vue';
import ReadingTools from './ReadingTools.vue';
import './style.css';

for (const element of document.querySelectorAll('[data-reading-tools]'))
	createSSRApp(ReadingTools).mount(element);
