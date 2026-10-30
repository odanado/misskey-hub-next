export interface NativePayload {
	path: string;
	source?: string;
	document: { title: string };
	[key: string]: unknown;
}
export function prepareData(mode: string): Promise<NativePayload[]>;
export function documentHtml(
	payload: NativePayload,
	body: string,
	assets: { js: string; css: string[] },
): string;
