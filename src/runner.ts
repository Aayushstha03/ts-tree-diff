import { DomTree } from "./node_utils";

const html = `
<html>
  <body>
    <h1>Hello <span>World</span></h1>
    <ul>
      <li>Item 1</li>
      <li>Item 2</li>
    </ul>
    <p>This is a <b>test</b> paragraph.</p>
    <script>console.log('ignore me');</script>
  </body>
</html>
`;

const tree = new DomTree(html);
console.log("Root tag:", tree.root.tag);
console.log("Extracted text:", tree.root.extractText());
console.log("Normalized representation:", tree.root.normalizedRepresentation());

// Print children tags
console.log(
	"Children tags:",
	tree.root.getchildren().map((child) => child.tag),
);
