import { fetchHtmlCached } from "./fetch_html_cached";
import { DomTree } from "./node_utils";

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

async function main(articleUrl: string) {
	const domain = getDomain(articleUrl);
	const homepageUrl = `${domain}/`;
	const notFoundUrl = get404Url(domain);

	console.log("Fetching article:", articleUrl);
	const articleHtml = await fetchHtmlCached(articleUrl);
	console.log("Fetching homepage:", homepageUrl);
	const homepageHtml = await fetchHtmlCached(homepageUrl);
	console.log("Fetching 404 page:", notFoundUrl);
	const notFoundHtml = await fetchHtmlCached(notFoundUrl);

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

	// TODO: Compare DOMs and extract unique content
}

// Usage: bun run src/extract_unique_article.ts <article_url>
if (require.main === module) {
	const url = process.argv[2];
	if (!url) {
		console.error("Usage: bun run src/extract_unique_article.ts <article_url>");
		process.exit(1);
	}
	main(url).catch((err) => {
		console.error(err);
		process.exit(1);
	});
}
