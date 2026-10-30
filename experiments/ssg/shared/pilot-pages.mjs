// Synchronous page definitions for Playwright's test discovery.
import { additionalPages } from './pages-30.mjs';
import { expanded } from './scope.mjs';
export const originalPages = [
	{
		path: '/ja/docs/for-users/features/note/',
		source: 'ja/docs/2.for-users/3.features/note.md',
		title: 'ノート',
	},
	{
		path: '/ja/docs/for-users/features/hashtag/',
		source: 'ja/docs/2.for-users/3.features/hashtag.md',
		title: 'ハッシュタグ',
	},
	{
		path: '/ja/docs/for-developers/plugin/create-plugin/',
		source: 'ja/docs/4.for-developers/plugin/create-plugin.md',
		title: 'プラグインの作成',
	},
	{
		path: '/en/docs/for-users/features/note/',
		source: 'en/docs/2.for-users/3.features/note.md',
		title: 'Notes',
	},
];
export const pilotPages = expanded ? [...originalPages, ...additionalPages] : originalPages;
