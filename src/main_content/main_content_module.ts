import { mkdirSync, writeFileSync } from "node:fs";
import * as cheerio from "cheerio";
import {
	cleanHtmlPreDom,
	htmlToMarkdown,
	removeEmptyTags,
} from "../../utils/dom_utils";
import { fetchHtmlCached } from "../../utils/fetch_html_cached";
import {
	extractMainContentHtmlCheerio,
	getSkipToContentTargetHtmlCheerio,
} from "./main_content_utils";

/**
 * Downloads HTML for a URL, parses the DOM, and returns the main content block HTML
 * along with the matching level label.
 *
 * Usage:
 *   const result = await getMainContentBlockFromUrl("https://example.com");
 *   if (result) {
 *     console.log(result.label); // e.g., "level 1: <main> tag"
 *     console.log(result.html);  // HTML with a comment at the top
 *   }
 */
export async function getMainContentBlockFromUrl(
	url: string,
): Promise<{ html: string; label: string } | null> {
	const html = await fetchHtmlCached(url);
	const $ = cheerio.load(html);
	// Try skip-to-content method first
	const skipHtml = getSkipToContentTargetHtmlCheerio($);
	if (skipHtml) {
		let cleaned = removeEmptyTags(skipHtml);
		cleaned = cleanHtmlPreDom(cleaned);
		cleaned = removeEmptyTags(cleaned);

		console.log("Found skip-to-content link.");
		return {
			label: "tier 1: skip-to-content link",
			html: `<!-- tier 1: skip-to-content link -->\n${cleaned}`,
		};
	}
	console.log("No skip-to-content link found.");
	// Fallback to main content extraction
	return extractMainContentHtmlCheerio($);
}

(async () => {
	// List of URLs to process
	const urls = [
		"https://www.bbc.com/news/articles/c4g7d39n6vgo",
		"https://www.onlinekhabar.com/2025/10/1791118/trilateral-talks-between-government-political-parties-and-genji-representatives-tomorrow",
		"https://www.bankofcanada.ca/2025/10/free-family-events-bank-canada-museum-financial-literacy-month/",
		"https://www.bankofcanada.ca/2025/08/summary-of-governing-council-deliberations-fixed-announcement-date-of-july-30-2025/",
		"https://www.bancaditalia.it/pubblicazioni/interventi-direttorio/int-dir-2025/20250918-scotti/index.html?com.dotmarketing.htmlpage.language=1",
		"https://www.rbnz.govt.nz/hub/publications/bulletin/2025/pandemic-lessons-on-the-monetary-and-fiscal-policy-mix",
	];

	const outputsDir = "outputs";
	mkdirSync(outputsDir, { recursive: true });

	for (const url of urls) {
		console.log(`Processing: ${url}`);
		const result = await getMainContentBlockFromUrl(url);
		const safeUrl = url.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
		if (result) {
			const htmlPath = `${outputsDir}/${safeUrl}.html`;
			writeFileSync(htmlPath, result.html, { encoding: "utf8" });
			const md = htmlToMarkdown(result.html);
			const mdPath = `${outputsDir}/${safeUrl}.md`;
			writeFileSync(mdPath, md, { encoding: "utf8" });
			console.log(`Saved HTML to ${htmlPath}`);
			console.log(`Saved Markdown to ${mdPath}`);
		} else {
			console.log("No main content block found.");
		}
	}
})();
