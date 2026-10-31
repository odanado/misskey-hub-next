// Keep complete links/images out of the legacy [span] adapter. Escaped or
// nested brackets in a label are ordinary CommonMark, not component syntax.
export function markdownLinkRanges(input) {
	const ranges = [];
	for (let start = 0; start < input.length; start++) {
		if (input[start] !== "[" || input[start - 1] === "\\") continue;
		let depth = 1,
			end = start + 1;
		for (; end < input.length && depth; end++) {
			if (input[end] === "\\") {
				end++;
				continue;
			}
			if (input[end] === "[") depth++;
			else if (input[end] === "]") depth--;
			else if (input[end] === "\n") break;
		}
		if (depth || input[end] !== "(") continue;
		let nesting = 1,
			cursor = end + 1;
		for (; cursor < input.length && nesting; cursor++) {
			if (input[cursor] === "\\") {
				cursor++;
				continue;
			}
			if (input[cursor] === "(") nesting++;
			else if (input[cursor] === ")") nesting--;
			else if (input[cursor] === "\n") break;
		}
		if (!nesting) {
			ranges.push([start, cursor]);
			start = cursor - 1;
		}
	}
	return ranges;
}
