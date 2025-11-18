import * as cheerio from "cheerio";
import type { Element } from "domhandler";

// Combined robust version: tries skip links first, then semantic selectors, then content heuristics
// Returns full HTML with only the main content in the body
export function extractMainContent(
	$: cheerio.CheerioAPI,
): { html: string; label: string } | null {
	// TIER 1: Try skip-to-content links
	const skipResult = getSkipToContentTargetHtmlCheerio($);
	if (skipResult) {
		return {
			html: reconstructHtmlWithMainContent($, skipResult),
			label: "skip link target",
		};
	}

	// TIER 2: Semantic HTML selectors (original extractMainContentHtmlCheerio logic)
	const semanticResult = extractMainContentHtmlCheerio($);
	if (semanticResult) {
		return {
			html: reconstructHtmlWithMainContent($, semanticResult.html),
			label: semanticResult.label,
		};
	}

	// TIER 3 & 4: Heuristic scoring approach
	const candidates = findContentCandidates($);
	if (candidates.length > 0) {
		// Score and sort candidates
		const scoredCandidates = candidates
			.map((candidate) => ({
				...candidate,
				score: scoreContentCandidate(candidate.element),
			}))
			.sort((a, b) => b.score - a.score);

		const bestCandidate = scoredCandidates[0];
		if (bestCandidate && bestCandidate.score > 0) {
			const el = bestCandidate.element as cheerio.Cheerio<Element>;
			const contentHtml = `<!-- ${bestCandidate.label} (score: ${bestCandidate.score}) -->\n${el.html()}`;
			return {
				html: reconstructHtmlWithMainContent($, contentHtml),
				label: bestCandidate.label,
			};
		}
	}

	return null;
}

// Helper function to reconstruct full HTML with only main content in body
function reconstructHtmlWithMainContent(
	$: cheerio.CheerioAPI,
	mainContentHtml: string,
): string {
	// Get the original HTML structure
	const htmlElement = $("html");
	const headElement = $("head");
	const bodyElement = $("body");

	// Build the new HTML
	let result = "";

	// Add DOCTYPE if present (simple approach)
	const rootHtml = $.html();
	const doctypeMatch = rootHtml.match(/<!DOCTYPE[^>]*>/i);
	if (doctypeMatch) {
		result += doctypeMatch[0] + "\n";
	}

	// Start HTML tag with attributes
	if (htmlElement.length) {
		const htmlAttrs = htmlElement.attr();
		const attrString = Object.entries(htmlAttrs || {})
			.map(([key, value]) => `${key}="${value}"`)
			.join(" ");
		result += `<html${attrString ? " " + attrString : ""}>\n`;
	} else {
		result += "<html>\n";
	}

	// Add head section (preserves all meta, link, script tags)
	if (headElement.length) {
		// Clone head and filter out JavaScript script tags
		const $headClone = headElement.clone();
		$headClone.find("script").each((_, scriptEl) => {
			const $script = $(scriptEl);
			const scriptContent = $script.html() || "";
			// Remove script tags containing JavaScript code patterns
			if (
				/(function|=>|var |let |const |window\.|document\.)/.test(scriptContent)
			) {
				$script.remove();
			}
		});
		result += $headClone.prop("outerHTML") + "\n";
	} else {
		// If no head, create one with any head-level content that might exist
		const headContent = $("meta, link, script, title, style").not(
			"body meta, body link, body script, body title, body style",
		);
		if (headContent.length) {
			result += "<head>\n";
			headContent.each((_, el) => {
				const $el = $(el);
				// Filter script tags in the fallback case too
				if ($el.is("script")) {
					const scriptContent = $el.html() || "";
					if (
						!/(function|=>|var |let |const |window\.|document\.)/.test(
							scriptContent,
						)
					) {
						result += ($el.prop("outerHTML") || "") + "\n";
					}
				} else {
					result += ($el.prop("outerHTML") || "") + "\n";
				}
			});
			result += "</head>\n";
		}
	}

	// Filter script tags in main content HTML
	const $mainContent = cheerio.load(mainContentHtml, null, false);
	$mainContent("script").each((_, scriptEl) => {
		const $script = $mainContent(scriptEl);
		const scriptContent = $script.html() || "";
		// Remove script tags containing JavaScript code patterns
		if (
			/(function|=>|var |let |const |window\.|document\.)/.test(scriptContent)
		) {
			$script.remove();
		}
	});
	const filteredMainContentHtml = $mainContent.html();

	// Add body with only the main content
	if (bodyElement.length) {
		const bodyAttrs = bodyElement.attr();
		const attrString = Object.entries(bodyAttrs || {})
			.map(([key, value]) => `${key}="${value}"`)
			.join(" ");
		result += `<body${attrString ? " " + attrString : ""}>\n`;
		result += filteredMainContentHtml;
		result += "\n</body>\n";
	} else {
		// If no body tag, wrap content in body
		result += "<body>\n";
		result += filteredMainContentHtml;
		result += "\n</body>\n";
	}

	result += "</html>";

	return result;
}

