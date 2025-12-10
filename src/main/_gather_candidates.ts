import type * as cheerio from "cheerio";
import * as Cheerio from "cheerio";

interface MainContentCandidate {
    foundBy: string;
    score: number;
    id: string;
    element: string;
}

// List of words indicating social media elements to be removed
// move to config later
const removeList: string[] = [
    "social",
    "facebook",
    "fb",
    "twitter",
    "tweet",
    "linkedin",
    "instagram",
    "pinterest",
    "reddit",
    "whatsapp",
    "share",
    "follow",
    "comment",
    "comments",
    "discuss",
    "reply",
    "respond",
    "disqus",
    "ad",
    "ads",
    "advert",
    "advertisement",
    "sponsor",
    "promo",
    "affiliate",
];

// level one skip to main content link based extraction
export function skipLinksBased(
    $: cheerio.CheerioAPI,
): MainContentCandidate | null {
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
            skipTexts.some((rx) => rx.test(ariaLabel))
        ) {
            if (href.startsWith("#")) {
                const targetId = href.slice(1);
                const targetEl = $(`#${targetId}`);
                if (targetEl.length) {
                    if (targetEl.text().trim().length > 0) {
                        const candidate: MainContentCandidate = {
                            foundBy: "accessibility-skip-link",
                            score: 1.0,
                            id: targetId,
                            // storing entire element HTML here
                            // need to switch to a selector if memory usage is too high
                            element: targetEl.html() || "",
                        };
                        console.log(candidate);
                        return candidate;
                    } else if (targetEl.text().trim().length === 0) {
                        console.log(
                            `Target element with id="${targetId}" has no text content, is a landmark.`,
                        );
                        // add the immediate next sibling for as a candidate
                        const nextSibling = targetEl.next();
                        if (
                            nextSibling.length > 0 &&
                            nextSibling.text().trim().length > 0
                        ) {
                            const candidate: MainContentCandidate = {
                                foundBy: "accessibility-skip-link-next-sibling",
                                score: 0.95,
                                id: targetId,
                                element: nextSibling.html() || "",
                            };
                            console.log(candidate);
                            return candidate;
                        }

                        // collect all siblings after the target element as a candidate
                        const siblings = targetEl.nextAll();
                        if (
                            siblings.length > 0 &&
                            siblings.text().trim().length > 0
                        ) {
                            const candidate: MainContentCandidate = {
                                foundBy:
                                    "accessibility-skip-link-nextAll-siblings",
                                score: 0.95,
                                id: targetId,
                                element: siblings.html() || "",
                            };
                            console.log(candidate);
                            return candidate;
                        }
                    }
                }
            }
        }
    }
    // not found via this method
    return null;
}

// level two semantic HTML based extraction
export function semanticMainCandidatesBased(
    $: cheerio.CheerioAPI,
): MainContentCandidate[] {
    const candidates: MainContentCandidate[] = [];

    // we are collecting all instances of all of the below
    // later on before or after scoring,
    // we can merge them to get the complete content if the content is distributed across them especially for role="main" and id="main"

    // <main> tag
    // should theoritically be only one per page
    $("main").each((_, el) => {
        const id = $(el).attr("id") || "";
        // we only add if there is text content
        if ($(el).text().trim().length > 0) {
            candidates.push({
                foundBy: "<main> tag",
                score: 0.9,
                id,
                element: $(el).html() || "",
            });
        }
    });

    // role="main"
    $('[role="main"]').each((_, el) => {
        const id = $(el).attr("id") || "";
        if ($(el).text().trim().length > 0) {
            candidates.push({
                foundBy: 'role="main"',
                score: 0.8,
                id,
                element: $(el).html() || "",
            });
        }
    });

    // id="main"
    $("#main").each((_, el) => {
        if ($(el).text().trim().length > 0) {
            candidates.push({
                foundBy: 'id="main"',
                score: 0.7,
                id: "main",
                element: $(el).html() || "",
            });
        }
    });

    // id contains main
    $('[id*="main"]').each((_, el) => {
        const id = $(el).attr("id") || "";
        if ($(el).text().trim().length > 0) {
            candidates.push({
                foundBy: 'id contains "main"',
                score: 0.6,
                id,
                element: $(el).html() || "",
            });
        }
    });

    return candidates;
}

// function to use if we resort to using the dom diffed raw html
export function removeSocialCues($: cheerio.CheerioAPI) {
    // Build regexes for each removeList word, matching non-alpha boundaries
    const regexes = removeList.map(
        (word) => new RegExp(`(^|[^a-zA-Z])${word}([^a-zA-Z]|$)`, "i"),
    );

    // Select all elements with class, id, or aria-label attributes
    $("[class], [id], [aria-label]").each((_, el) => {
        const $el = $(el);
        const className = $el.attr("class") || "";
        const id = $el.attr("id") || "";
        const ariaLabel = $el.attr("aria-label") || "";

        // Check each attribute for any removeList word with non-alpha boundaries
        for (const rx of regexes) {
            if (rx.test(className) || rx.test(id) || rx.test(ariaLabel)) {
                $el.remove();
                break;
            }
        }
    });
}

// Runner method that passes in sample HTML DOM
export function extractMainContent() {
    const candidates: MainContentCandidate[] = [];

    const sampleHtml = `
        <html>
            <body>
                <a href="#main" aria-label="Skip to main content">Skip to main content</a>
                <div id="main">
                    <h1>Main Content</h1>
                    <p>This is the main content area.</p>
                </div>
            </body>
        </html>
    `;
    const $ = Cheerio.load(sampleHtml);

    // first tier: accessibility based
    const accessibilityCandidate = skipLinksBased($);
    if (accessibilityCandidate) {
        console.log("Accessibility-based candidate found: ");
        candidates.push(accessibilityCandidate);
    }
    // second tier: semantic HTML based
    const semanticMainCandidate = semanticMainCandidatesBased($);
    if (semanticMainCandidate.length) {
        console.log(
            `Found ${semanticMainCandidate.length} semantic-based candidates: `,
        );
        candidates.push(...semanticMainCandidate);
    }

    console.log("All extracted content candidates: ", candidates);
}

// extractMainContent();
