import type * as cheerio from "cheerio";
import * as Cheerio from "cheerio";
import {
    cleanHtmlPreDom,
    removeBreadcrumbs,
    removeEmptyTags,
    removeNavTags,
} from "../../utils/dom_utils";

interface MainContentCandidate {
    foundBy: string;
    score: number;
    id: string;
    element: string;
}

// List of words indicating social media elements to be removed
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

export class MainContentExtractor {
    private $: cheerio.CheerioAPI;

    constructor(domString: string) {
        this.$ = Cheerio.load(domString);
    }

    private skipLinksBased($: cheerio.CheerioAPI): MainContentCandidate[] {
        const candidates: MainContentCandidate[] = [];
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
                                element: targetEl.html() || "",
                            };
                            candidates.push(candidate);
                        } else if (targetEl.text().trim().length === 0) {
                            // instances where the target element was used as a landmark
                            // returning the next sibling as candidate
                            const nextSibling = targetEl.next();
                            if (
                                nextSibling.length > 0 &&
                                nextSibling.text().trim().length > 0
                            ) {
                                const candidate: MainContentCandidate = {
                                    foundBy:
                                        "accessibility-skip-link-next-sibling",
                                    score: 0.95,
                                    id: targetId,
                                    element: nextSibling.html() || "",
                                };
                                candidates.push(candidate);
                            }
                            // returning all siblings after the target element as candidates
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
                                candidates.push(candidate);
                            }
                        }
                    }
                }
            }
        }
        return candidates;
    }

    private semanticCuesBased($: cheerio.CheerioAPI): MainContentCandidate[] {
        const candidates: MainContentCandidate[] = [];
        $("main").each((_, el) => {
            const id = $(el).attr("id") || "";
            if ($(el).text().trim().length > 0) {
                candidates.push({
                    foundBy: "<main> tag",
                    score: 0.9,
                    id,
                    element: $(el).html() || "",
                });
            }
        });
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

    // method to try and remove social media related elements, move the dom diff/utils later
    private removeSocialCues($: cheerio.CheerioAPI) {
        const regexes = removeList.map(
            (word) => new RegExp(`(^|[^a-zA-Z])${word}([^a-zA-Z]|$)`, "i"),
        );
        $("[class], [id], [aria-label]").each((_, el) => {
            const $el = $(el);
            const className = $el.attr("class") || "";
            const id = $el.attr("id") || "";
            const ariaLabel = $el.attr("aria-label") || "";
            for (const rx of regexes) {
                if (rx.test(className) || rx.test(id) || rx.test(ariaLabel)) {
                    $el.remove();
                    break;
                }
            }
        });
    }

    public getMainContentCandidates(): MainContentCandidate[] {
        const candidates: MainContentCandidate[] = [];
        // First tier: accessibility based
        const accessibilityCandidates = this.skipLinksBased(this.$);
        if (accessibilityCandidates) {
            candidates.push(...accessibilityCandidates);
        }
        // Second tier: semantic HTML based
        const semanticMainCandidate = this.semanticCuesBased(this.$);
        if (semanticMainCandidate.length) {
            candidates.push(...semanticMainCandidate);
        }

        // Fallback whole dom-diffed DOM
        this.removeSocialCues(this.$);
        let domString = this.$.html();
        domString = cleanHtmlPreDom(domString);
        domString = removeBreadcrumbs(domString);
        domString = removeNavTags(domString);
        domString = removeEmptyTags(domString);
        const fallbackDom: MainContentCandidate = {
            foundBy: "fallback-dom-diffed",
            score: 0.5,
            id: "fallback",
            element: domString || "",
        };
        candidates.push(fallbackDom);
        console.log(`>>> found = ${candidates.length} candidates`);
        for (const cand of candidates) {
            console.log(`>>> ${cand.foundBy}`);
        }
        return candidates;
    }
}
