import * as cheerio from "cheerio";
import * as fs from "fs";
import * as path from "path";
import { extractMainContentRobust } from "./src/main_content/main_content_utils.ts";

const INPUT_DIR = "./dom_diff_out";
const OUTPUT_DIR = "./cleaned_content";

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
	fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

function processHtmlFile(filePath: string): void {
	try {
		// Read the HTML file
		const htmlContent = fs.readFileSync(filePath, "utf-8");

		// Parse with Cheerio
		const $ = cheerio.load(htmlContent);

		// Extract main content
		const result = extractMainContentRobust($);

		if (result) {
			// Get filename for output
			const fileName = path.basename(filePath);
			const outputPath = path.join(OUTPUT_DIR, fileName);

			// Write cleaned HTML
			fs.writeFileSync(outputPath, result.html, "utf-8");

			console.log(`✅ Processed: ${fileName}`);
			console.log(`   Method: ${result.label}`);
			console.log(`   Output size: ${result.html.length} chars`);
		} else {
			console.log(`❌ Failed to extract content: ${path.basename(filePath)}`);
		}
	} catch (error) {
		console.error(`💥 Error processing ${filePath}:`, error);
	}
}

function main() {
	console.log("🧹 Starting HTML content cleaning process...");
	console.log(`📁 Input directory: ${INPUT_DIR}`);
	console.log(`📁 Output directory: ${OUTPUT_DIR}`);
	console.log("");

	// Get all HTML files from input directory
	const files = fs
		.readdirSync(INPUT_DIR)
		.filter((file) => file.endsWith(".html"))
		.map((file) => path.join(INPUT_DIR, file));

	console.log(`📋 Found ${files.length} HTML files to process\n`);

	let successCount = 0;
	let failCount = 0;

	// Process each file
	for (const filePath of files) {
		try {
			processHtmlFile(filePath);
			successCount++;
		} catch (error) {
			console.error(`💥 Failed to process ${path.basename(filePath)}:`, error);
			failCount++;
		}
	}

	console.log("\n🎉 Processing complete!");
	console.log(`✅ Successfully processed: ${successCount} files`);
	console.log(`❌ Failed: ${failCount} files`);
	console.log(`📁 Cleaned files saved to: ${OUTPUT_DIR}`);
}

main();
