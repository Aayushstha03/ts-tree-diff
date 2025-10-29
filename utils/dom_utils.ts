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
// STAGE 1 for main content extraction
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
