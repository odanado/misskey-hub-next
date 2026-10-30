import { relative, resolve } from 'node:path';
import { parseFrontmatter } from '@ox-content/napi';
import { prepareNativeMarkdown, nativeDocument } from '../shared/content/ox-native.mjs';
import { parseMdc, compileHast, generateToc, generatePath } from '../shared/content/markdown.mjs';
import { fullSite } from '../shared/scope.mjs';
// Pin the integration protocol rather than silently falling back to the old
// Markdown renderer if a future plugin changes the generated module shape.
export function markdownCompatibility(root) {
	const inputs = new Map();
	const totals = { modules: 0, componentIslands: 0, codeIslands: 0 };
	return [
		{
			name: 'ox-native-mdc-input',
			enforce: 'pre',
			transform(code, id) {
				if (!id.endsWith('.md')) return;
				const parsed = parseFrontmatter(code);
				const entry = {
					source: relative(resolve(root, 'content'), id),
					body: parsed.content,
					frontmatter: parsed.frontmatter ?? {},
				};
				const prepared = prepareNativeMarkdown(entry, {
					mdcIslands: true,
					allowUnclosedContainers: fullSite,
				});
				inputs.set(id, { entry, prepared });
				return code.slice(0, code.length - parsed.content.length) + prepared.markdown;
			},
		},
		{
			name: 'ox-native-mdc-output',
			enforce: 'post',
			async transform(code, id) {
				if (!id.endsWith('.md')) return;
				const input = inputs.get(id);
				if (!input) throw new Error('Missing Markdown preprocessor input: ' + id);
				const match = /const rawHtml = ("(?:[^"\\]|\\.)*");/.exec(code);
				if (!match) throw new Error('Ox Vue 3.4.3 module protocol changed: ' + id);
				const document = await nativeDocument(
					input.entry,
					(snippet) => parseMdc(snippet, 'snippet.md'),
					{
						compileHast,
						generateToc,
						generatePath,
						mdcIslands: true,
						allowUnclosedContainers: fullSite,
						prepared: input.prepared,
						renderedHtml: JSON.parse(match[1]),
						normalizeTree: semanticFootnotes,
					},
				);
				document.body.children = document.body.children.map((node) =>
					node.tag === 'style'
						? {
								type: 'element',
								tag: 'span',
								props: { hidden: true, 'aria-hidden': 'true', 'data-port-style-placeholder': '' },
								children: [],
							}
						: node,
				);
				totals.modules++;
				totals.componentIslands += input.prepared.componentSnippets;
				totals.codeIslands += input.prepared.codeIslands;
				return `import {h,defineComponent} from 'vue';\nimport Renderer from ${JSON.stringify(resolve(root, 'experiments/ssg/ox-native/Markdown.vue'))};\nexport const frontmatter=${JSON.stringify(input.entry.frontmatter)};\nexport const document=JSON.parse(${JSON.stringify(JSON.stringify(document))});\nexport default defineComponent({name:'OxNativeMarkdown',setup(){return()=>h(Renderer,{document});}});`;
			},
			closeBundle() {
				console.log('[ox-native-markdown] ' + JSON.stringify(totals));
			},
		},
	];
}

// Core Vue integration currently renders footnote definitions in place. Keep
// Nuxt/MDC's semantic endnotes and reading order without reparsing the document.
function semanticFootnotes(tree) {
	const definitions = [];
	const visit = (node) => {
		node.children = node.children?.filter((child) => {
			if (child.type === 'element' && child.properties?.className?.includes('footnote')) {
				let children = child.children;
				if (children.filter((node) => node.tagName === 'p').length === 1) {
					children = children
						.flatMap((node) => (node.tagName === 'p' ? node.children : [node]))
						.filter((node) => node.type !== 'text' || node.value.trim());
					const back = children.find(
						(node) => node.tagName === 'a' && node.properties?.href?.startsWith('#fnref-'),
					);
					if (back) {
						children = children.filter((node) => node !== back);
						children.push({ type: 'text', value: ' ' }, back);
					}
				}
				definitions.push({
					...child,
					tagName: 'li',
					properties: { id: child.properties.id },
					children,
				});
				return false;
			}
			visit(child);
			return true;
		});
	};
	visit(tree);
	if (definitions.length)
		tree.children.push({
			type: 'element',
			tagName: 'section',
			properties: { className: ['footnotes'] },
			children: [{ type: 'element', tagName: 'ol', properties: {}, children: definitions }],
		});
}
