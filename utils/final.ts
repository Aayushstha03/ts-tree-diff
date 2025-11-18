import * as cheerio from "cheerio";
/**
 * Extracts main content by removing boilerplate elements while preserving informational content.
 * Removes navigation, headers, footers, sidebars, ads, and other non-content elements.
 * Returns cleaned HTML with <html> tags preserved.
 */
export function cleanHtml(html: string): string {
	const $ = cheerio.load(html);

	// Remove script and style elements
	$("style").remove();
	// Remove inline styles
	$("*").removeAttr("style");

	// Remove common ad containers
	$('.ad, .ads, .advertisement, [class*="ad-"], [id*="ad-"]').remove();

	// Remove breadcrumb elements
	$(".breadcrumb").remove();

	// Remove navigation elements
	$("nav").remove();
	$('[class*="nav"]').remove();
	$('[id*="nav"], [id*="menu"], [id*="footer"], [id*="header"]').remove();

	// remove footers
	$("footer").remove();

	// Clean up empty tags
	const cleanedHtml = removeEmptyTags($.html());

	// Ensure we return HTML with <html> tags
	const final$ = cheerio.load(cleanedHtml);
	return final$.root().html() || cleanedHtml;
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
			"class",
			"id",
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

	// Helper function to check if an element has direct text content
	function hasDirectText(el: cheerio.Cheerio<any>): boolean {
		let hasText = false;
		el.contents().each((_: number, node: any) => {
			if (node.type === "text" && node.data.trim().length > 0) {
				hasText = true;
				return false; // break
			}
		});
		return hasText;
	}

	// Iteratively remove empty elements and unwrap wrappers
	let changed = true;
	let iterations = 0;
	const maxIterations = 50; // Prevent infinite loops
	while (changed && iterations < maxIterations) {
		changed = false;
		iterations++;
		console.log(`[removeEmptyTags] Iteration ${iterations}`);

		// Remove empty elements (no children, no text, no valuable attrs)
		let removedCount = 0;
		$("*").each(function () {
			const el = $(this);
			if (
				!hasValuableAttributes(el) &&
				!el.children().length &&
				el.text().trim() === ""
			) {
				el.remove();
				removedCount++;
				changed = true;
			}
		});
		console.log(`[removeEmptyTags] Removed ${removedCount} empty elements`);

		// Collect wrapper elements to unwrap (no valuable attrs, no text, but have children)
		let toUnwrap: cheerio.Cheerio<any>[] = [];
		$("*").each(function () {
			const el = $(this);
			if (
				!hasValuableAttributes(el) &&
				!hasDirectText(el) &&
				el.children().length > 0
			) {
				toUnwrap.push(el);
			}
		});
		console.log(
			`[removeEmptyTags] Found ${toUnwrap.length} wrapper elements to unwrap`,
		);

		// Unwrap the collected elements (move children up)
		for (const el of toUnwrap) {
			el.children().unwrap();
			changed = true;
		}
		console.log(`[removeEmptyTags] Unwrapped ${toUnwrap.length} elements`);
	}

	if (iterations >= maxIterations) {
		console.warn(
			`[removeEmptyTags] Reached maximum iterations (${maxIterations}), stopping to prevent infinite loop`,
		);
	}

	let result = $.html();
	result = result
		.split("\n")
		.filter((line) => line.trim() !== "")
		.join("\n");
	return result;
}
