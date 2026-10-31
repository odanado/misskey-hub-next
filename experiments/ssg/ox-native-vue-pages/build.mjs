import { buildVariant } from '../shared/vue-pages/build.mjs';
import { variant } from './variant.mjs';
await buildVariant(variant, new URL('./vite.config.ts', import.meta.url));
