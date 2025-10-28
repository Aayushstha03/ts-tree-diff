/**
 * dom_diff_module.ts
 *
 * This script fetches an article URL, its homepage, and a 404 page, cleans the HTML,
 * parses the DOMs, and compares them to extract the unique content of the article.
 *
 * The unique content is converted to Markdown using Turndown and saved to unique_article.md.
 *
 * Steps:
 * 1. Download and cache HTML for article, homepage, and 404 page.
 * 2. Remove <script> and <style> tags from HTML.
 * 3. Parse DOMs and collect normalized node labels.
 * 4. Diff article DOM against homepage/404 DOMs to find unique nodes.
 * 5. Convert unique HTML to Markdown and save to file.
 *
 * Usage:
 *   bun run src/dom_diff/dom_diff_module.ts <article_url>
 */

import { writeFileSync } from "node:fs";
import TurndownService from "turndown";
import { stripScriptAndStyleTags } from "../../utils/dom_utils";
import { fetchHtmlCached } from "../../utils/fetch_html_cached";
import type { DomNode } from "./dom_diff_utils";
import { DomTree } from "./dom_diff_utils";

function getDomain(url: string): string {
	try {
		const u = new URL(url.startsWith("http") ? url : `https://${url}`);
		return u.origin;
	} catch {
		throw new Error(`Invalid URL: ${url}`);
	}
}

function get404Url(domain: string): string {
	return `${domain}/error_page_hehe`;
}

async function main(articleUrl: string) {
	const domain = getDomain(articleUrl);
	const homepageUrl = `${domain}/`;
	const notFoundUrl = get404Url(domain);

	console.log("Fetching article:", articleUrl);
	const articleHtmlRaw = await fetchHtmlCached(articleUrl);
	console.log("Fetching homepage:", homepageUrl);
	const homepageHtmlRaw = await fetchHtmlCached(homepageUrl);
	console.log("Fetching 404 page:", notFoundUrl);
	const notFoundHtmlRaw = await fetchHtmlCached(notFoundUrl);

	// Preliminary clean: remove <script> and <style> tags
	const articleHtml = stripScriptAndStyleTags(articleHtmlRaw);
	const homepageHtml = stripScriptAndStyleTags(homepageHtmlRaw);
	const notFoundHtml = stripScriptAndStyleTags(notFoundHtmlRaw);

	const articleTree = new DomTree(articleHtml);
	const homepageTree = new DomTree(homepageHtml);
	const notFoundTree = new DomTree(notFoundHtml);

	// For now, just print root tags and text lengths
	console.log(
		"Article root tag:",
		articleTree.root.tag,
		"text length:",
		articleTree.root.extractText().length,
	);
	console.log(
		"Homepage root tag:",
		homepageTree.root.tag,
		"text length:",
		homepageTree.root.extractText().length,
	);
	console.log(
		"404 root tag:",
		notFoundTree.root.tag,
		"text length:",
		notFoundTree.root.extractText().length,
	);

	// Collect normalized labels from homepage and 404 DOMs
	function collectLabels(node: DomNode, set: Set<string>) {
		set.add(node.normalizedRepresentation());
		for (const child of node.getchildren()) {
			collectLabels(child, set);
		}
	}

	const homepageLabels = new Set<string>();
	const notFoundLabels = new Set<string>();
	collectLabels(homepageTree.root, homepageLabels);
	collectLabels(notFoundTree.root, notFoundLabels);

	// Traverse article DOM and collect unique nodes
	function collectUniqueText(node: DomNode): string[] {
		const label = node.normalizedRepresentation();
		if (homepageLabels.has(label) || notFoundLabels.has(label)) {
			return [];
		}
		// If this node is unique, collect its text
		const children = node.getchildren();
		if (children.length === 0) {
			const txt = node.text.trim();
			return txt ? [txt] : [];
		}
		// Otherwise, recurse into children
		let results: string[] = [];
		for (const child of children) {
			results = results.concat(collectUniqueText(child));
		}
		return results;
	}

	const uniqueTexts = collectUniqueText(articleTree.root);
	const uniqueHtml = uniqueTexts.join("<br>\n");

	// Convert unique HTML to Markdown
	const turndownService = new TurndownService();
	const markdown = turndownService.turndown(uniqueHtml);

	console.log("\n--- Unique Article Markdown ---\n");
	console.log(markdown);

	console.log("\n--- Unique Article Markdown ---\n");
	console.log(markdown);

	// Save Markdown to file
	const outPath = "unique_article.md";
	writeFileSync(outPath, markdown, { encoding: "utf8" });
	console.log(`\nMarkdown saved to ${outPath}`);
}

// Argument parsing and main invocation
const url = process.argv[2];
if (!url) {
	console.error("Usage: bun run src/extract_unique_article.ts <article_url>");
	process.exit(1);
}
main(url).catch((err) => {
	console.error(err);
	process.exit(1);
});
