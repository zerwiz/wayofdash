# Markdown rendering rules (Way of UI)

This document defines how **Markdown** MUST be rendered in the project dashboard so previews match **GitHub.com** readability (spacing, type scale, lists, tables, code blocks) as closely as practical without calling GitHub APIs.

## Goals

- **Readability first:** Comfortable line length, heading hierarchy, and vertical rhythm similar to GitHub’s README / wiki view ([Primer typography guidance](https://primer.style/product/getting-started/foundations/typography/): sensible line height, left-aligned ragged body text, semantic headings—not color-only hierarchy).
- **GFM parity:** Tables, task lists, strikethrough, autolinks, and other **GitHub Flavored Markdown** features behave as users expect on github.com.
- **Theme alignment:** Light and dark previews MUST follow the **app** theme (Tailwind `dark` class + `color-scheme` on `documentElement`), not only the OS `prefers-color-scheme`, so manual toggles stay consistent.

## Implementation (canonical)

| Piece | Rule |
|--------|------|
| **CSS** | Use [sindresorhus/github-markdown-css](https://github.com/sindresorhus/github-markdown-css) (light + dark stylesheets) scoped under **`.gh-md-light`** / **`.gh-md-dark`** so styles do not leak globally. Regenerate scoped files with `npm run scope:markdown-css` in `ui/` (runs automatically before `dev` / `build`). |
| **Markup shell** | Wrap rendered output in **`<article class="markdown-body">`**, matching upstream usage. |
| **Layout** | Center the column, **max-width ~980px**, responsive horizontal padding (**~15px** mobile, **~45px** desktop), consistent with github-markdown-css README recommendations. |
| **Surface** | **`.markdown-doc-root.gh-md-light` / `.gh-md-dark`** carry the GitHub paper **background + base text** (`#ffffff` / `#0d1117`); **`.markdown-body`** stays **transparent** inside that root so body text inherits the same theme as block code/tables (avoid `transparent !important` on `.markdown-body`, which made only some blocks look themed). |
| **Parser** | **react-markdown** + **remark-gfm** for GFM. Do not strip semantic HTML structure that GitHub CSS targets (`pre > code`, lists, headings). |
| **Fenced code** | Use normal **`<pre><code class="language-…">`** for highlighted blocks so GitHub stylesheet rules apply. **Exception:** ` ```mermaid ` fences MUST render with the app **MermaidDiagram** component (not plain code). |
| **Inline code** | Emit bare `<code>` (no fake prose plugins); let GitHub CSS style it. |
| **Syntax colors** | Optional: for closer parity with github.com code fences, consider **starry-night** or another highlighter later; current rule is “GitHub CSS + optional plain fenced blocks”. |
| **Links** | External `http(s)` links SHOULD use `target="_blank"` and `rel="noopener noreferrer"`. |

## When changing rendering

1. Prefer adjusting **scoped** `gh-md-*.css` generation or **`markdown-doc-shell.css`** over reintroducing **Tailwind Typography `prose`** on the same nodes (conflicting margins and code styles).
2. After upgrading **github-markdown-css**, run **`npm run scope:markdown-css`** and verify light/dark in both theme toggle states.
3. Update this file if the shell markup or theme strategy changes.

## References

- [github-markdown-css](https://github.com/sindresorhus/github-markdown-css)
- [Primer — Typography](https://primer.style/product/getting-started/foundations/typography/)
- [GFM spec](https://github.github.com/gfm/)
- UI entry: `ui/src/MarkdownDoc.jsx`, scoped CSS: `ui/src/styles/gh-md-light.css`, `gh-md-dark.css`, `markdown-doc-shell.css`, generator: `ui/scripts/scope-github-markdown.mjs`
