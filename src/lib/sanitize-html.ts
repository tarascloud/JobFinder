/**
 * Server-side HTML sanitizer using isomorphic-dompurify.
 *
 * Replaces previous `sanitize-html` (npm pkg) — aligns with the canonical
 * implementation in `vs-private/packages/security/src/sanitize-html.ts`
 * (see `.claude/rules/security-sync.md`).
 *
 * Hardening:
 *   - explicit ALLOWED_TAGS allowlist (no <img>, <div>, <hr>, <iframe>, <script>, <svg>)
 *   - explicit FORBID_ATTR (style + every common on* event handler)
 *   - URI scheme enforcement (http, https, mailto only)
 *   - external link rel/target hardening (noopener noreferrer nofollow)
 */
import DOMPurify from "isomorphic-dompurify";

const ALLOWED_TAGS = [
  "p", "br", "ul", "ol", "li", "strong", "b", "em", "i", "u",
  "a", "h1", "h2", "h3", "h4", "h5", "h6",
  "span", "table", "thead", "tbody", "tr", "td", "th",
  "blockquote", "pre", "code", "dl", "dt", "dd", "sub", "sup",
  "abbr", "mark", "small", "del", "ins",
];

const ALLOWED_ATTR = [
  "href", "title", "target", "rel",
  "colspan", "rowspan",
  "alt", "class",
];

// Explicit FORBID_ATTR per .claude/rules/security-sync.md — never strip these.
const FORBID_ATTR = [
  "style",
  "onerror", "onload", "onclick", "onmouseover", "onfocus", "onblur",
  "onchange", "onsubmit", "onkeydown", "onkeyup", "onkeypress",
  "formaction", "srcdoc",
];

const FORBID_TAGS = ["style", "script", "iframe", "object", "embed", "svg", "img", "div", "hr"];

// Safe URI regexp — only http(s), mailto, relative, or anchor links.
const SAFE_URI = /^(?:(?:https?|mailto):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i;

/**
 * Sanitize HTML string — remove dangerous tags, event attributes, and
 * dangerous URI schemes. Force rel="nofollow noopener noreferrer" + target=_blank
 * on all external anchors.
 */
export function sanitizeHtml(html: string): string {
  if (typeof html !== "string" || html.length === 0) return "";

  const clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOWED_URI_REGEXP: SAFE_URI,
    ALLOW_DATA_ATTR: false,
    FORBID_TAGS,
    FORBID_ATTR,
  });

  // Harden all external anchors: force rel and target.
  return clean.replace(
    /<a\s+([^>]*?)href="(https?:[^"]+)"([^>]*?)>/gi,
    (_match: string, pre: string, href: string, post: string) => {
      const rel = `rel="nofollow noopener noreferrer"`;
      const tgt = `target="_blank"`;
      const cleanPre = pre.replace(/\s*(rel|target)="[^"]*"/gi, "");
      const cleanPost = post.replace(/\s*(rel|target)="[^"]*"/gi, "");
      return `<a ${cleanPre}href="${href}" ${tgt} ${rel}${cleanPost}>`;
    },
  );
}
