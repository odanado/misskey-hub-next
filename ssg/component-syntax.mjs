import { markdownLinkRanges } from "./markdown-ranges.mjs";
import { kebabCase, pascalCase } from "scule";
// The small legacy authoring adapter only translates delimiters/attributes.
// Ox's native MDX parser owns component nesting and Markdown children.
export function parseAttributes(source) {
	const props = {};
	const tokens =
		/(?:([.#])([^\s.#{]+))|([^\s=]+)(?:\s*=\s*(?:"((?:\\[\s\S]|[^"\\])*)"|'((?:\\[\s\S]|[^'\\])*)'|([^\s]+)))?/g;
	for (const match of source.matchAll(tokens)) {
		if (match[1] === ".")
			props.className = [...(props.className ?? []), match[2]];
		else if (match[1] === "#") props.id = match[2];
		else {
			const originalKey = match[3];
			const key = originalKey?.startsWith(":")
				? ":" + kebabCase(originalKey.slice(1))
				: originalKey?.startsWith("#")
					? originalKey
					: kebabCase(originalKey ?? "");
			if (!key || key === "{" || key === "}") continue;
			let value = match[4] ?? match[5] ?? match[6] ?? true;
			if (key === "class") props.className = String(value).split(/\s+/);
			else
				props[key] =
					key.startsWith(":") && typeof value === "string"
						? value.replace(/\n[ \t]+/g, "\n")
						: value;
		}
	}
	return props;
}
export function componentMarkdown(input) {
	const linkRanges = markdownLinkRanges(input);
	const properties = [],
		originalTags = [],
		inline = [],
		stack = [],
		schemas = [];
	let out = "",
		cursor = 0,
		match;
	const references = new Set(
		[...input.matchAll(/^ {0,3}\[([^\]\n]+)\]:/gm)].map((m) =>
			m[1].toLowerCase(),
		),
	);
	const token =
		/^ {0,3}(`{3,}|~{3,})[^\n]*(?:\n|$)|`+|<(\/?)([A-Z][\w-]*|template)\b|^(:+)([A-Za-z][\w-]*)([^\n]*)|^(:{2,})\s*$|^#([\w-]+)\s*$|(?<![\\!])\[(?!\^)([^\]\n]+)\](?![\[(:])(?:\{([^}\n]*)\})?/gm;
	const safeName = (name) => (/[-_]/.test(name) ? pascalCase(name) : name);
	const tag = (name, props, close = false, native = "") => {
		const id = properties.push(props) - 1;
		originalTags[id] = name === "OxSlot" ? "template" : kebabCase(name);
		return name === "OxSpan"
			? `<span data-legacy-props="${id}">`
			: `<${safeName(name)} ${native} oxPropsId={${id}}${close ? " /" : ""}>`;
	};
	while ((match = token.exec(input))) {
		const start = match.index;
		if (match[1]) {
			const close = new RegExp(
				`^ {0,3}${match[1][0]}{${match[1].length},}[ \\t]*\\r?$`,
				"gm",
			);
			close.lastIndex = token.lastIndex;
			const end = close.exec(input);
			token.lastIndex = end ? close.lastIndex : input.length;
			continue;
		}
		if (match[0][0] === "`") {
			const end = input.indexOf(match[0], token.lastIndex);
			if (end !== -1 && !/\n[ \t]*\n/.test(input.slice(token.lastIndex, end)))
				token.lastIndex = end + match[0].length;
			continue;
		}
		let replacement;
		if (match[3]) {
			let quote = null,
				end = token.lastIndex;
			for (; end < input.length; end++) {
				const c = input[end];
				if (quote) {
					if (c === quote && input[end - 1] !== "\\") quote = null;
				} else if (c === '"' || c === "'") quote = c;
				else if (c === ">") break;
			}
			if (end === input.length)
				throw Error("Unclosed component tag " + match[3]);
			const raw = input.slice(token.lastIndex, end),
				name = match[3] === "template" ? "OxSlot" : match[3];
			if (match[2]) replacement = `</${safeName(name)}>`;
			else {
				const schema =
					/^MkSchemaViewer/.test(name) &&
					raw.includes("\n") &&
					/\/\s*$/.test(raw);
				const attributes = nativeAttributes(raw.replace(/\/\s*$/, ""));
				replacement = tag(
					name,
					name === "OxSlot" && /#[\w-]+/.test(attributes.legacy)
						? { [attributes.legacy.match(/#[\w-]+/)[0]]: "" }
						: parseAttributes(attributes.legacy),
					schema ? false : /\/\s*$/.test(raw),
					attributes.native,
				);
				if (schema) schemas.push(name);
				inline[properties.length - 1] =
					!!input[end + 1] && !/[\r\n]/.test(input[end + 1]);
			}
			token.lastIndex = end + 1;
		} else if (match[4]) {
			const props = parseAttributes(
				match[6]
					.trim()
					.replace(/^\{/, "")
					.replace(/\}\s*$/, ""),
			);
			const name = /^[A-Z]/.test(match[5]) ? match[5] : pascalCase(match[5]);
			if (match[6].includes("{") && !/\}\s*$/.test(match[6])) {
				out += input.slice(cursor, start) + match[0];
				cursor = token.lastIndex;
				continue;
			}
			const rest = input.slice(token.lastIndex);
			const self =
				match[4].length === 1 || (match[4].length === 2 && !rest.trim());
			replacement = tag(name, props, self) + (self ? "" : "\n");
			if (!self) stack.push({ name, colons: match[4].length, slot: false });
		} else if (match[7]) {
			const index = stack.findLastIndex(
				(item) => item.colons === match[7].length,
			);
			replacement =
				index === -1
					? match[0]
					: stack
							.splice(index)
							.reverse()
							.map(
								(current) =>
									(current.slot ? "\n</OxSlot>" : "") +
									`\n</${safeName(current.name)}>\n`,
							)
							.join("");
		} else if (match[8] && stack.length) {
			const current = stack.at(-1);
			replacement =
				(current.slot ? "\n</OxSlot>\n" : "") +
				tag("OxSlot", { ["#" + match[8]]: "" }) +
				"\n";
			current.slot = true;
		} else if (match[9] !== undefined) {
			const link = linkRanges.find(([a, b]) => start >= a && start < b);
			if (link) {
				token.lastIndex = link[1];
				continue;
			}
			if (references.has(match[9].toLowerCase())) continue;
			const before = input.slice(input.lastIndexOf("\n", start) + 1, start);
			if (/^[ xX]$/.test(match[9]) && /^\s*(?:[-*+]|\d+[.)])\s+$/.test(before))
				continue;
			replacement =
				tag("OxSpan", parseAttributes(match[10] ?? "")) +
				match[9].trimEnd() +
				"</span>";
		}
		if (replacement !== undefined) {
			out += input.slice(cursor, start) + replacement;
			cursor = token.lastIndex;
		}
	}
	out += input.slice(cursor);
	for (const current of stack.reverse())
		out +=
			(current.slot ? "\n</OxSlot>" : "") + `\n</${safeName(current.name)}>\n`;
	for (const name of schemas.reverse()) out += `\n</${name}>\n`;
	// Ordinary prose braces are literal in the legacy documents. Protect them
	// from MDX expression interpretation, keeping code and tag attributes intact.
	const protectedToken =
		/^ {0,3}(`{3,}|~{3,})[^\n]*(?:\n|$)|`+|<(?:[^"'<>]|"[^"]*"|'[^']*')*>/gm;
	let escaped = "",
		last = 0,
		t;
	const escapeText = (value) =>
		value
			.replace(/https?:\/\/\{[^}\n]+\}/g, (url) => url.replace(":", "&#58;"))
			.replace(
				/\{\{([^}]+)\}\}/g,
				(_, name) => `<span data-legacy-binding="${name.trim()}"></span>`,
			)
			.replace(/(?<!\\)[{}]/g, (brace) => "\\" + brace);
	while ((t = protectedToken.exec(out))) {
		const begin = t.index;
		if (t[1]) {
			const close = new RegExp(
				`^ {0,3}${t[1][0]}{${t[1].length},}[ \\t]*\\r?$`,
				"gm",
			);
			close.lastIndex = protectedToken.lastIndex;
			const end = close.exec(out);
			protectedToken.lastIndex = end ? close.lastIndex : out.length;
		} else if (t[0][0] === "`") {
			const end = out.indexOf(t[0], protectedToken.lastIndex);
			if (
				end !== -1 &&
				!/\n[ \t]*\n/.test(out.slice(protectedToken.lastIndex, end))
			)
				protectedToken.lastIndex = end + t[0].length;
		}
		escaped +=
			escapeText(out.slice(last, begin)) +
			out.slice(begin, protectedToken.lastIndex);
		last = protectedToken.lastIndex;
	}
	escaped += escapeText(out.slice(last));
	out = escaped;
	return {
		source: out,
		properties,
		originalTags,
		inline,
		componentTag: (name) =>
			name === "OxSpan"
				? "span"
				: name === "OxSlot"
					? "template"
					: kebabCase(name),
	};
}

// Typed MDX literal props remain in the source for Ox to parse; only legacy
// Vue bindings/shorthand are kept out of band. No JavaScript is evaluated.
function nativeAttributes(raw) {
	// Spreads are outside this site's static authoring contract. Reject them
	// before the legacy attribute adapter can mistake them for shorthand.
	let quoted = null;
	for (let i = 0; i < raw.length; i++) {
		const char = raw[i];
		if (quoted) {
			if (char === quoted && raw[i - 1] !== "\\") quoted = null;
		} else if (char === '"' || char === "'") quoted = char;
		else if (char === "{" && /^\{\s*\.\.\./.test(raw.slice(i))) {
			throw new Error(
				"MDX spread props are unsupported; use explicit literal props",
			);
		}
	}
	const expression = /(?<![:\w-])([A-Za-z_][\w-]*)\s*=\s*\{/g;
	const parts = [];
	let legacy = "",
		cursor = 0,
		match;
	while ((match = expression.exec(raw))) {
		let enclosingQuote = null;
		for (let i = cursor; i < match.index; i++) {
			const c = raw[i];
			if (enclosingQuote) {
				if (c === enclosingQuote && raw[i - 1] !== "\\") enclosingQuote = null;
			} else if (c === '"' || c === "'") enclosingQuote = c;
		}
		if (enclosingQuote) continue;
		let depth = 1,
			quote = null,
			end = expression.lastIndex;
		for (; end < raw.length && depth; end++) {
			const c = raw[end];
			if (quote) {
				if (c === quote && raw[end - 1] !== "\\") quote = null;
			} else if (c === '"' || c === "'") quote = c;
			else if (c === "{") depth++;
			else if (c === "}") depth--;
		}
		if (depth) throw Error("Unclosed MDX literal prop: " + match[1]);
		parts.push(raw.slice(match.index, end));
		legacy += raw.slice(cursor, match.index);
		cursor = expression.lastIndex = end;
	}
	return { native: parts.join(" "), legacy: legacy + raw.slice(cursor) };
}
