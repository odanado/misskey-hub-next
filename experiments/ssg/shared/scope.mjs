const value = process.env.HUB_PILOT_PAGES ?? '4';
if (!['4', '30', 'all'].includes(value)) throw new Error('HUB_PILOT_PAGES must be 4, 30, or all');
export const fullSite = value === 'all';
export const expanded = value === '30' || fullSite;
export const scopePrefix = fullSite ? 'full/' : expanded ? '30/' : '';
export const resultDirectory =
	'experiments/ssg/results' + (fullSite ? '/full' : expanded ? '/30' : '');
export const artifactPath = (mode) => scopePrefix + mode;
