/**
 * dom_diff_module.ts
 *
 * This script fetches an article URL, its homepage, and a 404 page, cleans the HTML,
 * parses the DOMs, and compares them to extract the unique content of the article.
 *
 * The unique content is converted to Markdown using Turndown and saved to unique_article.md.
 *
 * Steps:
 * 1. Download and cache HTML for article, homepage, and 404 page.
 * 2. Remove <script> and <style> tags from HTML.
 * 3. Parse DOMs and collect normalized node labels.
 * 4. Diff article DOM against homepage/404 DOMs to find unique nodes.
 * 5. Convert unique HTML to Markdown and save to file.
 *
 * Usage:
 *   bun run src/dom_diff/dom_diff_module.ts <article_url>
 */

import { writeFileSync } from "node:fs";
import { cleanHtml } from "../../utils/dom_utils";
import { fetchHtmlCached } from "../../utils/fetch_html_cached";
import type { DomNode } from "./dom_diff_utils";
import { DomTree } from "./dom_diff_utils";

function getDomain(url: string): string {
	try {
		const u = new URL(url.startsWith("http") ? url : `https://${url}`);
		return u.origin;
	} catch {
		throw new Error(`Invalid URL: ${url}`);
	}
}

function get404Url(domain: string): string {
	return `${domain}/error_page_hehe`;
}

export async function processArticles(urls: string[]) {
	for (const articleUrl of urls) {
		const domain = getDomain(articleUrl);
		const homepageUrl = `${domain}/`;
		const notFoundUrl = get404Url(domain);

		console.log("Fetching article:", articleUrl);
		const articleHtmlRaw = await fetchHtmlCached(articleUrl);
		console.log("Fetching homepage:", homepageUrl);
		const homepageHtmlRaw = await fetchHtmlCached(homepageUrl);
		console.log("Fetching 404 page:", notFoundUrl);
		const notFoundHtmlRaw = await fetchHtmlCached(notFoundUrl);

		const articleTree = new DomTree(articleHtmlRaw);
		const homepageTree = new DomTree(homepageHtmlRaw);
		const notFoundTree = new DomTree(notFoundHtmlRaw);

		// For now, just print root tags and text lengths
		console.log("Article root tag:", articleTree.root.tag);
		console.log("Homepage root tag:", homepageTree.root.tag);
		console.log("404 root tag:", notFoundTree.root.tag);

		// Collect normalized labels from homepage and 404 DOMs
		function collectLabels(node: DomNode, set: Set<string>) {
			set.add(node.normalizedRepresentation());
			for (const child of node.getchildren()) {
				collectLabels(child, set);
			}
		}

		const homepageLabels = new Set<string>();
		const notFoundLabels = new Set<string>();
		collectLabels(homepageTree.root, homepageLabels);
		collectLabels(notFoundTree.root, notFoundLabels);

		// Traverse article DOM and collect unique nodes
		function collectUniqueHtml(node: DomNode): string[] {
			const label = node.normalizedRepresentation();
			if (homepageLabels.has(label) || notFoundLabels.has(label)) {
				return [];
			}
			// If this node is unique, collect its full HTML (including subtree)
			// Assumes DomNode has a toHtml() method that serializes the node and its subtree
			if (typeof node.toHtml === "function") {
				return [node.toHtml()];
			}
			// Fallback: collect HTML from children
			let results: string[] = [];
			for (const child of node.getchildren()) {
				results = results.concat(collectUniqueHtml(child));
			}
			return results;
		}

		console.log("\n--- Collecting Unique HTML ---\n");
		const uniqueHtmls = collectUniqueHtml(articleTree.root);
		let uniqueHtml = uniqueHtmls.join("<br>\n");
		console.log(`Collected ${uniqueHtmls.length} unique HTML blocks.`);
		uniqueHtml = cleanHtml(uniqueHtml);
		console.log("Cleaned unique HTML.");

		// Convert unique HTML to Markdown
		// const turndownService = new TurndownService();
		// const markdown = turndownService.turndown(uniqueHtml);

		// console.log("\n--- Unique Article Markdown ---\n");
		// console.log(markdown);

		// Save HTML and Markdown to dom_diff_out directory
		// Normalize URL for filename: replace non-alphanumeric with _
		const baseName = articleUrl.replace(/[^a-zA-Z0-9]+/g, "_");
		const htmlPath = `dom_diff_out/${baseName}.html`;
		// const mdPath = `dom_diff_out/${baseName}.md`;
		writeFileSync(htmlPath, uniqueHtml, { encoding: "utf8" });
		// writeFileSync(mdPath, markdown, { encoding: "utf8" });
		console.log(`\nHTML saved to ${htmlPath}`);
		// console.log(`Markdown saved to ${mdPath}`);
	}
}

