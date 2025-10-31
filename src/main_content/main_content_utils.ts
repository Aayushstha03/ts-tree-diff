import type * as cheerio from "cheerio";

// TIER 1 CHECK
// Cheerio version: returns the HTML of the skip-to-content target element and its children if found, else null
export function getSkipToContentTargetHtmlCheerio(
	$: cheerio.CheerioAPI,
): string | null {
	const skipTexts = [
		/skip\s+to\s+main\s+content/i,
		/skip\s+to\s+content/i,
		/skip\s+to\s+main/i,
		/skip\s+navigation/i,
		/jump\s+to\s+main/i,
		/jump\s+to\s+main\s+content/i,
		/jump\s+to\s+content/i,
	];
	const anchors = $('a[href^="#"]');
	for (let i = 0; i < anchors.length; i++) {
		const anchor = anchors.eq(i);
		const text = (anchor.text() || "").trim();
		const ariaLabel = anchor.attr("aria-label") || "";
		const href = anchor.attr("href") || "";
		// Match skip-to-content anchors by text, aria-label, or href
		if (
			skipTexts.some((rx) => rx.test(text)) ||
			skipTexts.some((rx) => rx.test(ariaLabel)) ||
			["#main", "#content", "#primary"].includes(href.toLowerCase())
		) {
			if (href.startsWith("#")) {
				const targetId = href.slice(1);
				// Try exact match first
				let targetEl = $(`#${targetId}`);
				// If not found, try case-insensitive match
				if (!targetEl.length) {
					targetEl = $(`[id]`).filter((_, el) => {
						return $(el).attr("id")?.toLowerCase() === targetId.toLowerCase();
					});
				}
				if (targetEl.length) {
					// Return only the outer HTML of the target element (not the whole document)
					// Cheerio does not have .outerHTML directly, but .prop('outerHTML') works
					return targetEl.prop("outerHTML") || null;
				}
			}
		}
	}
	return null;
}

// TIER 2 check
// Returns an object with the main content HTML and a label for the matching level
export function extractMainContentHtmlCheerio(
	$: cheerio.CheerioAPI,
): { html: string; label: string } | null {
	// 1. Check for <main> tag
	const mainTags = $("main");
	if (mainTags.length > 1) {
		console.warn(
			`[extractMainContentHtmlCheerio] Warning: Found ${mainTags.length} <main> tags, using the first one.`,
		);
	}
	if (mainTags.length) {
		return {
			label: "level 1: <main> tag",
			html: `<!-- level 1: <main> tag -->\n${mainTags.first().html()}`,
		};
	}

	// 2. Check for role="main"
	const roleMain = $('[role="main"]').first();
	if (roleMain.length) {
		return {
			label: 'level 2: role="main"',
			html: `<!-- level 2: role="main" -->\n${roleMain.html()}`,
		};
	}

	// 3. Check for id='main' (exact match)
	const idMainExact = $('[id="main"]');
	if (idMainExact.length > 1) {
		console.warn(
			`[extractMainContentHtmlCheerio] Warning: Found ${idMainExact.length} elements with id='main', using the first one.`,
		);
	}
	if (idMainExact.length) {
		return {
			label: 'level 3: id="main"',
			html: `<!-- level 3: id="main" -->\n${idMainExact.first().html()}`,
		};
	}

	// 4. Check for id containing 'main' (case-insensitive)
	const idMain = $('[id*="main" i]');
	if (idMain.length) {
		return {
			label: 'level 4: id contains "main"',
			html: `<!-- level 4: id contains "main" -->\n${idMain.first().html()}`,
		};
	}

	return null;
}
