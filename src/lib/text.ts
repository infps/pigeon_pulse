// Strip HTML tags + markdown syntax → readable plain text (for summaries/snippets).
export function toPlainText(input: string | null | undefined): string {
  if (!input) return "";
  let s = input;
  s = s.replace(/```[\s\S]*?```/g, " "); // fenced code blocks
  s = s.replace(/<[^>]*>/g, " "); // html tags
  // common html entities
  s = s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  s = s.replace(/!\[[^\]]*\]\([^)]*\)/g, " "); // md images
  s = s.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1"); // md links → text
  s = s.replace(/^[ \t]*#{1,6}[ \t]+/gm, ""); // headings
  s = s.replace(/^[ \t]*>[ \t]?/gm, ""); // blockquotes
  s = s.replace(/^[ \t]*[-*+][ \t]+/gm, ""); // bullets
  s = s.replace(/[*_~`]/g, ""); // emphasis/inline-code marks
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

// Plain-text snippet truncated to n chars.
export function plainSnippet(input: string | null | undefined, n = 150): string {
  const s = toPlainText(input);
  return s.length > n ? s.slice(0, n).trimEnd() + "…" : s;
}
