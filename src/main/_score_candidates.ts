import type { Cheerio } from "cheerio";
import type { Element } from "domhandler";

/**
 * Score a content candidate based on heuristics
 */
export const scoreCandidate = (el: Cheerio<Element>): number => {
    let score = 0;
    const text = el.text().trim();
    const textLength = text.length;

    // Heavier weight for text length
    score += textLengthScore(textLength);

    // Bonus for images and videos
    score += mediaScore(el);

    // Penalize if too many links
    score += linkPenalty(el);

    // Bonus for data-* attributes
    score += dataAttributeBonus(el);

    // Use original semantic, keyword, and tag bonuses/penalties if desired
    score += calculateSemanticScore(el);
    score += calculateKeywordScore(el);
    score += calculateStructuralPenalties(el);
    score += calculateLengthPenalty(textLength);
    score += calculateTagBonus(el);    return Math.max(0, score);
};

// Scoring functions

const textLengthScore = (textLength: number, totalTextLength: number): number => {
    // Normalize the score: ratio of this element's text length to total text length in DOM, scale 0-1
    if (totalTextLength === 0) return 0;
    return Math.min(textLength / totalTextLength, 1);
};

const mediaScore = (el: Cheerio<Element>): number => {
    // Bonus for images and videos
    const imgCount = el.find("img").length;
    const videoCount = el.find("video").length;
    return imgCount * 5 + videoCount * 10;
};

const dataAttributeBonus = (el: Cheerio<Element>): number => {
    // Bonus if element has any data-* attributes
    const attribs = (el[0]?.attribs) || {};
    return Object.keys(attribs).some((k) => k.startsWith("data-")) ? 10 : 0;
};

const calculateSemanticScore = (el: Cheerio<Element>): number => {
    let score = 0;

    // Heading Hierarchy Score
    const h1Count = el.find("h1").length;
    if (h1Count > 0) {
        score += 10; // Has H1
    }
    const h2Count = el.find("h2").length;
    const h3Count = el.find("h3").length;
    const subheadingCount = h2Count + h3Count;
    score += Math.min(subheadingCount * 5, 15); // H2/H3 subheadings, max +15

    // List Presence Score
    const ulCount = el.find("ul").length;
    const olCount = el.find("ol").length;
    const listCount = ulCount + olCount;
    if (listCount > 0) {
        score += 5; // Has <ul> or <ol>
    }
    if (listCount > 10) {
        score -= 15; // Too many lists, likely navigation
    }

    // Image-Text Balance
    const imgCount = el.find("img").length;
    if (imgCount === 0) {
        score -= 5; // No images, unusual for good content
    } else if (imgCount >= 1 && imgCount <= 5) {
        score += 10; // 1-5 images
    } else if (imgCount > 10) {
        score -= 10; // Too many images, likely gallery
    }

// Link Density Penalty
    const totalText = el.text().replace(/\s+/g, "");
    const linkText = el.find("a").text().replace(/\s+/g, "");
    let linkDensity = 0;
    if (totalText.length > 0) {
        linkDensity = linkText.length / totalText.length;
        if (linkDensity < 0.1) {
            score += 15; // Excellent
        } else if (linkDensity >= 0.1 && linkDensity <= 0.3) {
            score += 5; // Okay
        } else if (linkDensity > 0.5) {
            score -= 20; // Terrible
        }
    }
    return score;
};


const punctuationScore = (text: string): number => {
    // Count punctuation marks: . , ; : ! ? " ' ( ) [ ] { } - – — … etc.
    const punctuationRegex = /[.,;:!?'"“”‘’()\[\]{}\-–—…]/g;
    const matches = text.match(punctuationRegex);
    const count = matches ? matches.length : 0;

    if (count >= 5) {
        return 5; // Flat +5 if 5 or more punctuation marks
    } else if (count === 0) {
        return -5; // Flat -5 if none
    }
    return 0; // No adjustment otherwise
};
