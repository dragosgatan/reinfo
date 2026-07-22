/** Pure helpers for markdown rendering, kept dependency-free so they're easy to unit test. */

const SAFE_PROTOCOL_RE = /^(https?|mailto|tel):/i;

function stripControlChars(value: string): string {
  let out = "";
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    // Skip ASCII control characters and plain space (codes 0-32 inclusive).
    if (code > 32) out += value[i];
  }
  return out;
}

/**
 * Allowlist-based URL sanitizer used as react-markdown's `urlTransform`.
 *
 * react-markdown never parses raw HTML (no rehype-raw is used anywhere in this app),
 * so the only realistic injection surface left is a markdown link/image whose target
 * uses a dangerous scheme, e.g. `[click me](javascript:alert(1))`. Relative/anchor/query
 * URLs (no scheme) are always allowed; anything with an explicit scheme must be
 * http(s), mailto, or tel. Control characters and spaces are stripped before the scheme
 * check only, since inserting a tab/newline inside the scheme (`java` + TAB + `script:`)
 * is a classic filter-bypass trick some renderers historically fell for.
 */
export function sanitizeUrl(url: string): string {
  const value = (url ?? "").trim();
  if (!value) return value;

  const probe = stripControlChars(value);
  const colonIndex = probe.indexOf(":");
  const slashIndex = probe.indexOf("/");
  const hashIndex = probe.indexOf("#");
  const queryIndex = probe.indexOf("?");

  const isRelative =
    colonIndex === -1 ||
    (slashIndex !== -1 && colonIndex > slashIndex) ||
    (hashIndex !== -1 && colonIndex > hashIndex) ||
    (queryIndex !== -1 && colonIndex > queryIndex);

  if (isRelative) return value;
  return SAFE_PROTOCOL_RE.test(probe) ? value : "";
}

/**
 * Defensive markdown normalization applied before parsing.
 *
 * Covers the failure modes named for the "empty space" rendering bug (already fixed
 * once at the source, but cheap to guard against here too since this component now
 * serves untrusted/less-controlled input like bios and discussions): CRLF line endings,
 * trailing-whitespace-triggered hard breaks, and runs of 3+ blank lines.
 */
export function normalizeMarkdown(input: string): string {
  if (!input) return input;
  const withoutBom = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  return withoutBom
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n");
}

export function getNodeText(node: unknown): string {
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(getNodeText).join("");
  if (node && typeof node === "object" && "props" in node) {
    const props = (node as { props?: { children?: unknown } }).props;
    return getNodeText(props?.children);
  }
  return "";
}
