export type LocaleObject = { code: string; language: string; name: string; files: readonly string[] };

export const localesConst = [
	{ files: [ 'ja-JP.json' ], code: 'ja', language: 'ja-JP', name: '日本語' },
	{ files: [ 'en-US.json' ], code: 'en', language: 'en-US', name: 'English' },
	{ files: [ 'id-ID.json' ], code: 'id', language: 'id-ID', name: 'Bahasa Indonesia' },
	{ files: [ 'ko-KR.json' ], code: 'ko', language: 'ko-KR', name: '한국어' },
	{ files: [ 'it-IT.json' ], code: 'it', language: 'it-IT', name: 'Italiano' },
	{ files: [ 'pl-PL.json' ], code: 'pl', language: 'pl-PL', name: 'Polski' },
	{ files: [ 'fr-FR.json' ], code: 'fr', language: 'fr-FR', name: 'Français' },
	{ files: [ 'th-TH.json' ], code: 'th', language: 'th-TH', name: 'ภาษาไทย' },
	{ files: [ 'es-ES.json' ], code: 'es', language: 'es-ES', name: 'Español' },
	{ files: [ 'de-DE.json' ], code: 'de', language: 'de-DE', name: 'Deutsch' },
	{ files: [ 'zh-CN.json' ], code: 'cn', language: 'zh-CN', name: '简体中文' },
	{ files: [ 'zh-TW.json' ], code: 'tw', language: 'zh-TW', name: '繁体中文' },
	{ files: [ 'ja-KS.json' ], code: 'ja-ks', language: 'ja-KS', name: '🐙' },
] as const satisfies LocaleObject[];

export type LocaleCodes = typeof localesConst[number]['code'];

export const localePathRegex = new RegExp(`^/(${localesConst.map((v) => v.code).join('|')})/`);

export const locales = localesConst as unknown as LocaleObject[];
