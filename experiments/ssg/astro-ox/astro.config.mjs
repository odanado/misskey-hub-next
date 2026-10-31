import { fileURLToPath } from 'node:url';
import { createAstroConfig } from '../shared/astro/create-config.mjs';
export default createAstroConfig({
	mode: 'astro-ox',
	srcDir: fileURLToPath(new URL('./src', import.meta.url)),
});
