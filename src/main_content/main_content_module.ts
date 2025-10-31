import { mkdirSync, writeFileSync } from "node:fs";
import * as cheerio from "cheerio";
import {
	cleanHtmlPreDom,
	htmlToMarkdown,
	removeBoilerplateLinkClusters,
	removeBreadcrumbs,
	removeEmptyTags,
	removeNavTags,
} from "../../utils/dom_utils";
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
	fileName: string,
): Promise<{ html: string; label: string } | null> {
	const htmlPath = `dom_diff_out/${fileName}`;
	let html = "";
	try {
		html = require("node:fs").readFileSync(htmlPath, { encoding: "utf8" });
	} catch (err) {
		console.error(`Could not read HTML file: ${htmlPath}`);
		return null;
	}
	const $ = cheerio.load(html);
	const title = $("title").text().trim();
	// Try skip-to-content method first
	const skipHtml = getSkipToContentTargetHtmlCheerio($);
	if (skipHtml) {
		// remove empty tags
		let cleaned = removeEmptyTags(skipHtml);
		// remove style and script tags, after cause we missed skip to main
		cleaned = cleanHtmlPreDom(cleaned);
		// remove high link density nodes, using a high threshold to avoid removing too much for now...
		cleaned = removeBoilerplateLinkClusters(cleaned, 0.65);
		// prepend title for breadcrumb proximity check
		cleaned = title ? `<h1>${title}</h1>\n${cleaned}` : cleaned;
		// remove breadcrumbs
		cleaned = removeBreadcrumbs(cleaned);
		console.log("Found skip-to-content link.");
		return {
			label: "tier 1: skip-to-content link",
			html: `<!-- tier 1: skip-to-content link -->\n${cleaned}`,
		};
	}
	console.log("No skip-to-content link found.");
	// Fallback to main content extraction
	const mainResult = extractMainContentHtmlCheerio($);
	if (mainResult) {
		mainResult.html = `<!-- ${mainResult.label} -->\n${title ? `<h1>${title}</h1>\n` : ""}${mainResult.html}`;
		return mainResult;
	}
	return null;
}

(async () => {
	const domDiffOutDir = "dom_diff_out";
	const outputsDir = "outputs";
	mkdirSync(outputsDir, { recursive: true });

	const fs = require("node:fs");
	const files = fs
		.readdirSync(domDiffOutDir)
		.filter((f: string) => f.endsWith(".html"));

	for (const fileName of files) {
		// Optionally reconstruct a pseudo-URL for logging
		const pseudoUrl = fileName.replace(/_+/g, " ").replace(/\.html$/, "");
		console.log(`Processing: ${fileName} (pseudo-URL: ${pseudoUrl})`);
		let result = await getMainContentBlockFromUrl(fileName);

		const baseName = fileName.replace(/\.html$/, "");
		if (result) {
			// remove nav tags, trying to remove breadcrumbs and navigation bars
			result.html = removeNavTags(result.html);
			// remove breadcrumbs
			result.html = removeBreadcrumbs(result.html);
			// cleaning results by folding empty tags, we will loose meta tags here (no text content)
			result.html = removeEmptyTags(result.html);
			const htmlPath = `${outputsDir}/${baseName}.html`;
			writeFileSync(htmlPath, result.html, { encoding: "utf8" });
			const md = htmlToMarkdown(result.html);
			const mdPath = `${outputsDir}/${baseName}.md`;
			writeFileSync(mdPath, md, { encoding: "utf8" });
			console.log(`Saved HTML to ${htmlPath}`);
			console.log(`Saved Markdown to ${mdPath}`);
		} else {
			console.log("No main content block found.");
		}
	}
})();
