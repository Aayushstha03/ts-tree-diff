import * as cheerio from "cheerio";

// Test HTML with nested empty divs
const html = `<div>
<div>
<div>
helo
</div>
</div>
</div>`;

console.log("Original HTML:");
console.log(html);
console.log("\nAfter removeEmptyTags:");

// Simulate the removeEmptyTags logic
const $ = cheerio.load(html);

function hasValuableAttributes(el: cheerio.Cheerio<any>): boolean {
	const valuableAttrs = [
		"value",
		"datetime",
		"content",
		"href",
		"src",
		"alt",
		"title",
		"class",
		"id",
	];
	for (const attr of valuableAttrs) {
		if (el.attr(attr)) return true;
	}
	if (el[0]?.attribs) {
		for (const attr in el[0].attribs) {
			if (attr.startsWith("data-")) return true;
		}
	}
	return false;
}

function hasDirectText(el: cheerio.Cheerio<any>): boolean {
	let hasText = false;
	el.contents().each((_: number, node: any) => {
		if (node.type === "text" && node.data.trim().length > 0) {
			hasText = true;
			return false; // break
		}
	});
	return hasText;
}

let changed = true;
let iterations = 0;
while (changed && iterations < 10) {
	changed = false;
	iterations++;

	// Remove empty elements
	$("*").each(function () {
		const el = $(this);
		if (
			!hasValuableAttributes(el) &&
			!el.children().length &&
			el.text().trim() === ""
		) {
			el.remove();
			changed = true;
		}
	});

	// Collect wrappers to unwrap
	let toUnwrap: cheerio.Cheerio<any>[] = [];
	$("*").each(function () {
		const el = $(this);
		if (
			!hasValuableAttributes(el) &&
			!hasDirectText(el) &&
			el.children().length > 0
		) {
			toUnwrap.push(el);
		}
	});

	// Unwrap
	for (const el of toUnwrap) {
		el.children().unwrap();
		changed = true;
	}
}

let result = $.html();
result = result
	.split("\n")
	.filter((line) => line.trim() !== "")
	.join("\n");
console.log(result);
