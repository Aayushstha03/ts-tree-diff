import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const RAW_CACHE_DIR = "raw_cache";
mkdirSync(RAW_CACHE_DIR, { recursive: true });

function getCachePath(url: string): string {
	const h = createHash("md5").update(url, "utf8").digest("hex");
	return `${RAW_CACHE_DIR}/${h}.html`;
}

async function fetchRawHtml(url: string): Promise<string> {
	const headers = {
		"User-Agent":
			"Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
			"AppleWebKit/537.36 (KHTML, like Gecko) " +
			"Chrome/122.0.0.0 Safari/537.36",
		"Accept-Language": "en-US,en;q=0.9",
		Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
		Connection: "keep-alive",
	};
	const resp = await fetch(url, { headers, redirect: "follow" });
	if (!resp.ok) {
		console.warn(`Warning: HTTP status ${resp.status} for ${url}`);
		// Continue to return the body for 404 or other errors
	}
	// Always decode as UTF-8
	const buf = await resp.arrayBuffer();
	return Buffer.from(buf).toString("utf8");
}

export async function fetchHtmlCached(url: string): Promise<string> {
	const cachePath = getCachePath(url);
	if (existsSync(cachePath) && readFileSync(cachePath).length > 0) {
		console.log("using cached file for url:", url);
		return readFileSync(cachePath, { encoding: "utf8" });
	} else {
		console.log("fetching url:", url);
		const htmlText = await fetchRawHtml(url);
		writeFileSync(cachePath, htmlText, { encoding: "utf8" });
		return htmlText;
	}
}

// Example usage:
(async () => {
	const html = await fetchHtmlCached("https://www.bbc.com/");
	console.log(html.slice(0, 500));
})();
