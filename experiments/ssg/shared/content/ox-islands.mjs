// Preserve MDC components as explicitly parsed islands. Ox still parses the
// surrounding Markdown; code highlighting and MDC syntax use the existing
// parser. Never silently discard an unsupported component.
export function extractMdcIslands(input, snippets, { allowUnclosed = false } = {}) {
	let containers = 0,
		components = 0;
	const placeholder = (raw) => {
		const slot = snippets.push(raw) - 1;
		return `<div data-pilot-code="${slot}"></div>\n`;
	};
	const lines = input.match(/[^\n]*\n|[^\n]+$/g) ?? [];
	let markdown = '';
	const opening = (line) =>
		/^(:{2,})([A-Za-z][\w-]*)(?:\{[^\n]*\})?[ \t]*(?:\r?\n)?$/.exec(line) ??
		(allowUnclosed ? /^(:{2,})([A-Za-z][\w-]*)\{[^\n]*(?:\r?\n)?$/.exec(line) : null);
	for (let i = 0; i < lines.length; i++) {
		const start = opening(lines[i]);
		if (!start) {
			markdown += lines[i];
			continue;
		}
		if (start[1].length === 2) {
			markdown += placeholder(lines[i]);
			containers++;
			continue;
		}
		const stack = [start[1].length];
		let raw = lines[i];
		while (stack.length && ++i < lines.length) {
			const line = lines[i],
				nested = opening(line),
				close = /^(:{2,})\s*$/.exec(line);
			raw += line;
			if (nested && nested[1].length >= 3) stack.push(nested[1].length);
			else if (close && close[1].length >= stack.at(-1)) stack.pop();
		}
		if (stack.length) {
			if (!allowUnclosed) throw new Error('Unterminated MDC container: ' + start[2]);
			console.warn('[full-compat] Implicit EOF closure delegated to MDC: ' + start[2]);
		}
		markdown += placeholder(raw);
		containers++;
	}
	const codeSpans = [...markdown.matchAll(/(`+)[^\n]*?\1/g)].map((match) => [
		match.index,
		match.index + match[0].length,
	]);
	const pattern = /<([A-Z][\w-]*)\b/g;
	let result = '',
		cursor = 0,
		match;
	while ((match = pattern.exec(markdown))) {
		const begin = match.index,
			name = match[1];
		if (codeSpans.some(([start, end]) => begin >= start && begin < end)) continue;
		let quote = null,
			end = pattern.lastIndex;
		for (; end < markdown.length; end++) {
			const char = markdown[end];
			if (quote) {
				if (char === quote && markdown[end - 1] !== '\\') quote = null;
			} else if (char === '"' || char === "'") quote = char;
			else if (char === '>') break;
		}
		if (end === markdown.length) throw new Error('Unterminated component ' + name);
		if (!markdown.slice(begin, end).trimEnd().endsWith('/')) {
			const close = new RegExp(`</${name}\\s*>`, 'g');
			close.lastIndex = end + 1;
			const closing = close.exec(markdown);
			if (!closing) throw new Error('Missing closing component ' + name);
			end = close.lastIndex - 1;
		}
		result += markdown.slice(cursor, begin) + placeholder(markdown.slice(begin, end + 1));
		cursor = end + 1;
		pattern.lastIndex = cursor;
		components++;
	}
	return { markdown: result + markdown.slice(cursor), containers, components };
}
