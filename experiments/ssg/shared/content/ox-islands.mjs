// Preserve MDC components before extracting code: a quoted component prop may
// itself contain multiline Markdown fences (MfmPreview is a real example).
const fenceOpening = /^ {0,3}(`{3,}|~{3,})[^\n]*(?:\n|$)/;
function fenceEnd(input, start, fence) {
	const close = new RegExp(`^ {0,3}${fence[0]}{${fence.length},}[ \\t]*\\r?$`, 'gm');
	close.lastIndex = input.indexOf('\n', start) + 1;
	const match = close.exec(input);
	return match ? match.index + match[0].length : input.length;
}
function componentEnd(input, start, name) {
	const tags = new RegExp(`</?${name}\\b`, 'g');
	tags.lastIndex = start;
	let depth = 0,
		match;
	while ((match = tags.exec(input))) {
		let quote = null,
			end = tags.lastIndex;
		for (; end < input.length; end++) {
			const char = input[end];
			if (quote) {
				if (char === quote && input[end - 1] !== '\\') quote = null;
			} else if (char === '"' || char === "'") quote = char;
			else if (char === '>') break;
		}
		if (end === input.length) throw new Error('Unterminated component ' + name);
		if (input[match.index + 1] === '/') depth--;
		else if (!input.slice(match.index, end).trimEnd().endsWith('/')) depth++;
		tags.lastIndex = end + 1;
		if (!depth) return end + 1;
	}
	throw new Error('Missing closing component ' + name);
}
export function extractMdcIslands(input, snippets, { allowUnclosed = false } = {}) {
	let containers = 0,
		components = 0;
	const placeholder = (raw) => `<div data-pilot-code="${snippets.push(raw) - 1}"></div>\n`;
	// Scan in source order: fenced examples and inline code remain literal, while
	// a component owns its complete quoted attributes before any inner fence scan.
	const token = /^ {0,3}(?:`{3,}|~{3,})[^\n]*(?:\n|$)|`+|<([A-Z][\w-]*)\b/gm;
	let markdown = '',
		cursor = 0,
		match;
	while ((match = token.exec(input))) {
		const start = match.index;
		const fence = (start === 0 || input[start - 1] === '\n') && fenceOpening.exec(match[0]);
		if (fence) {
			token.lastIndex = fenceEnd(input, start, fence[1]);
			continue;
		}
		if (match[0][0] === '`') {
			const closing = new RegExp('(?<!`)' + match[0] + '(?!`)', 'g');
			closing.lastIndex = token.lastIndex;
			const end = closing.exec(input);
			if (end) token.lastIndex = closing.lastIndex;
			continue;
		}
		const end = componentEnd(input, start, match[1]);
		markdown += input.slice(cursor, start) + placeholder(input.slice(start, end));
		cursor = token.lastIndex = end;
		components++;
	}
	markdown += input.slice(cursor);
	const lines = markdown.match(/[^\n]*\n|[^\n]+$/g) ?? [];
	const opening = (line) =>
		/^(:{2,})([A-Za-z][\w-]*)(?:\{[^\n]*\})?[ \t]*(?:\r?\n)?$/.exec(line) ??
		(allowUnclosed ? /^(:{2,})([A-Za-z][\w-]*)\{[^\n]*(?:\r?\n)?$/.exec(line) : null);
	const restore = (raw) =>
		raw.replace(/<div data-pilot-code="(\d+)"><\/div>\n/g, (_, index) => snippets[Number(index)]);
	let result = '';
	for (let i = 0; i < lines.length; i++) {
		const fence = fenceOpening.exec(lines[i]);
		if (fence) {
			const closing = new RegExp(`^ {0,3}${fence[1][0]}{${fence[1].length},}[ \\t]*\\r?\\n?$`);
			result += lines[i];
			while (++i < lines.length) {
				result += lines[i];
				if (closing.test(lines[i])) break;
			}
			continue;
		}
		const start = opening(lines[i]);
		if (!start) {
			result += lines[i];
			continue;
		}
		let raw = lines[i];
		const stack = start[1].length === 2 ? [] : [start[1].length];
		let codeFence = null;
		while (stack.length && ++i < lines.length) {
			const line = lines[i];
			raw += line;
			if (codeFence) {
				if (codeFence.test(line)) codeFence = null;
				continue;
			}
			const fence = fenceOpening.exec(line);
			if (fence) {
				codeFence = new RegExp(`^ {0,3}${fence[1][0]}{${fence[1].length},}[ \\t]*\\r?\\n?$`);
				continue;
			}
			const nested = opening(line),
				close = /^(:{2,})\s*$/.exec(line);
			if (nested && nested[1].length >= 3) stack.push(nested[1].length);
			else if (close && close[1].length >= stack.at(-1)) stack.pop();
		}
		if (stack.length) {
			if (!allowUnclosed) throw new Error('Unterminated MDC container: ' + start[2]);
			console.warn('[full-compat] Implicit EOF closure delegated to MDC: ' + start[2]);
		}
		result += placeholder(restore(raw));
		containers++;
	}
	return { markdown: result, containers, components };
}
