// Preserve MDC components before extracting code: a quoted component prop may
// itself contain multiline Markdown fences (MfmPreview is a real example).
const fenceOpening = /^ {0,3}(`{3,}|~{3,})[^\n]*(?:\n|$)/;
function fenceEnd(input: string, start: number, fence: string) {
	const close = new RegExp(
		`^ {0,3}${fence[0]}{${fence.length},}[ \\t]*\\r?$`,
		"gm",
	);
	close.lastIndex = input.indexOf("\n", start) + 1;
	const match = close.exec(input);
	return match ? match.index + match[0].length : input.length;
}
function componentEnd(input: string, start: number, name: string) {
	const tags = new RegExp(`</?${name}\\b`, "g");
	tags.lastIndex = start;
	let depth = 0,
		match;
	while ((match = tags.exec(input))) {
		let quote = null,
			end = tags.lastIndex;
		for (; end < input.length; end++) {
			const char = input[end];
			if (quote) {
				if (char === quote && input[end - 1] !== "\\") quote = null;
			} else if (char === '"' || char === "'") quote = char;
			else if (char === ">") break;
		}
		if (end === input.length) throw new Error("Unterminated component " + name);
		if (input[match.index + 1] === "/") depth--;
		else if (!input.slice(match.index, end).trimEnd().endsWith("/")) depth++;
		tags.lastIndex = end + 1;
		if (!depth) return end + 1;
	}
	throw new Error("Missing closing component " + name);
}
export function extractMdcIslands(
	input: string,
	snippets: string[],
	{ allowUnclosed = false } = {},
) {
	let containers = 0,
		components = 0,
		inline = 0;
	const placeholder = (raw) =>
		`<div data-mdc-slot="${snippets.push(raw) - 1}"></div>\n`;
	// Scan in source order: fenced examples and inline code remain literal, while
	// a component owns its complete quoted attributes before any inner fence scan.
	const token =
		/^ {0,3}(?:`{3,}|~{3,})[^\n]*(?:\n|$)|`+|<([A-Z][\w-]*)\b|<(?:[^"'<>]|"[^"]*"|'[^']*')+>|(?<![\\!])\[(?!\^)([^\]\n]+)\](?![\[(:])(?:\{[^}\n]*\})?/gm;
	const references = new Set(
		[...input.matchAll(/^ {0,3}\[([^\]\n]+)\]:/gm)].map((match) =>
			match[1].toLowerCase(),
		),
	);
	let markdown = "",
		cursor = 0,
		match;
	while ((match = token.exec(input))) {
		const start = match.index;
		const fence =
			(start === 0 || input[start - 1] === "\n") && fenceOpening.exec(match[0]);
		if (fence) {
			token.lastIndex = fenceEnd(input, start, fence[1]);
			continue;
		}
		if (match[0][0] === "`") {
			const closing = new RegExp("(?<!`)" + match[0] + "(?!`)", "g");
			closing.lastIndex = token.lastIndex;
			const end = closing.exec(input);
			if (end) token.lastIndex = closing.lastIndex;
			continue;
		}
		if (match[0].startsWith("<") && !match[1]) {
			const raw = /^<(script|style|pre|code)\b/i.exec(match[0]);
			if (raw) {
				const close = new RegExp("</" + raw[1] + "\\s*>", "ig");
				close.lastIndex = token.lastIndex;
				const end = close.exec(input);
				token.lastIndex = end ? close.lastIndex : input.length;
			}
			continue;
		}
		if (match[2] !== undefined) {
			const before = input.slice(input.lastIndexOf("\n", start) + 1, start);
			if (/^[ xX]$/.test(match[2]) && /^\s*(?:[-*+]|\d+[.)])\s+$/.test(before))
				continue;
			if (references.has(match[2].toLowerCase())) continue;
			const reference = /^\s*\[([^\]\n]*)\]/.exec(input.slice(token.lastIndex));
			if (reference && references.has((reference[1] || match[2]).toLowerCase()))
				continue;
			const slot = snippets.push(match[0]) - 1;
			markdown +=
				input.slice(cursor, start) + `<span data-mdc-inline="${slot}"></span>`;
			cursor = token.lastIndex;
			inline++;
			continue;
		}
		// Nuxt MDC treats the legacy multiline schema tag as owning the
		// following document. Preserve that tree without rendering a schema UI.
		const componentClose = componentEnd(input, start, match[1]);
		const end =
			/^MkSchemaViewer/.test(match[1]) &&
			input.slice(start, componentClose).includes("\n")
				? input.length
				: componentClose;
		markdown +=
			input.slice(cursor, start) + placeholder(input.slice(start, end));
		cursor = token.lastIndex = end;
		components++;
	}
	markdown += input.slice(cursor);
	const lines = markdown.match(/[^\n]*\n|[^\n]+$/g) ?? [];
	const opening = (line) =>
		/^(:{1,})([A-Za-z][\w-]*)(?:\{[^\n]*\})?[ \t]*(?:\r?\n)?$/.exec(line) ??
		(allowUnclosed
			? /^(:{2,})([A-Za-z][\w-]*)\{[^\n]*(?:\r?\n)?$/.exec(line)
			: null);
	const restore = (raw) =>
		raw
			.replace(
				/<span data-mdc-inline="(\d+)"><\/span>/g,
				(_, index) => snippets[Number(index)],
			)
			.replace(
				/<div data-mdc-slot="(\d+)"><\/div>\n/g,
				(_, index) => snippets[Number(index)],
			);
	let result = "";
	for (let i = 0; i < lines.length; i++) {
		const fence = fenceOpening.exec(lines[i]);
		if (fence) {
			const closing = new RegExp(
				`^ {0,3}${fence[1][0]}{${fence[1].length},}[ \\t]*\\r?\\n?$`,
			);
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
		if (start[1].length === 2 && /^::\s*$/.test(lines[i + 1] ?? ""))
			raw += lines[++i];
		const stack = start[1].length <= 2 ? [] : [start[1].length];
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
				codeFence = new RegExp(
					`^ {0,3}${fence[1][0]}{${fence[1].length},}[ \\t]*\\r?\\n?$`,
				);
				continue;
			}
			const nested = opening(line),
				close = /^(:{2,})\s*$/.exec(line);
			if (nested && nested[1].length >= 3) stack.push(nested[1].length);
			else if (close && close[1].length >= stack.at(-1)) stack.pop();
		}
		if (stack.length) {
			if (!allowUnclosed)
				throw new Error("Unterminated MDC container: " + start[2]);
			console.warn("[mdc] Implicit EOF closure delegated to MDC: " + start[2]);
		}
		result += placeholder(restore(raw));
		containers++;
	}
	return { markdown: result, containers, components, inline };
}
