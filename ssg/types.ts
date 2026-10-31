export interface TocLink {
	id: string;
	depth: number;
	text: string;
	children?: TocLink[];
}
export interface NavItem {
	title: string;
	_path: string;
	children?: NavItem[];
	[key: string]: any;
}

export interface MarkdownText {
	type: "text";
	value: string;
}
export interface MarkdownElement {
	type: "element";
	tag: string;
	props: Record<string, unknown>;
	children: MarkdownNode[];
}
export type MarkdownNode = MarkdownText | MarkdownElement;
export interface MarkdownRoot {
	type: "root";
	children: MarkdownNode[];
	toc?: { title: string; searchDepth: number; depth: number; links: TocLink[] };
}
export interface ParsedContent {
	_path?: string;
	_file?: string;
	_id?: string;
	_type?: string;
	_extension?: string;
	_draft?: boolean;
	_partial?: boolean;
	_locale?: string;
	title?: string;
	description?: string;
	navigation?: boolean | Record<string, unknown>;
	[key: string]: any;
}
export interface MarkdownParsedContent extends ParsedContent {
	body: MarkdownRoot;
}
