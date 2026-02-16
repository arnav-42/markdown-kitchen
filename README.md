# Markdown Kitchen

Convert between Markdown flavors directly in the browser. No build step.

## Run locally
Any static server works:

```bash
python -m http.server 8080
```

Open `http://localhost:8080`.

## How it works
- Input is normalized for the chosen flavor (Obsidian, Kramdown, etc.).
- Markdown is rendered to HTML using `markdown-it`.
- HTML is converted back to Markdown using `turndown` + GFM plugin.
- Output is post-processed to target flavor quirks.

## Notes / limitations
- Conversion is best-effort; some flavor features do not map cleanly.
- Tables, task lists, and strikethrough are preserved via the GFM plugin.
- Obsidian embeds and callouts are approximated as standard Markdown.
