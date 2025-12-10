import { mkdirSync, writeFileSync } from "node:fs";
import * as Cheerio from "cheerio";
import { processArticles } from "./src/dom_diff/dom_diff_module";
import { MainContentExtractor } from "./src/main/gather_main";
import { MainContentScorer } from "./src/main/score_candidates";
import { extractMainContent } from "./src/main_content/main_content_module";
import { htmlToMarkdown } from "./utils/dom_utils";
// await processArticles([
//     // "https://www.nbcnews.com/politics/trump-administration/trump-says-ukraine-expressed-zero-gratitude-us-help-peace-plan-talks-rcna245412",
//     // "https://www.nbcnews.com/business/consumer/shoppers-plan-cut-black-friday-spending-rcna245116",
//     // "https://www.nbcnews.com/politics/trump-administration/treasury-secretary-bessent-us-wont-enter-recession-2026-economy-rcna245411",
//     // "https://www.nbcnews.com/world/asia/china-criticizes-japans-plan-deploy-missiles-island-taiwan-rcna244926",

//     // "https://www.usatoday.com/story/news/nation/2025/11/21/what-considered-professional-degree-explained/87396245007/",
//     // "https://www.usatoday.com/story/news/politics/2025/11/23/tatiana-schlossberg-kennedy-rfk-illness/87436356007/",
//     // "https://www.usatoday.com/story/entertainment/music/2025/11/23/taylor-swift-jumps-joy-chiefs-week-12-colts-dallas-cowboys/86114294007/",
//     // "https://www.usatoday.com/story/life/health-wellness/2025/11/23/baylen-out-loud-tourette-syndrome-interview/87342413007/",

//     // "https://www.bbc.com/news/articles/c8676qpxgnqo",
//     // "https://www.bbc.com/news/articles/cy840l75gx3o",
//     // "https://www.bbc.com/news/articles/cql9lkv5y7zo",

//     // "https://www.npr.org/2025/11/24/nx-s1-5615440/food-mood-mental-health",
//     // "https://www.npr.org/2025/11/24/nx-s1-5615322/future-trucking-driverless-autonomous-trucks",
//     // "https://www.npr.org/2025/11/24/nx-s1-5609336/hemp-thc-drinks-cannabis-marijuana-farm-bill",
//     // "https://www.npr.org/2025/11/24/nx-s1-5611448/thanksgiving-feast-turkey-cost",

//     // "https://www.nytimes.com/2025/11/22/style/luxury-micro-weddings.html",
//     // "https://www.nytimes.com/2025/11/22/business/dealbook/full-body-mri.html",
//     // "https://www.nytimes.com/2025/11/23/world/africa/g20-united-states.html",
//     // "https://www.nytimes.com/2025/11/23/world/europe/ukraine-switzerland-russia-peace-talks.html",

