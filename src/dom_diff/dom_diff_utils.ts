/**
 * dom_diff_utils.ts
 *
 * This utility class/file provides DOM utilities for HTML parsing and normalization using Cheerio.
 *
 * Features:
 * - Inline/block element sets and blacklist for tag filtering
 * - String normalization for text extraction
 * - DomTree and DomNode classes for DOM traversal, labeling, and comparison
 * - Methods for extracting normalized representations and text from DOM nodes
 *
 * Used for DOM diffing, content extraction, and HTML analysis in scripts and pipelines.
 */

import * as cheerio from "cheerio";

// Inline elements: no line breaks before/after
export const INLINE_ELEMENTS = new Set([
	"a",
	"span",
	"em",
	"strong",
	"u",
	"i",
	"font",
	"mark",
	"label",
	"s",
	"sub",
	"sup",
	"tt",
	"bdo",
	"button",
	"cite",
	"del",
	"b",
]);

// List indicator character
export const LIST_INDICATOR_CHAR = "*";

// Blacklisted tags and classes
export const BLACKLIST_TAGS = new Set([
	"script",
	"style",
	"noscript",
	"cyfunction",
	"button",
	"form",
]);

// Node identifier key
export const NODE_IDENTIFIER_KEY = "__node_id";

// Utility function: normalize string
export function normalizeString(
	text: string | undefined,
	lowerCase = false,
): string {
	if (!text) return "";
	// Unescape HTML
	const $ = cheerio.load(`<div>${text}</div>`);
	let normText = $("div").text();
	normText = normText ? normText.normalize("NFKC") : "";
	normText = lowerCase ? normText.toLowerCase() : normText;
	normText = normText.replace(/\t/g, " ");
	normText = normText.replace(/\n[ ]+/g, "\n");
	normText = normText.replace(/[ ]+/g, " ");
	normText = normText.replace(/[\n]{3,}/g, "\n\n");
	normText = normText
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean)
		.join("\n");
	return normText.trim();
}

export class DomTree {
	$: cheerio.CheerioAPI;
	root: DomNode;
	elements: Map<string, DomNode> = new Map();

	constructor(html: string) {
		this.$ = cheerio.load(html);
		// Assign unique IDs to all elements
		let id = 0;
		this.$("*").each((_, el) => {
			(el as any)[NODE_IDENTIFIER_KEY] = String(id);
			id++;
		});
		// Build registry
		this.$("*").each((_, el) => {
			const nodeId = (el as any)[NODE_IDENTIFIER_KEY];
			if (nodeId) {
				this.elements.set(nodeId, new DomNode(this.$, el as any, this));
			}
		});
		// Set root
		this.root = this.elements.get("0")!;
	}

	getNodeById(id: string): DomNode | undefined {
		return this.elements.get(id);
	}
}

export class DomNode {
	$: cheerio.CheerioAPI;
	el: any; // CheerioElement or Node
	tree: DomTree;
	_normalizedCache?: string;

	constructor($: cheerio.CheerioAPI, el: any, tree: DomTree) {
		this.$ = $;
		this.el = el;
		this.tree = tree;
	}

	get tag(): string {
		return this.el.tagName;
	}

	get text(): string {
		return this.$(this.el).text();
	}

	get tail(): string {
		// Cheerio does not have tail, but we can get next sibling's text if needed
		return "";
	}

	get attrib(): Record<string, string> {
		const attribs = { ...this.el.attribs };
		delete attribs[NODE_IDENTIFIER_KEY];
		return attribs;
	}

	getchildren(): DomNode[] {
		return this.$(this.el)
			.children()
			.toArray()
			.map((child) => new DomNode(this.$, child, this.tree));
	}

	clearCache() {
		this._normalizedCache = undefined;
	}

	private removeSpaces(text: string): string {
		return text
			.replace(/\t|\n| /g, "")
			.toLowerCase()
			.trim();
	}

	normalizedRepresentation(isRoot = true): string {
		// Only want elements within root DOM, not what comes after
		const tailingText = !isRoot ? this.removeSpaces(this.tail) : "";
		if (this._normalizedCache) {
			return this._normalizedCache + tailingText;
		}
		this._normalizedCache = this.removeSpaces(this._normalizedRepresentation());
		return this._normalizedCache + tailingText;
	}

	private _normalizedRepresentation(): string {
		// Ignore attributes
		const attributeString = "";
		const text = this.text ? this.text.trim() : "";
		const children = this.getchildren();
		if (children.length === 0 && !text) {
			return `<${this.tag}${attributeString}></${this.tag}>`;
		}
		const internalElements = children
			.map((child) => child.normalizedRepresentation(false))
			.join("");
		return `<${this.tag}${attributeString}>${text}${internalElements}</${this.tag}>`;
	}

	extractText(): string {
		// Find <body> if present
		let node = this.el;
		const body = this.$("body").get(0);
		if (body) node = body;
		const text = this._extractText(node).join("");
		return normalizeString(text);
	}

	private _extractText(node: any): string[] {
		const result: string[] = [];
		this.$(node)
			.children()
			.each((_, child: any) => {
				if (BLACKLIST_TAGS.has(child.tagName)) return;
				// Block element?
				const isBlock = !INLINE_ELEMENTS.has(child.tagName);
				if (isBlock) result.push("\n");
				if (child.tagName === "li") result.push(`${LIST_INDICATOR_CHAR} `);
				const childText = this.$(child)
					.contents()
					.filter(function (this: any) {
						return this.type === "text";
					})
					.text();
				if (childText?.trim()) result.push(childText);
				if (child.tagName === "br") result.push("\n");
				else result.push(...this._extractText(child));
				// Cheerio does not have tail, but we can get next sibling's text if needed
				if (isBlock) result.push("\n");
			});
		return result;
	}
}
