/**
 * Server-side HTML sanitizer using the `sanitize-html` package.
 * Replaces the previous custom regex-based implementation to avoid
 * edge cases in malformed HTML / mutation XSS.
 */
import sanitize from "sanitize-html";

const SANITIZE_OPTIONS: sanitize.IOptions = {
  allowedTags: [
    "p", "br", "ul", "ol", "li", "strong", "b", "em", "i", "u",
    "a", "h1", "h2", "h3", "h4", "h5", "h6",
    "span", "div", "table", "thead", "tbody", "tr", "td", "th",
    "blockquote", "pre", "code", "hr", "dl", "dt", "dd", "sub", "sup",
    "abbr", "mark", "small", "del", "ins",
  ],
  allowedAttributes: {
    a: ["href", "title", "target", "rel"],
    td: ["colspan", "rowspan"],
    th: ["colspan", "rowspan"],
    abbr: ["title"],
  },
  allowedSchemes: ["http", "https", "mailto"],
  allowedSchemesByTag: {},
  // Force rel="nofollow noopener noreferrer" on all links
  transformTags: {
    a: (tagName, attribs) => ({
      tagName,
      attribs: {
        ...attribs,
        rel: "nofollow noopener noreferrer",
        target: "_blank",
      },
    }),
  },
};

/**
 * Sanitize HTML string — remove dangerous tags, event attributes, and
 * dangerous URI schemes. Keep safe formatting tags intact.
 */
export function sanitizeHtml(html: string): string {
  if (!html) return "";
  return sanitize(html, SANITIZE_OPTIONS);
}
