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
import TurndownService from "turndown";
import { stripScriptAndStyleTags } from "../../utils/dom_utils";
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

        // Preliminary clean: remove <script> and <style> tags
        const articleHtml = stripScriptAndStyleTags(articleHtmlRaw);
        const homepageHtml = stripScriptAndStyleTags(homepageHtmlRaw);
        const notFoundHtml = stripScriptAndStyleTags(notFoundHtmlRaw);

        const articleTree = new DomTree(articleHtml);
        const homepageTree = new DomTree(homepageHtml);
        const notFoundTree = new DomTree(notFoundHtml);

        // For now, just print root tags and text lengths
        console.log(
            "Article root tag:",
            articleTree.root.tag,
            "text length:",
            articleTree.root.extractText().length,
        );
        console.log(
            "Homepage root tag:",
            homepageTree.root.tag,
            "text length:",
            homepageTree.root.extractText().length,
        );
        console.log(
            "404 root tag:",
            notFoundTree.root.tag,
            "text length:",
            notFoundTree.root.extractText().length,
        );

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

        const uniqueHtmls = collectUniqueHtml(articleTree.root);
        const uniqueHtml = uniqueHtmls.join("<br>\n");

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
// await processArticles([
// 	"https://www.bankofcanada.ca/publications/annual-reports-quarterly-financial-reports/?content_type[]=628&content_type[]=22322",
// ]);
