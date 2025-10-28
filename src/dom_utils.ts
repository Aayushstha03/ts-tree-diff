// Utility to remove <script> and <style> tags from HTML before parsing
export function stripScriptAndStyleTags(html: string): string {
	// Remove <script>...</script> and <style>...</style> blocks (greedy)
	return html
		.replace(/<script[\s\S]*?<\/script>/gi, "")
		.replace(/<style[\s\S]*?<\/style>/gi, "");
}

// Example usage:
// const cleanHtml = stripScriptAndStyleTags(rawHtml);
