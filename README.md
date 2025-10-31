# ts-tree-diff

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run index.ts
```

This project was created using `bun init` in bun v1.3.1. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.



start by  running the dom_diff module, that removes sitewide common elements, incuding generic meta tags, headers, footers and as such...
we can use this snapshot to try and identify the dates and titles,
then we can use the main_content module try and identify the main content on the remaning DOM, if dates were not inferred from meta tags previously, we can now this version with the main block to try and get the details using heuristics
this also includes a link analysis module that can identify and remove adverts, breadcrumbs, nav links, all without tag specifiers.