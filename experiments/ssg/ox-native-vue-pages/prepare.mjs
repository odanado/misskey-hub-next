import { prepareVariant } from '../shared/vue-pages/workspace.mjs';
import { variant } from './variant.mjs';
await prepareVariant(variant, { fresh: process.argv.includes('--fresh') });