//     "https://finance.yahoo.com/news/live/stock-market-today-dow-sp-500-nasdaq-futures-inch-down-after-techs-biggest-rally-since-may-235115825.html",
//     "https://finance.yahoo.com/news/vibe-coding-startups-face-big-060944385.html",
//     "https://www.yahoo.com/news/articles/volcano-erupts-first-time-12-170053984.html",
//     "https://www.yahoo.com/news/articles/confused-trump-79-mistakenly-amplifies-230321826.html",
//     "https://sports.yahoo.com/articles/chiefs-decision-terminate-wide-receiver-215046550.html",
//     "https://www.benzinga.com/markets/equities/25/11/49049351/nasdaq-jumps-600-points-amid-fed-dovish-signals-fear-greed-index-remains-in-extreme-fear-zone?utm_source=snapi",
//     "https://www.benzinga.com/news/health-care/25/11/49027788/exclusive-enlivex-raises-over-200-million-to-launch-first-public-company-prediction-markets-play",
//     "https://www.benzinga.com/news/entertainment/25/11/49049435/jackie-chan-to-play-changpeng-zhao-in-netflix-feature-heres-what-the-crypto-billionaire-said",
//     "https://www.benzinga.com/analyst-stock-ratings/price-target/25/11/49049330/top-wall-street-forecasters-revamp-best-buy-expectations-ahead-of-q3-earnings",
//     "https://www.benzinga.com/markets/equities/25/11/48980413/whats-going-on-with-bigbear-ai-stock-today",
//     "https://www.benzinga.com/analyst-stock-ratings/analyst-color/25/11/49047581/draftkings-flutter-sell-off-overdone-analyst-says-prediction-markets-provide-5-billion-opportunity",
//     "https://www.reuters.com/world/europe/us-holds-secret-russia-ukraine-peace-talks-abu-dhabi-ft-reports-2025-11-25/",
//     "https://www.reuters.com/world/asia-pacific/taiwan-says-no-information-cooperation-with-south-korea-us-chip-tariffs-2025-11-25/",
//     "https://www.reuters.com/business/apple-cuts-jobs-across-its-sales-organization-bloomberg-news-reports-2025-11-24/",
//     "https://www.reuters.com/business/energy/nigerias-dangote-picks-honeywell-help-fulfill-ambitious-capacity-expansion-2025-11-25/",
//     "https://www.reuters.com/business/retail-consumer/amazon-invest-15-billion-indiana-boost-data-center-infrastructure-2025-11-24/",
//     "https://www.reuters.com/sustainability/boards-policy-regulation/comcast-pay-15-million-us-fine-after-vendor-data-breach-2025-11-24/",
//     "https://www.cnbc.com/2025/11/25/european-markets-on-nov-25-2025-stoxx-600-ftse-dax-cac.html",
//     "https://www.cnbc.com/2025/11/24/amazon-to-spend-up-to-50-billion-on-ai-services-for-us-government.html",
//     "https://www.cnbc.com/2025/11/24/this-26-year-olds-blue-collar-business-brings-in-1point3-million-a-year.html",
//     "https://www.cnbc.com/2025/11/25/trump-xi-taikaichi-call-us-china-japan-beijing-tokyo-spat-taiwan-taipei-pla-jsdf-senkaku-diaoyu.html",
//     "https://www.globenewswire.com/news-release/2025/08/18/3135071/0/en/AEHL-Signs-Strategic-Agreement-with-BitGo-to-Advance-Bitcoin-Acquisition-and-Security.html",
// ]);

const run = () => {
    console.log("Starting main content extraction and scoring...");
    const domDiffOutDir = "dom_diff_out";
    const outputsDir = "outputs_new";
    mkdirSync(outputsDir, { recursive: true });

    const fs = require("node:fs");
    const files = fs
        .readdirSync(domDiffOutDir)
        .filter((f: string) => f.endsWith(".html"));

    for (const fileName of files) {
        console.log(`Processing: ${fileName} `);

        const htmlPath = `dom_diff_out/${fileName}`;
        let html = "";
        try {
            html = require("node:fs").readFileSync(htmlPath, {
                encoding: "utf8",
            });
        } catch (err) {
            console.error(`Could not read HTML file: ${htmlPath}`);
            return null;
        }
        const $: Cheerio.CheerioAPI = Cheerio.load(html);
        const content = new MainContentExtractor(html);
        const candidates = content.getMainContentCandidates();

        const scorer = new MainContentScorer(candidates, $.text().length);
        const finalResult = scorer.getFinalCandidate();

        const baseName = fileName.replace(/\.html$/, "");
        const outHtmlPath = `${outputsDir}/${baseName}.html`;
        writeFileSync(outHtmlPath, finalResult?.element || "", {
            encoding: "utf8",
        });
        const md = htmlToMarkdown(finalResult?.element || "");
        const mdPath = `${outputsDir}/${baseName}.md`;
        writeFileSync(mdPath, md, { encoding: "utf8" });

        // console.log(scorer.getFinalCandidate());
    }
};

run();
