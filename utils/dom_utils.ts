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
 * Removes empty tags and unwraps unnecessary wrapper tags from the given HTML string, then removes empty lines.
 * - Removes tags with no text, no children, and no valuable attributes.
 * - Unwraps wrapper tags that have no valuable attributes, no text, but have children (moving children up the hierarchy).
 * Valuable attributes include: value, datetime, content, href, src, alt, title, and any data-* attributes.
 * Performs iterative bottom-up pruning and unwrapping to clean the DOM hierarchy.
 * Returns the cleaned HTML string.
 */
export function removeEmptyTags(html: string): string {
	const $ = cheerio.load(html);

	// Helper function to check if an element has valuable attributes
	function hasValuableAttributes(el: cheerio.Cheerio<any>): boolean {
		const valuableAttrs = [
			"value",
			"datetime",
			"content",
			"href",
			"src",
			"alt",
			"title",
		];
		for (const attr of valuableAttrs) {
			if (el.attr(attr)) return true;
		}
		// Check for data- attributes
		if (el[0]?.attribs) {
			for (const attr in el[0].attribs) {
				if (attr.startsWith("data-")) return true;
			}
		}
		return false;
	}

	// Iteratively remove empty elements and unwrap wrappers
	let changed = true;
	while (changed) {
		changed = false;

		// Remove empty elements (no children, no text, no valuable attrs)
		$("*").each(function () {
			const el = $(this);
			if (
				!hasValuableAttributes(el) &&
				!el.children().length &&
				el.text().trim() === ""
			) {
				el.remove();
				changed = true;
			}
		});

		// Collect wrapper elements to unwrap (no valuable attrs, no text, but have children)
		let toUnwrap: cheerio.Cheerio<any>[] = [];
		$("*").each(function () {
			const el = $(this);
			if (
				!hasValuableAttributes(el) &&
				el.text().trim() === "" &&
				el.children().length > 0
			) {
				toUnwrap.push(el);
			}
		});

		// Unwrap the collected elements (move children up)
		for (const el of toUnwrap) {
			el.children().unwrap();
			changed = true;
		}
	}

	let result = $.html();
	result = result
		.split("\n")
		.filter((line) => line.trim() !== "")
		.join("\n");
	return result;
}

export function removeNavTags(html: string): string {
	const $ = cheerio.load(html);
	$("nav").remove();
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
 * Removes boilerplate content like *share* buttons, navigation menus, and other link-heavy clusters.
 * Focuses on immediate parents of multiple sibling <a> tags to avoid removing larger content due to nested link-heavy subtags.
 * @param htmlContent The HTML string to process.
 * @param densityThreshold The threshold above which blocks are removed (default 0.35).
 * @param minSiblingLinks Minimum number of sibling <a> tags required to consider a parent (default 2).
 * @returns Cleaned HTML string.
 */
export function removeBoilerplateLinkClusters(
	htmlContent: string,
	densityThreshold = 0.35,
	minSiblingLinks = 2,
): string {
	if (!htmlContent) return "";
	const $ = cheerio.load(htmlContent);

	// Find all <a> tags
	$("a").each(function () {
		const $link = $(this);
		const $parent = $link.parent();

		// Count sibling <a> tags (including itself)
		const siblingLinks = $parent.children("a").length;

		if (siblingLinks >= minSiblingLinks) {
			// Check if we haven't already processed this parent
			if (!$parent.data("processed")) {
				$parent.data("processed", true);
				const density = calculateLinkDensity($parent);
				if (density > densityThreshold) {
					const tag = $parent.prop("tagName") || "unknown";
					console.log(
						`[removeBoilerplate] Removing block <${tag}> (density: ${density.toFixed(2)}, sibling links: ${siblingLinks})`,
					);
					$parent.remove();
				}
			}
		}
	});

	return $("body").length ? $("body").html() || "" : $.root().html() || "";
}

/**
 * Removes breadcrumb navigation elements from HTML.
 * Targets common breadcrumb patterns: <nav aria-label="breadcrumb">, elements with class "breadcrumb",
 * or <ol>/<ul> containing links separated by separators like ">".
 * Since this is called on extracted main content, removes all detected breadcrumbs.
 * @param htmlContent The HTML string to process.
 * @returns Cleaned HTML string.
 */
export function removeBreadcrumbs(htmlContent: string): string {
	if (!htmlContent) return "";
	const $ = cheerio.load(htmlContent);
	// Remove elements with class "breadcrumb"
	$(".breadcrumb").remove();

	// Remove <ol> or <ul> that look like breadcrumbs: multiple <li> with <a> and separators
	$("ol, ul").each(function () {
		const $list = $(this);
		const $lis = $list.children("li");
		if ($lis.length >= 2) {
			// At least 2 items for a breadcrumb
			let isBreadcrumb = true;
			$lis.each(function () {
				const $li = $(this);
				const text = $li.text().trim();
				// Check if it has a link or is a separator
				if (!$li.find("a").length && !/^\s*[>\/|]\s*$/.test(text)) {
					isBreadcrumb = false;
					return false; // break
				}
			});
			if (isBreadcrumb) {
				console.log("[removeBreadcrumbs] Removing breadcrumb list");
				$list.remove();
			}
		}
	});

	return $.html();
}
