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
 * Used for DOM diffing
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
		return "";
	}

	get attrib(): Record<string, string> {
		const attribs = { ...this.el.attribs };
		delete attribs[NODE_IDENTIFIER_KEY];
		return attribs;
	}

	toHtml(): string {
		// Returns the HTML for this node and its subtree
		return this.$.html(this.el) ?? "";
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
}

/**
 * Given three raw HTML strings (article, homepage, notFound),
 * return the cleaned/normalized unique HTML for the article by
 * diffing against the homepage and not-found DOMs.
 */
export function extractUniqueNormalizedHtml(
	articleHtmlRaw: string,
	homepageHtmlRaw: string,
	notFoundHtmlRaw: string,
): string {
	const articleTree = new DomTree(articleHtmlRaw);
	const homepageTree = new DomTree(homepageHtmlRaw);
	const notFoundTree = new DomTree(notFoundHtmlRaw);

	const homepageLabels = new Set<string>();
	const notFoundLabels = new Set<string>();

	function collectLabels(node: DomNode, set: Set<string>) {
		set.add(node.normalizedRepresentation());
		for (const child of node.getchildren()) {
			collectLabels(child, set);
		}
	}

	collectLabels(homepageTree.root, homepageLabels);
	collectLabels(notFoundTree.root, notFoundLabels);

	function collectUniqueHtml(node: DomNode): string[] {
		const label = node.normalizedRepresentation();
		if (homepageLabels.has(label) || notFoundLabels.has(label)) {
			return [];
		}
		if (typeof node.toHtml === "function") {
			return [node.toHtml()];
		}
		let results: string[] = [];
		for (const child of node.getchildren()) {
			results = results.concat(collectUniqueHtml(child));
		}
		return results;
	}

	const uniqueHtmls = collectUniqueHtml(articleTree.root);
	const uniqueHtml = uniqueHtmls.join("<br>\n");
	return uniqueHtml;
}

function getDomain(url: string): string {
	try {
		const u = new URL(url.startsWith("http") ? url : `https://${url}`);
		return u.origin;
	} catch {
		throw new Error(`Invalid URL: ${url}`);
	}
}

function get404Url(url: string): string {
	const domain = getDomain(url);
	return `${domain}/error_page_hehe`;
}
