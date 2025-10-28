import { writeFileSync } from "node:fs";
import TurndownService from "turndown";
import { stripScriptAndStyleTags } from "./dom_utils";
import { fetchHtmlCached } from "./fetch_html_cached";
import type { DomNode } from "./node_utils";
import { DomTree } from "./node_utils";

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
