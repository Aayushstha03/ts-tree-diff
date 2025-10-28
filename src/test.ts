import { DomTree } from './node_utils';

const sampleHtml = `
<!DOCTYPE html>
<html>
<head>
  <title>Sample Page</title>
</head>
<body>
  <h1>Heading One</h1>
  <p>This is a <span>paragraph</span> with <b>inline</b> elements.</p>
  <ul>
    <li>Item 1</li>
    <li>Item 2</li>
  </ul>
</body>
</html>
`;

const tree = new DomTree(sampleHtml);
const rootNode = tree.root;

console.log("--- Normalized Representation ---");
console.log(rootNode.normalizedRepresentation());

console.log("\n--- Extracted Text ---");
console.log(rootNode.extractText());