// Usage:
// import { processArticles } from "./dom_diff_module";
await processArticles([
	"https://www.bankofcanada.ca/2025/07/business-outlook-survey-second-quarter-of-2025/",
	"https://www.bankofcanada.ca/2025/06/the-impact-of-us-trade-policy-on-jobs-and-inflation-in-canada/",
	"https://www.bankofcanada.ca/2025/06/summary-governing-council-deliberations-fixed-announcement-date-of-june-4-2025/",
	"https://www.bankofcanada.ca/2025/06/talking-to-canadians-how-real-world-insights-shape-monetary-policy/",
	"https://www.bankofcanada.ca/2024/12/fad-press-release-2024-12-11/",
	"https://www.bankofcanada.ca/2024/12/opening-statement-2024-12-11/",
	"https://www.bankofcanada.ca/2024/12/bank-canada-publishes-applicants-list-retail-payment-service-providers/",
	"https://www.bankofcanada.ca/publications/mpr/mpr-2024-10-23/",
	"https://www.bankofcanada.ca/2024/10/opening-statement-2024-10-23/",
	"https://www.bankofcanada.ca/2024/09/global-trade-in-a-changing-world/",
	"https://www.bankofcanada.ca/research/fellowship-program/",
	"https://www.bankofcanada.ca/2024/04/fad-press-release-2024-04-10/",
	"https://www.bankofcanada.ca/2022/12/helping-canadians-better-understand-our-decisions/",
	"https://www.bankofcanada.ca/2022/11/opening-statement-231122/",
	"https://www.bankofcanada.ca/2022/11/monitoring-health-canada-financial-system/",
	"https://www.bankofcanada.ca/2022/11/financial-stability-in-times-of-uncertainty/",
	"https://www.bankofcanada.ca/2022/11/opening-remarks-dei2022/",
	"https://www.bankofengland.co.uk/working-paper/2025/the-credit-channel-of-monetary-policy-direct-survey-evidence-from-uk-firms",
	// "https://www.bankofengland.co.uk/weekly-report/2025/23-july-2025",
	"https://www.bankofengland.co.uk/working-paper/2025/a-game-theoretic-foundation-for-the-fiscal-theory-of-the-price-level",
	"https://www.bankofengland.co.uk/macro-technical-paper/2025/a-structural-var-model-for-the-uk-economy",
	"https://www.bankofengland.co.uk/paper/2025/cp/ensuring-the-resilience-of-ccps",
	"https://www.bankofengland.co.uk/financial-stability/financial-market-infrastructure-supervision/what-do-we-do/onboarding-new-fmis",
	"https://www.bankofengland.co.uk/paper/2025/sop/the-boes-approach-to-comparable-compliance-permissions",
	"https://www.bankofengland.co.uk/weekly-report/2025/17-july-2025",
	"https://www.bankofengland.co.uk/report/2025/product-strategy-design-note",
	"https://www.bankofengland.co.uk/annual-report/annual-reports-2025",
	"https://www.bankofengland.co.uk/climate-change/the-bank-of-englands-climate-related-financial-disclosure-2025",
	"https://www.bankofengland.co.uk/sterling-monetary-framework/report-2024-25",
	"https://www.bankofengland.co.uk/alternative-liquidity-facility/2025/alf-annual-report-2024-25",
	"https://www.bankofengland.co.uk/decision-maker-panel/2025/may-2025",
	"https://www.bankofengland.co.uk/weekly-report/2025/19-march-2025",
	"https://www.bankofengland.co.uk/agents-summary/2025/2025-q1",
	"https://www.bankofengland.co.uk/agents-summary/2025/2025-q1/latest-results-from-the-decision-maker-panel-survey-2025-q1",
	"https://www.bankofengland.co.uk/inflation-attitudes-survey/2025/february-2025",
	"https://www.bankofengland.co.uk/weekly-report/2025/12-march-2025",
	"https://www.boj.or.jp/en/research/imes/dps/dps25.htm",
	"https://www.boj.or.jp/en/about/organization/notice/index.htm",
	"https://www.boj.or.jp/en/statistics/boj/other/mei/release/2025/mei250718.xlsx",
	"https://www.boj.or.jp/en/research/research_data/cpi/index.htm",
	"https://www.boj.or.jp/en/research/research_data/reri/index.htm",
	"https://www.boj.or.jp/en/about/press/koen_2025/ko250723a.htm",
	"https://www.boj.or.jp/en/statistics/boj/other/acmai/release/2025/ac250720.htm",
	"https://www.boj.or.jp/en/statistics/bis/repo/index.htm",
	"https://www.boj.or.jp/en/about/release_2025/rel250718a.htm",
	"https://www.boj.or.jp/en/statistics/boj/other/cabs/cabs.xlsx",
	"https://www.boj.or.jp/en/research/brp/ron_2025/ron250716a.htm",
	"https://www.boj.or.jp/en/about/press/koen_2012/ko120422b.htm",
	"https://www.boj.or.jp/en/about/press/koen_2012/ko120422a.htm",
	"https://www.boj.or.jp/en/about/press/koen_2011/ko110601a.htm",
	"https://www.bok.or.kr/eng/bbs/B0000349/view.do?nttId=10092699&searchCnd=1&searchKwd=&depth=400007&pageUnit=10&pageIndex=1&programType=newsDataEng&menuNo=400403&oldMenuNo=400007",
	"https://www.bok.or.kr/eng/bbs/B0000349/view.do?nttId=10091352&searchCnd=1&searchKwd=&date=&sdate=&edate=&sort=1&pageUnit=10&depth=400007&pageIndex=10&programType=newsDataEng&menuNo=400403&oldMenuNo=400007",
	"https://www.bok.or.kr/eng/bbs/B0000354/view.do?nttId=10091341&searchCnd=1&searchKwd=&date=&sdate=&edate=&sort=1&pageUnit=10&depth=400007&pageIndex=10&programType=newsDataEng&menuNo=400409&oldMenuNo=400007",
	"https://www.bok.or.kr/eng/bbs/E0000634/view.do?nttId=10091322&searchCnd=1&searchKwd=&date=&sdate=&edate=&sort=1&pageUnit=10&depth=400007&pageIndex=10&programType=newsDataEng&menuNo=400423&oldMenuNo=400007",
	"https://www.cbc.gov.tw/en/cp-448-182820-66569-2.html",
	"https://www.cbc.gov.tw/en/cp-448-182815-533b1-2.html",
	"https://www.cbc.gov.tw/en/cp-449-42217-CDA67-2.html",
	"https://www.ecb.europa.eu/press/inter/date/2025/html/ecb.in250726~89d25a9d7f.en.html",
	"https://www.ecb.europa.eu/press/govcdec/otherdec/2025/html/ecb.gc250725~7913f7a897.en.html",
	"https://www.ecb.europa.eu/press/blog/date/2025/html/ecb.blog20250725~f26b4ef0f3.en.html",
	"https://www.ecb.europa.eu/press/stats/ffi/html/ecb.eaefd_full2025q1~01d6c6e0e3.en.html",
	"https://www.ecb.europa.eu/press/pr/date/2025/html/ecb.pr250725_2~6509f4f965.en.html",
	"https://www.ecb.europa.eu/press/pr/date/2025/html/ecb.pr250725~2c8aaa2009.en.html",
	"https://www.ecb.europa.eu/stats/ecb_surveys/survey_of_professional_forecasters/html/index.en.html",
	"https://www.ecb.europa.eu/press/pr/date/2025/html/ecb.pr250701_1~9439e5095b.en.html",
	"https://www.ecb.europa.eu/press/pr/date/2025/html/ecb.pr250701~f4a98dd9dc.en.html",
	"https://www.ecb.europa.eu/press/pubbydate/2025/html/ecb.exploratoryworknewtechnologies202506.en.html",
	"https://www.ecb.europa.eu/press/key/date/2025/html/ecb.sp250630_1~ba0ef03e6f.en.html",
	"https://www.ecb.europa.eu/mopo/strategy/strategy-review/ecb.strategyreview202506_strategy_statement.en.html",
	"https://www.federalreserve.gov/newsevents/pressreleases/bcreg20250721a.htm",
	"https://www.federalreserve.gov/newsevents/pressreleases/bcreg20250716a.htm",
	"https://www.federalreserve.gov/newsevents/pressreleases/bcreg20250424a.htm",
	"https://www.philadelphiafed.org/about-us/250417-philadelphia-fed-names-anna-paulson-as-next-president-and-ceo",
	"https://www.federalreserve.gov/newsevents/pressreleases/orders20250416a.htm",
	"https://www.federalreserve.gov/aboutthefed/fedexplained/who-we-are.htm",
	"https://www.federalreserve.gov/aboutthefed/the-fed-explained.htm",
	"https://www.federalreserve.gov/aboutthefed/directors/about.htm",
	"https://www.federalreserve.gov/aboutthefed/fract.htm",
	"https://www.federalreserve.gov/aboutthefed/currency.htm",
	"https://www.federalreserve.gov/aboutthefed/boardmeetings/meetingdates.htm",
	"https://www.federalreserve.gov/aboutthefed/financial-innovation.htm",
	"https://www.federalreserve.gov/photogallery.htm",
	"https://www.federalreserve.gov/conferences.htm",
	"https://www.federalreserve.gov/monetarypolicy/publications/mpr_default.htm",
	"https://www.federalreserve.gov/monetarypolicy/fomc.htm",
	"https://www.federalreserve.gov/monetarypolicy/fomc.htm",
	"https://www.federalreserve.gov/publications/supervision-and-regulation-report.htm",
	"https://www.federalreserve.gov/supervisionreg/novel-activities-supervision-program.htm",
	"https://www.federalreserve.gov/supervisionreg/novel-activities-supervision-program.htm",
	"https://www.federalreserve.gov/publications/supervision-and-regulation-report.htm",
	"https://www.federalreserve.gov/apps/reportingforms",
	"https://www.federalreserve.gov/apps/reportingforms/recentupdates",
	"https://www.federalreserve.gov/paymentsystems/reports.htm",
	"https://www.federalreserve.gov/paymentsystems/regcc-about.htm",
	"https://www.federalreserve.gov/paymentsystems/regcc-about.htm",
	"https://www.federalreserve.gov/newsevents/speech/powell20250722a.htm",
	"https://www.federalreserve.gov/newsevents/speech/waller20250717a.htm",
	"https://www.federalreserve.gov/newsevents/speech/cook20250717a.htm",
	"https://www.federalreserve.gov/newsevents/testimony/powell20250211a.htm",
	"https://www.federalreserve.gov/newsevents/testimony/barr20241120a.htm",
	"https://www.federalreserve.gov/newsevents/testimony/powell20240709a.htm",
	// // "https://www.imf.org/en/Publications/WEO/Issues/2025/07/29/world-economic-outlook-update-july-2025",
	// // "https://www.imf.org/en/Publications/WP/Issues/2025/07/25/Money-Market-Fund-Growth-During-Hiking-Cycles-A-Global-Analysis-568763",
	// // "https://www.imf.org/en/Publications/WP/Issues/2025/07/25/Building-Macroeconomic-Resilience-to-Natural-Disasters-and-Persistent-Temperature-Changes-568891",
	// // "https://www.imf.org/en/Publications/Policy-Papers/Issues/2025/07/25/OIA-Second-Progress-Assessment-of-The-Implementation-of-The-Recommendations-of-The-569023",
	// // "https://www.imf.org/en/Publications/CR/Issues/2025/07/25/Euro-Area-Publication-of-Financial-Sector-Assessment-Program-Documentation-Technical-Note-568948",
	// // "https://www.imf.org/en/Publications/selected-issues-papers/Issues/2025/07/24/Strengthening-Resilience-in-Kiribati-with-Public-Investment-Kiribati-568927",
	// // "https://www.imf.org/en/Publications/CR/Issues/2025/07/24/United-Kingdom-Selected-Issues-568908",
	// // "https://www.imf.org/en/Publications/CR/Issues/2025/07/24/United-Kingdom-2025-Article-IV-Consultation-Press-Release-Staff-Report-and-Statement-by-the-568905",
	// // "https://www.imf.org/en/Publications/selected-issues-papers/Issues/2025/07/24/Revisiting-Fiscal-Multipliers-for-Estonia-Republic-of-Estonia-568899",
	// // "https://www.imf.org/en/Publications/selected-issues-papers/Issues/2025/07/24/Allocative-Efficiency-Firm-Dynamics-and-Productivity-in-the-Baltics-Republic-of-Estonia-568921",
	// // "https://www.imf.org/-/media/Files/Publications/ESR/2025/English/Boardsummary.ashx",
	// // "https://www.imf.org/-/media/Files/Publications/ESR/2025/English/ch2annex.ashx",
	// // "https://www.imf.org/en/Publications/ESR/Issues/2025/07/22/external-sector-report-2025",
	// // "https://www.imf.org/en/Publications/CR/Issues/2025/07/21/Italy-2025-Article-IV-Consultation-Press-Release-Staff-Report-and-Statement-by-the-568826",
	// // "https://www.imf.org/en/Publications/WP/Issues/2025/07/11/Decrypting-Crypto-How-to-Estimate-International-Stablecoin-Flows-568260",
	// // "https://www.imf.org/en/Publications/selected-issues-papers/Issues/2025/07/11/Namibia-Labor-Markets-and-Resource-Dependence-568536",
	// // "https://www.imf.org/en/Publications/selected-issues-papers/Issues/2025/07/12/Energy-Subsidy-Reform-in-Libya-568564",
	// // "https://www.imf.org/en/Publications/technical-assistance-reports/Issues/2025/07/09/The-Bahamas-Technical-Assistance-Report-Report-on-External-Sector-Statistics-Virtual-568407",
	// // "https://www.imf.org/en/Publications/Books/Issues/2025/07/07/Africa-China-Linkages-Building-Deeper-and-Broader-Connections-531612",
	// // "https://www.imf.org/en/News/Articles/2025/07/25/pr-25267-equatorial-guinea-imf-concl-aiv-consult-approves-1st-and-2nd-rev-under-program",
	"https://www.rba.gov.au/monetary-policy/rba-board-minutes/2024/2024-12-10.html",
	"https://www.rba.gov.au/publications/workshops/research/2024/",
	"https://www.rba.gov.au/statistics/frequency/fin-agg/2024/fin-agg-1124.html",
	"https://www.rba.gov.au/media-releases/2024/mr-24-28.html",
	"https://www.rba.gov.au/speeches/2024/sp-ag-2024-12-13.html",
	"https://www.rba.gov.au/speeches/2024/sp-ag-2024-12-12.html",
	"https://www.rba.gov.au/publications/rdp/2024/2024-10.html",
	"https://www.rba.gov.au/speeches/2024/mc-gov-2024-12-10.html",
	"https://www.rba.gov.au/media-releases/2024/mr-24-27.html",
	"https://www.cfr.gov.au/news/2024/mr-24-06.html",
	"https://www.rba.gov.au/statistics/frequency/commodity-prices/2024/icp-1124.html",
	"https://www.rba.gov.au/speeches/2024/sp-so-2024-12-02.html",
	"https://www.rba.gov.au/statistics/frequency/fin-agg/2024/fin-agg-1024.html",
	"https://www.rba.gov.au/speeches/2024/sp-gov-2024-11-28.html",
	"https://www.rba.gov.au/media-releases/2024/mr-24-25.html",
	"https://www.rba.gov.au/speeches/2024/mc-gov-2024-11-05.html",
	"https://www.rba.gov.au/media-releases/2024/mr-24-24.html",
	"https://www.rba.gov.au/statistics/frequency/commodity-prices/2024/icp-1024.html",
	"https://www.rba.gov.au/media-releases/2024/mr-24-23.html",
	"https://www.rba.gov.au/statistics/frequency/fin-agg/2024/fin-agg-0924.html",
	"https://www.rba.gov.au/media-releases/2024/mr-24-22.html",
	"https://www.rba.gov.au/speeches/2024/sp-ag-2024-10-10-video.html",
	"https://www.rba.gov.au/statistics/frequency/commodity-prices/2024/icp-0924.html",
	"https://www.rba.gov.au/statistics/frequency/fin-agg/2024/fin-agg-0824.html",
	"https://www.rba.gov.au/statistics/frequency/fin-agg/2024/fin-agg-0724.html",
	// "https://www.resbank.co.za/en/home/publications/publication-detail-pages/share-price-and-availability/2025/Share-Price-and-Availability",
	// "https://www.resbank.co.za/en/home/publications/publication-detail-pages/prudential-authority/pa-insurers/pa-post-insurance/act-notices/2025/notice-licensing-micro-insurer-venlife-ltd",
	// "https://www.resbank.co.za/en/home/publications/publication-detail-pages/media-releases/2025/steinhoff-investigation",
	// "https://www.resbank.co.za/en/home/publications/publication-detail-pages/prudential-authority/pa-public-awareness/Communication/2025/Prudential-Communication-9-of-2025",
	// "https://www.resbank.co.za/en/home/publications/publication-detail-pages/Financial-Markets/Committees/SAFXC/SAFXC-Record-of-proceedings/2025/record-of-proceedings-south-african-foreign-exchange-committee-march2025",
	// "https://www.resbank.co.za/en/home/publications/publication-detail-pages/Financial-Markets/Committees/SAFXC/SAFXC-Agenda/2025/south-african-foreign-exchange-committee-agenda-june-2025",
	// "https://www.resbank.co.za/en/home/publications/publication-detail-pages/prudential-authority/pa-documents-issued-for-consultation/2025/proposed-directive-returns-1-July-2025",
	// "https://www.resbank.co.za/en/home/publications/publication-detail-pages/prudential-authority/pa-documents-issued-for-consultation/2025/proposed-directive-returns",
	// "https://www.resbank.co.za/en/home/publications/publication-detail-pages/rfp/rfp-4974197---digital-learning-content",
	// "https://www.resbank.co.za/en/home/publications/publication-detail-pages/working-papers/2025/state-dependence-of-the-phillips-curve--what-does-this-mean-for-",
	// "https://www.resbank.co.za/en/home/publications/publication-detail-pages/prudential-authority/pa-deposit-takers/banks-directives/2025/D2-2025",
	// "https://www.resbank.co.za/en/home/publications/publication-detail-pages/rfp/rfp-4975228--mainframe-and-storage-managed-support",
	// "https://www.resbank.co.za/en/home/publications/publication-detail-pages/rfp/eoi-4975217--market-research-platform",
	// "https://www.resbank.co.za/en/home/publications/publication-detail-pages/Financial-Markets/markets-data/Gold-and-Foreign-Exchange-Position/2025/gold-and-foreign-exchange-position-may-2025",
	// "https://www.resbank.co.za/en/home/publications/publication-detail-pages/statements/assets-and-liabilities/2025/statement-of-assets-and-liabilities-may-2025",
	// "https://www.resbank.co.za/en/home/publications/publication-detail-pages/monthly-releases/monthly-release-of-selected-data/2025/MonthlyReleaseofSelectedDataNo435May2025",
	// "https://www.resbank.co.za/en/home/publications/publication-detail-pages/international-reserves-template/2025/international-reserves-template---april-2025",
	// "https://www.resbank.co.za/en/home/publications/publication-detail-pages/working-papers/2025/less-risk-more-reward",
	// "https://www.resbank.co.za/en/home/publications/publication-detail-pages/other-publications/2025/biennial-summary",
	// "https://www.resbank.co.za/en/home/publications/publication-detail-pages/statements/monetary-policy-statements/2025/may",
	// "https://www.resbank.co.za/en/home/publications/publication-detail-pages/bursary/2025/data-science-machine-learning-2026",
	// "https://www.resbank.co.za/en/home/publications/publication-detail-pages/bursary/2025/art-scholarship-2026",
	"http://www.worldbank.org/en/news/press-release/2025/07/25/boosting-growth-with-inclusive-financial-development-crucial-to-unlock-angola-s-poverty-alleviation-efforts",
	"http://www.worldbank.org/en/country/angola/publication/angola-economic-update-boosting-growth-with-inclusive-financial-development",
	"http://www.worldbank.org/en/news/press-release/2025/07/25/world-bank-vice-president-visits-pakistan-reaffirms-continued-support",
	"http://www.worldbank.org/en/country/vietnam/publication/viet-nam-2045-growing-greener-pathways-to-a-resilient-and-sustainable-future",
	"http://www.worldbank.org/en/news/speech/2025/07/21/remarks-by-anna-bjerde-world-bank-managing-director-of-operations-at-the-pacific-islands-forum-forum-economic-ministers-",
	"http://www.worldbank.org/en/news/feature/2025/07/21/runway-to-resilience-how-long-term-commitment-local-leadership-and-engineering-innovation-kept-tuvalu-connected-to-the-w",
	"http://www.worldbank.org/en/news/press-release/2025/07/21/equatorial-guinea-economic-update-managing-equatorial-guinea-wealth-for-sustainable-growth-and-development",
	"http://www.worldbank.org/en/results/2025/07/18/azerbaijan-modernizing-the-judiciary-for-better-access-transparency-and-efficiency",
	"http://www.worldbank.org/en/data/interactive/2020/03/01/tokyo-drm-hub-south-asia",
	"http://www.worldbank.org/en/data/interactive/2020/03/01/tokyo-drm-hub-mena",
	"http://www.worldbank.org/en/topic/transport/brief/closing-gender-gaps-in-transport",
	"http://www.worldbank.org/en/executive-directors/eds13/brief/visit-in-sal-island-cabo-verde-of-harold-tavares-executive-director",
	"http://www.worldbank.org/en/topic/water/publication/scaling-water-reuse",
	"http://www.worldbank.org/en/news/feature/2025/07/14/new-roads-boost-jobs-connectivity-and-growth-in-bosnia-and-herzegovina",
	"http://www.worldbank.org/en/news/press-release/2025/07/12/world-bank-vice-president-for-south-asia-region-to-visit-bangladesh",
	"http://www.worldbank.org/en/news/press-release/2025/07/11/c-te-d-ivoire-moves-to-formalize-its-vast-informal-gold-mining-sector",
	"http://www.worldbank.org/en/news/press-release/2025/07/11/world-bank-returns-to-the-new-zealand-dollar-market-with-a-successful-nzd-600-million-7-year-benchmark-bond",
	"http://www.worldbank.org/en/news/press-release/2025/07/11/new-world-bank-project-to-support-children-with-disabilities-in-djibouti",
]);