// Helper function to score content candidates
function scoreContentCandidate($el: unknown): number {
	const el = $el as cheerio.Cheerio<Element>;
	let score = 0;
	const text = el.text().trim();
	const textLength = text.length;

	// Base score from text length (more text = better)
	score += Math.min(textLength / 10, 100); // Cap at 100 points for length

	// Bonus for semantic content elements
	const paragraphCount = el.find("p").length;
	const headingCount = el.find("h1, h2, h3, h4, h5, h6").length;
	const listCount = el.find("ul, ol").length;
	score += paragraphCount * 5; // 5 points per paragraph
	score += headingCount * 10; // 10 points per heading
	score += listCount * 3; // 3 points per list

	// Bonus for content-suggesting class/id names
	const classAndId = (el.attr("class") || "") + " " + (el.attr("id") || "");
	const contentKeywords = [
		"content",
		"main",
		"article",
		"post",
		"entry",
		"text",
		"body",
	];
	const keywordMatches = contentKeywords.filter((keyword) =>
		classAndId.toLowerCase().includes(keyword),
	);
	score += keywordMatches.length * 15; // 15 points per content keyword

	// Penalty for navigation/footer elements
	if (el.find("nav, footer, header").length > 0) score -= 50;
	if (el.hasClass("nav") || el.hasClass("footer") || el.hasClass("header"))
		score -= 100;
	if (el.is("nav, footer, header")) score -= 200;

	// Penalty for very short content
	if (textLength < 200) score -= 100;

	// Bonus for being an article or main element
	if (el.is("article, main")) score += 20;

	return Math.max(0, score); // Don't go below 0
}

// TIER 3: Find content candidates from common selectors
function findContentCandidates(
	$: cheerio.CheerioAPI,
): Array<{ element: cheerio.Cheerio<Element>; label: string }> {
	const candidates: Array<{
		element: cheerio.Cheerio<Element>;
		label: string;
	}> = [];

	// Common content container selectors
	const contentSelectors = [
		"article", // HTML5 article element
		'[role="article"]', // ARIA article role
		'[class*="content" i]', // Class containing "content"
		'[class*="main-content" i]', // Class containing "main-content"
		'[class*="post" i]', // Class containing "post"
		'[class*="entry" i]', // Class containing "entry"
		'[id*="content" i]', // ID containing "content"
		'[id*="main-content" i]', // ID containing "main-content"
	];

	// Collect candidates from selectors
	for (const selector of contentSelectors) {
		const elements = $(selector);
		elements.each((_, el) => {
			const $el = $(el);
			const textLength = $el.text().trim().length;
			if (textLength > 100) {
				// Minimum threshold
				candidates.push({
					element: $el as cheerio.Cheerio<Element>,
					label: `tier 3: ${selector}`,
				});
			}
		});
	}

	// TIER 4: Largest text block candidates
	$("div, section, main, article, aside").each((_, el) => {
		const $el = $(el);
		const text = $el.text().trim();
		const textLength = text.length;

		// Skip elements that are too small or likely navigation/footer
		if (textLength < 100) return;
		if ($el.find("nav, footer, header").length > 0) return;
		if ($el.hasClass("nav") || $el.hasClass("footer") || $el.hasClass("header"))
			return;

		candidates.push({
			element: $el as cheerio.Cheerio<Element>,
			label: `tier 4: text block (${textLength} chars)`,
		});
	});

	return candidates;
}

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
