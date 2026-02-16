(() => {
  "use strict";

  const DIALECTS = [
    { id: "gfm", name: "GitHub Flavored Markdown (GFM)" },
    { id: "commonmark", name: "CommonMark" },
    { id: "kramdown", name: "Kramdown" },
    { id: "obsidian", name: "Obsidian Markdown" },
    { id: "discord", name: "Discord Markdown" },
    { id: "reddit", name: "Reddit Markdown" },
    { id: "multimarkdown", name: "MultiMarkdown" },
  ];

  const el = (id) => document.getElementById(id);

  const inDialectSel = el("inDialect");
  const outDialectSel = el("outDialect");
  const inputEl = el("input");
  const outputEl = el("output");
  const previewEl = el("preview");

  const swapBtn = el("swapBtn");
  const copyOutBtn = el("copyOutBtn");
  const downloadBtn = el("downloadBtn");
  const convertBtn = el("convertBtn");
  const modeSel = el("mode");

  const optWrap = el("optWrap");
  const optTight = el("optTight");
  const optSetext = el("optSetext");

  const inStats = el("inStats");
  const outStats = el("outStats");

  function fillSelect(select, value) {
    select.innerHTML = "";
    for (const d of DIALECTS) {
      const o = document.createElement("option");
      o.value = d.id;
      o.textContent = d.name;
      select.appendChild(o);
    }
    select.value = value;
  }

  fillSelect(inDialectSel, "gfm");
  fillSelect(outDialectSel, "commonmark");

  function countStats(text) {
    const chars = text.length;
    const lines = text.length ? text.split("\n").length : 0;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    return { chars, lines, words };
  }

  function renderStats(node, text) {
    const s = countStats(text);
    node.textContent = `Lines: ${s.lines} | Words: ${s.words} | Chars: ${s.chars}`;
  }

  function normalizeNewlines(s) {
    return s.replace(/\r\n/g, "\n");
  }

  function isListLine(line) {
    return /^\s*(?:[-*+]|[0-9]+\.)\s+/.test(line);
  }

  function isTableLine(line) {
    return /^\s*\|/.test(line) || /^\s*[-| :]{3,}\s*$/.test(line);
  }

  function isHeadingLine(line) {
    return (
      /^\s{0,3}#{1,6}\s+/.test(line) ||
      /^\s{0,3}.{1,}\n?\s*[-=]{3,}\s*$/.test(line)
    );
  }

  function isHrLine(line) {
    return /^\s*([-*_]){3,}\s*$/.test(line);
  }

  function wrapParagraph(text, width) {
    const words = text.trim().split(/\s+/);
    if (!words.length) return "";
    const lines = [];
    let current = words[0];
    for (let i = 1; i < words.length; i += 1) {
      const next = words[i];
      if (current.length + 1 + next.length <= width) {
        current += ` ${next}`;
      } else {
        lines.push(current);
        current = next;
      }
    }
    lines.push(current);
    return lines.join("\n");
  }

  function wrapMarkdown(md, width) {
    if (!width) return md;
    const lines = md.split("\n");
    const out = [];
    let paragraph = [];
    let inFence = false;

    const flush = () => {
      if (!paragraph.length) return;
      const raw = paragraph.join(" ").trim();
      out.push(wrapParagraph(raw, width));
      paragraph = [];
    };

    for (const line of lines) {
      const fenceMatch = line.trim().match(/^```|^~~~/);
      if (fenceMatch) {
        flush();
        inFence = !inFence;
        out.push(line);
        continue;
      }

      if (inFence) {
        out.push(line);
        continue;
      }

      const trimmed = line.trim();
      const startsBlockquote = /^\s*>/.test(line);

      if (
        !trimmed ||
        isHeadingLine(line) ||
        isListLine(line) ||
        isTableLine(line) ||
        isHrLine(line) ||
        startsBlockquote
      ) {
        flush();
        out.push(line);
        continue;
      }

      paragraph.push(trimmed);
    }

    flush();
    return out.join("\n");
  }

  function tightenLists(md) {
    let out = md;
    out = out.replace(/^(\s*[-*+]\s.+)\n\n(?=\s*[-*+]\s)/gm, "$1\n");
    out = out.replace(/^(\s*\d+\.\s.+)\n\n(?=\s*\d+\.\s)/gm, "$1\n");
    return out;
  }

  function preprocess(md, dialect) {
    md = normalizeNewlines(md);

    if (dialect === "obsidian") {
      md = md.replace(/!\[\[([^\]]+?)\]\]/g, "![]($1)");
      md = md.replace(/\[\[([^|\]]+?)\|([^\]]+?)\]\]/g, "[$2]($1)");
      md = md.replace(/\[\[([^\]]+?)\]\]/g, "[$1]($1)");
      md = md.replace(/^>\s*\[!([A-Za-z0-9_-]+)\]\s*(.*)$/gm, (m, type, rest) => {
        const t = type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
        const title = rest && rest.trim().length ? ` ${rest.trim()}` : "";
        return `> **${t}:**${title}`;
      });
      md = md.replace(/==([^=\n]+)==/g, "**$1**");
    }

    if (dialect === "discord") {
      md = md.replace(/\|\|([\s\S]*?)\|\|/g, "<span data-spoiler>$1</span>");
    }

    if (dialect === "kramdown") {
      md = md.replace(/^\s*\{:[^\}]+\}\s*$/gm, (m) => `<!--kramdown-attrlist:${m.trim()}-->`);
    }

    if (dialect === "multimarkdown") {
      const metaMatch = md.match(/^([A-Za-z][A-Za-z0-9 _-]*:\s.*\n)+\n/);
      if (metaMatch) {
        const meta = metaMatch[0];
        md = `<!--mmd-meta-start-->\n${meta}<!--mmd-meta-end-->\n` + md.slice(meta.length);
      }
    }

    return md;
  }

  function postprocess(md, dialect) {
    md = normalizeNewlines(md);

    if (dialect === "obsidian") {
      md = md.replace(/\[([^\]]+?)\]\(([^)]+?)\)/g, (m, text, href) => {
        const h = href.trim();
        const t = text.trim();
        const looksInternal =
          !/^[a-z]+:\/\//i.test(h) && !h.includes("/") && !/\.[a-z0-9]{2,5}$/i.test(h);

        if (!looksInternal) return m;
        if (t === h) return `[[${h}]]`;
        return `[[${h}|${t}]]`;
      });
      md = md.replace(/<span data-spoiler>([\s\S]*?)<\/span>/g, "||$1||");
    }

    if (dialect === "discord") {
      md = md.replace(/<span data-spoiler>([\s\S]*?)<\/span>/g, "||$1||");
    }

    if (dialect === "kramdown") {
      md = md.replace(/<!--kramdown-attrlist:(\{:[^\}]+\})-->/g, "$1");
    }

    if (dialect === "multimarkdown") {
      md = md.replace(/<!--mmd-meta-start-->\n([\s\S]*?)<!--mmd-meta-end-->\n?/g, "$1\n");
    }

    if (dialect === "reddit") {
      md = md.replace(/<span data-spoiler>([\s\S]*?)<\/span>/g, "||$1||");
    }

    if (dialect === "commonmark") {
      md = md.replace(/^<!--kramdown-attrlist:.*?-->\n?/gm, "");
      md = md.replace(/^<!--mmd-meta-start-->[\s\S]*?<!--mmd-meta-end-->\n?/m, "");
    }

    return md;
  }

  function buildTurndownService({ setext }) {
    const service = new TurndownService({
      codeBlockStyle: "fenced",
      emDelimiter: "_",
      strongDelimiter: "**",
      bulletListMarker: "-",
      headingStyle: setext ? "setext" : "atx",
    });

    if (window.turndownPluginGfm?.gfm) {
      service.use(window.turndownPluginGfm.gfm);
    }

    service.addRule("spoilerSpan", {
      filter: (node) => node.nodeName === "SPAN" && node.getAttribute("data-spoiler") !== null,
      replacement: (content) => `||${content}||`,
    });

    return service;
  }

  function previewMarkdown(md, outDialect) {
    let previewText = md;
    if (outDialect === "obsidian") {
      previewText = previewText.replace(/\[\[([^|\]]+?)\|([^\]]+?)\]\]/g, "[$2]($1)");
      previewText = previewText.replace(/\[\[([^\]]+?)\]\]/g, "[$1]($1)");
    }
    previewText = previewText.replace(/\|\|([\s\S]*?)\|\|/g, "<span data-spoiler>$1</span>");
    return previewText;
  }

  async function convertOnce() {
    const inDialect = inDialectSel.value;
    const outDialect = outDialectSel.value;

    const wrap = optWrap.checked ? 80 : false;
    const tightLists = optTight.checked;
    const setext = optSetext.checked;

    const inputRaw = inputEl.value || "";
    renderStats(inStats, inputRaw);

    const pre = preprocess(inputRaw, inDialect);

    const md = window.markdownit({
      html: true,
      linkify: true,
      breaks: false,
    });

    const html = md.render(pre);
    const turndown = buildTurndownService({ setext });
    let out = turndown.turndown(html);

    out = postprocess(out, outDialect);
    out = wrapMarkdown(out, wrap);
    if (tightLists) out = tightenLists(out);

    outputEl.value = out;
    renderStats(outStats, out);

    renderPreview(out, outDialect);
  }

  function renderPreview(md, outDialect) {
    const previewText = previewMarkdown(md, outDialect);
    const mdRenderer = window.markdownit({
      html: true,
      linkify: true,
      breaks: false,
    });
    const html = mdRenderer.render(previewText);

    const withSpoilers = html.replace(
      /<span data-spoiler>([\s\S]*?)<\/span>/g,
      `<span class="spoiler" title="Spoiler">$1</span>`,
    );
    previewEl.innerHTML = withSpoilers;
  }

  function debounce(fn, ms) {
    let t = null;
    return (...args) => {
      if (t) clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  }

  const convertDebounced = debounce(() => {
    if (modeSel.value === "live") convertOnce();
  }, 200);

  inputEl.addEventListener("input", convertDebounced);
  inDialectSel.addEventListener("change", () => convertOnce());
  outDialectSel.addEventListener("change", () => convertOnce());
  optWrap.addEventListener("change", () => convertOnce());
  optTight.addEventListener("change", () => convertOnce());
  optSetext.addEventListener("change", () => convertOnce());

  modeSel.addEventListener("change", () => {
    convertBtn.style.display = modeSel.value === "manual" ? "inline-flex" : "none";
    if (modeSel.value === "live") convertOnce();
  });
  convertBtn.addEventListener("click", () => convertOnce());

  swapBtn.addEventListener("click", async () => {
    const a = inDialectSel.value;
    inDialectSel.value = outDialectSel.value;
    outDialectSel.value = a;

    const tmp = inputEl.value;
    inputEl.value = outputEl.value;
    outputEl.value = tmp;

    await convertOnce();
  });

  copyOutBtn.addEventListener("click", async () => {
    await navigator.clipboard.writeText(outputEl.value || "");
    copyOutBtn.textContent = "Copied";
    setTimeout(() => (copyOutBtn.textContent = "Copy Output"), 900);
  });

  downloadBtn.addEventListener("click", () => {
    const blob = new Blob([outputEl.value || ""], {
      type: "text/markdown;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const d = outDialectSel.value || "markdown";
    a.download = `converted.${d}.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  convertBtn.style.display = "none";
  inputEl.value = `# Sample

- [ ] Task list (GFM)
- **Bold**, _italic_, ~~strike~~

Obsidian examples (will convert best-effort if selected as input):
- [[Page|Alias]]
- ![[image.png]]
- > [!note] Callout title

Discord spoiler example:
||hidden||

A table:

| A | B |
|---|---|
| 1 | 2 |
`;

  convertOnce();
})();
