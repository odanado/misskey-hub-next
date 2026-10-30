// Build-time entry may load the full public URL inventory asynchronously.
import { fullSite } from './scope.mjs';
import { pilotPages } from './pilot-pages.mjs';
export { originalPages } from './pilot-pages.mjs';
const allPages = fullSite ? await (await import('./full-pages.mjs')).fullPages() : null;
export const pages = fullSite ? allPages : pilotPages;
export const modes = ['baseline', 'query', 'native'];
