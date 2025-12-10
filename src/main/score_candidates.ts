import * as Cheerio from "cheerio";

interface MainContentCandidate {
    foundBy: string;
    score: number;
    id: string;
    element: string;
}

// Scoring functions
const textLengthScore = (
    textLength: number,
    totalTextLength: number,
): number => {
    if (totalTextLength === 0) return 0;
    return Math.min(textLength / totalTextLength, 1);
};

const dataAttributeBonus = ($: Cheerio.CheerioAPI): number => {
    const attribs = $.root()?.attr || {};
    return Object.keys(attribs).some((k) => k.startsWith("data-")) ? 10 : 0;
};

const calculateSemanticScore = ($: Cheerio.CheerioAPI): number => {
    let score = 0;
    const h1Count = $("h1").length;
    if (h1Count > 0) score += 10;
    const h2Count = $("h2").length;
    const h3Count = $("h3").length;
    const subheadingCount = h2Count + h3Count;
    score += Math.min(subheadingCount * 5, 15);

    const ulCount = $("ul").length;
    const olCount = $("ol").length;
    const listCount = ulCount + olCount;
    if (listCount > 0) score += 5;
    if (listCount > 10) score -= 15;

    const imgCount = $("img").length;
    if (imgCount === 0) score -= 5;
    else if (imgCount >= 1 && imgCount <= 5) score += 10;
    else if (imgCount > 10) score -= 10;

    const totalText = $.root().text().replace(/\s+/g, "");
    const linkText = $("a").text().replace(/\s+/g, "");
    let linkDensity = 0;
    if (totalText.length > 0) {
        linkDensity = linkText.length / totalText.length;
        if (linkDensity < 0.1) score += 15;
        else if (linkDensity >= 0.1 && linkDensity <= 0.3) score += 5;
        else if (linkDensity > 0.5) score -= 20;
    }
    return score;
};

const punctuationScore = ($: Cheerio.CheerioAPI): number => {
    const text = $.root().text();
    const punctuationRegex = /[.,;:!?'"“”‘’()\-–—…]/g;
    const matches = text.match(punctuationRegex);
    const count = matches ? matches.length : 0;

    if (count >= 5) return 5;
    else if (count === 0) return -5;
    return 0;
};

// Class wrapper
export class MainContentScorer {
    private candidates: MainContentCandidate[];
    private totalTextLength: number;

    constructor(candidates: MainContentCandidate[], totalTextLength: number) {
        this.candidates = candidates;
        this.totalTextLength = totalTextLength;
    }

    public getFinalCandidate(): MainContentCandidate | null {
        let bestCandidate: MainContentCandidate | null = null;
        let bestScore = -Infinity;

        for (const candidate of this.candidates) {
            // Load element HTML into Cheerio for scoring
            const $ = Cheerio.load(candidate.element);
            // Calculate scores
            const textLen = $.root().text().length;
            let score = candidate.score;

            score += textLengthScore(textLen, this.totalTextLength);
            score += dataAttributeBonus($);
            score += calculateSemanticScore($);
            score += punctuationScore($);

            if (score > bestScore) {
                bestScore = score;
                bestCandidate = { ...candidate, score };
            }
        }
        console.log(bestCandidate);
        return bestCandidate;
    }
}
