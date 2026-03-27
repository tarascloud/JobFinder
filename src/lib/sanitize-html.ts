/**
 * Server-side HTML sanitizer — strips dangerous tags and event attributes.
 * Pure regex-based, no external dependencies.
 */

const ALLOWED_TAGS = new Set([
  "p", "br", "ul", "ol", "li", "strong", "b", "em", "i", "u",
  "a", "h1", "h2", "h3", "h4", "h5", "h6",
  "span", "div", "table", "thead", "tbody", "tr", "td", "th",
  "blockquote", "pre", "code", "hr", "dl", "dt", "dd", "sub", "sup",
  "abbr", "mark", "small", "del", "ins",
]);

// Attributes allowed per tag (all others stripped)
const ALLOWED_ATTRS: Record<string, Set<string>> = {
  a: new Set(["href", "title", "target"]),
  td: new Set(["colspan", "rowspan"]),
  th: new Set(["colspan", "rowspan"]),
  abbr: new Set(["title"]),
};

// Event attribute pattern — matches on*, e.g. onclick, onerror, onload
const EVENT_ATTR_RE = /\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi;

// Match any HTML tag (opening, closing, self-closing, or comment)
const TAG_RE = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*\/?>/gi;
const COMMENT_RE = /<!--[\s\S]*?-->/g;

// Dangerous URI schemes
const DANGEROUS_HREF_RE = /^\s*(javascript|vbscript|data)\s*:/i;

function sanitizeAttributes(tag: string, attrs: string): string {
  const allowedSet = ALLOWED_ATTRS[tag.toLowerCase()];

  // Always strip event handlers first
  let cleaned = attrs.replace(EVENT_ATTR_RE, "");

  // If this tag has no allowed attrs, strip them all
  if (!allowedSet) {
    return "";
  }

  // Parse and filter attributes
  const attrParts: string[] = [];
  const attrRe = /\s+([a-zA-Z][\w-]*)\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|(\S+)))?/g;
  let match;

  while ((match = attrRe.exec(cleaned)) !== null) {
    const name = match[1].toLowerCase();
    const value = match[2] ?? match[3] ?? match[4] ?? "";

    if (!allowedSet.has(name)) continue;
    if (name.startsWith("on")) continue;

    // For href, block dangerous schemes
    if (name === "href" && DANGEROUS_HREF_RE.test(value)) continue;

    attrParts.push(`${name}="${escapeAttrValue(value)}"`);
  }

  // For <a> tags, always add rel="nofollow noopener noreferrer"
  if (tag.toLowerCase() === "a") {
    attrParts.push('rel="nofollow noopener noreferrer"');
  }

  return attrParts.length > 0 ? " " + attrParts.join(" ") : "";
}

function escapeAttrValue(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Sanitize HTML string — remove dangerous tags, event attributes, and
 * dangerous URI schemes. Keep safe formatting tags intact.
 */
export function sanitizeHtml(html: string): string {
  if (!html) return "";

  let result = html;

  // 1. Strip HTML comments
  result = result.replace(COMMENT_RE, "");

  // 2. Strip dangerous tags entirely (including content between open/close)
  const STRIP_WITH_CONTENT = [
    "script", "iframe", "object", "embed", "form", "input", "textarea",
    "select", "button", "style", "link", "meta", "base", "applet",
    "frame", "frameset", "noscript", "template",
  ];

  for (const tag of STRIP_WITH_CONTENT) {
    // Remove opening+content+closing
    const re = new RegExp(
      `<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}\\s*>`,
      "gi"
    );
    result = result.replace(re, "");

    // Remove self-closing or orphaned opening tags
    const selfRe = new RegExp(`<${tag}\\b[^>]*\\/?>`, "gi");
    result = result.replace(selfRe, "");
  }

  // 3. Handle SVG separately — strip entirely (can contain event handlers, scripts)
  result = result.replace(/<svg\b[^>]*>[\s\S]*?<\/svg\s*>/gi, "");
  result = result.replace(/<svg\b[^>]*\/?>/gi, "");

  // 4. Process remaining tags — allow safe ones, strip unknown
  result = result.replace(TAG_RE, (fullMatch, tagName) => {
    const lower = tagName.toLowerCase();

    if (!ALLOWED_TAGS.has(lower)) {
      return ""; // Strip unknown tags
    }

    // Check if closing tag
    if (fullMatch.startsWith("</")) {
      return `</${lower}>`;
    }

    // Opening tag — extract and sanitize attributes
    const attrMatch = fullMatch.match(
      new RegExp(`^<${tagName}(\\s[^>]*)?\\/?>$`, "i")
    );
    const rawAttrs = attrMatch?.[1] || "";
    const sanitizedAttrs = sanitizeAttributes(lower, rawAttrs);
    const selfClosing = fullMatch.endsWith("/>") ? " /" : "";

    return `<${lower}${sanitizedAttrs}${selfClosing}>`;
  });

  return result;
}
