import * as cheerio from "cheerio";
import { extractMainContentRobust } from "./src/main_content/main_content_utils.ts";

// Test HTML with various content structures
const testHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Test Page</title>
    <link rel="stylesheet" href="style.css">
    <script src="script.js"></script>
</head>
<body>
    <header>
        <nav>Navigation menu</nav>
    </header>

    <main id="main-content">
        <h1>Main Article Title</h1>
        <p>This is the main content of the page.</p>
        <p>It contains multiple paragraphs and should be detected as the primary content.</p>
        <ul>
            <li>List item 1</li>
            <li>List item 2</li>
        </ul>
        <p>More content here with some important information.</p>
    </main>

    <aside class="sidebar">
        <h3>Related Links</h3>
        <p>Some sidebar content</p>
    </aside>

    <footer>
        <p>Copyright 2025</p>
    </footer>
</body>
</html>
`;

const testHtml2 = `
<!DOCTYPE html>
<html>
<head><title>Test Page 2</title></head>
<body>
    <div class="header">Header content</div>

    <div id="content" class="main-content">
        <article>
            <h1>Article Title</h1>
            <p>This article has substantial content that should be detected.</p>
            <p>Multiple paragraphs make this a good candidate for main content.</p>
            <p>The scoring system should favor this over smaller elements.</p>
            <h2>Subsection</h2>
            <p>More detailed content under a heading.</p>
        </article>
    </div>

    <div class="footer">Footer content</div>
</body>
</html>
`;

const testHtml3 = `
<!DOCTYPE html>
<html>
<head><title>Test Page 3 - Skip Links</title></head>
<body>
    <a href="#main">Skip to main content</a>

    <header>Header</header>

    <div id="main" class="content-area">
        <h1>Content with Skip Link</h1>
        <p>This content is linked via a skip-to-content link.</p>
        <p>The function should detect this through the accessibility link.</p>
    </div>

    <footer>Footer</footer>
</body>
</html>
`;

function testExtraction(html: string, testName: string) {
	console.log(`\n=== ${testName} ===`);
	const $ = cheerio.load(html);
	const result = extractMainContentRobust($);

	if (result) {
		console.log(`✅ Found content: ${result.label}`);
		console.log(`📏 Full HTML length: ${result.html.length} chars`);

		// Show the structure (first 500 chars to see DOCTYPE, head, etc.)
		const preview = result.html.substring(0, 500);
		console.log(
			`📄 HTML Preview:\n${preview}${result.html.length > 500 ? "..." : ""}`,
		);

		// Check if head content is preserved
		const hasMeta = result.html.includes("<meta");
		const hasLink = result.html.includes("<link");
		const hasTitle = result.html.includes("<title>");
		console.log(
			`🗂️  Head preserved: Meta:${hasMeta} Link:${hasLink} Title:${hasTitle}`,
		);
	} else {
		console.log(`❌ No content found`);
	}
}
console.log("🧪 Testing extractMainContentRobust function");

// Test different HTML structures
testExtraction(testHtml, "Test 1: Main tag");
testExtraction(testHtml2, "Test 2: Content class/ID");
testExtraction(testHtml3, "Test 3: Skip links");

console.log("\n🎉 Testing complete!");
