import * as cheerio from "cheerio";

import TurndownService from "turndown";

/**
 * Converts HTML to Markdown using Turndown.
 */
export function htmlToMarkdown(html: string): string {
	const turndownService = new TurndownService();
	return turndownService.turndown(html);
}

/**
 * Cleans HTML by removing <script>, <style>, and common skip links (e.g., skip to content).
 * Use this before DOM parsing for main content extraction.
 */
export function cleanHtmlPreDom(html: string): string {
	// Remove <script>...</script> and <style>...</style>
	let cleaned = html
		.replace(/<script[\s\S]*?<\/script>/gi, "")
		.replace(/<style[\s\S]*?<\/style>/gi, "");
	// Remove skip links (e.g., <a ...>skip to main content</a>)
	cleaned = cleaned.replace(/<a[^>]*>(\s*skip[^<]{0,40}content\s*)<\/a>/gi, "");
	return cleaned;
}

// Utility to remove <script> and <style> tags from HTML before parsing
export function stripScriptAndStyleTags(html: string): string {
	// Remove <script>...</script> and <style>...</style> blocks (greedy)
	return html
		.replace(/<script[\s\S]*?<\/script>/gi, "")
		.replace(/<style[\s\S]*?<\/style>/gi, "");
}

/**
 * Removes empty tags (tags with no text or child elements) from the given HTML string.
 * Returns the cleaned HTML string.
 */
export function removeEmptyTags(html: string): string {
	const $ = cheerio.load(html);
	// Select all elements and remove those that are empty (no text and no children)
	$("*").each(function () {
		const el = $(this);
		// Check if element has no children and no text content
		if (!el.children().length && el.text().trim() === "") {
			el.remove();
		}
	});
	return $.html();
}

/**
 * Calculates the link density of a DOM element.
 * Link density = (total linked chars) / (total visible chars)
 * Linked chars include anchor text and image alt text inside anchors.
 */
export function calculateLinkDensity(element: cheerio.Cheerio<any>): number {
	const totalVisibleChars = element.text().length;
	let linkedChars = 0;

	element.find("a").each((_: number, anchor: any) => {
		const $anchor = element.find("a").filter((_, el) => el === anchor);
		const linkText = $anchor.text();
		linkedChars += linkText.length;

		// If anchor has no text, check for <img> and use its alt text
		if (linkText.length === 0) {
			const img = $anchor.find("img");
			if (img.length > 0) {
				const alt = img.attr("alt");
				if (alt && alt.length > 0) {
					linkedChars += alt.length;
				}
			}
		}
	});

	// Handle division by zero
	if (totalVisibleChars === 0) {
		if (linkedChars > 0) {
			return 1.0;
		} else {
			return 0.0;
		}
	}
	return linkedChars / totalVisibleChars;
}

/**
 * Removes boilerplate content from HTML by removing blocks with high link density.
 * @param htmlContent The HTML string to process.
 * @param densityThreshold The threshold above which blocks are removed (default 0.35).
 * @returns Cleaned HTML string.
 */
export function removeHighLinkDensityBlocks(
	htmlContent: string,
	densityThreshold = 0.35,
): string {
	if (!htmlContent) return "";
	const $ = cheerio.load(htmlContent);
	const blocksToAnalyze = [
		"div",
		"section",
		"aside",
		"nav",
		"footer",
		"header",
		"ul",
		"ol",
		"li",
		"menu",
		"h1",
		"h2",
		"h3",
		"h4",
		"h5",
		"h6",
	].join(", ");
	$(blocksToAnalyze).each(function () {
		const block = $(this);
		const density = calculateLinkDensity(block);
		if (density > densityThreshold) {
			let tag = "unknown";
			if (block[0] && typeof block[0] === "object" && "name" in block[0]) {
				tag = (block[0] as any).name;
			}
			console.log(
				`[removeBoilerplate] Removing block <${tag}> (density: ${density.toFixed(2)})`,
			);
			block.remove();
		}
	});
	return $("body").length ? $("body").html() || "" : $.root().html() || "";
}
