export { prepareData } from '../shared/data.mjs';
import { documentHtml as document } from '../ox-standalone/document.mjs';
// The Markdown body lives in its compiled module, not a duplicate page payload.
// Retain the renderer's nonempty-body condition and the TOC metadata. The real
// article is server rendered from that module before this serialization step.
export function documentHtml(payload, body, assets) {
	const native = payload.source?.endsWith('.md');
	const page = {
		...payload,
		...(native && payload.document.body?.children
			? {
					document: {
						...payload.document,
						body: {
							...payload.document.body,
							children: payload.document.body.children.length ? [{ type: 'text', value: '' }] : [],
						},
					},
				}
			: {}),
		surround: payload.surround?.map((item) =>
			item ? Object.fromEntries(Object.entries(item).filter(([key]) => key !== 'body')) : null,
		),
	};
	return document(page, body, assets);
}
