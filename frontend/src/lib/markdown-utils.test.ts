import { describe, expect, it } from "vitest";
import { getNodeText, normalizeMarkdown, sanitizeUrl } from "./markdown-utils";

describe("sanitizeUrl", () => {
  it("allows http and https URLs", () => {
    expect(sanitizeUrl("https://example.com")).toBe("https://example.com");
    expect(sanitizeUrl("http://example.com/path?q=1#frag")).toBe(
      "http://example.com/path?q=1#frag",
    );
  });

  it("allows mailto and tel URLs", () => {
    expect(sanitizeUrl("mailto:x@y.com")).toBe("mailto:x@y.com");
    expect(sanitizeUrl("tel:+40712345678")).toBe("tel:+40712345678");
  });

  it("allows relative, anchor, and query-only URLs", () => {
    expect(sanitizeUrl("/probleme/xyz")).toBe("/probleme/xyz");
    expect(sanitizeUrl("#section")).toBe("#section");
    expect(sanitizeUrl("?q=1")).toBe("?q=1");
    expect(sanitizeUrl("relative/path")).toBe("relative/path");
  });

  it("blocks javascript: URLs", () => {
    expect(sanitizeUrl("javascript:alert(1)")).toBe("");
    expect(sanitizeUrl("JavaScript:alert(1)")).toBe("");
  });

  it("blocks the tab/newline-in-scheme filter-bypass trick", () => {
    expect(sanitizeUrl("java\tscript:alert(1)")).toBe("");
    expect(sanitizeUrl("java\nscript:alert(1)")).toBe("");
  });

  it("blocks data: and vbscript: URLs", () => {
    expect(sanitizeUrl("data:text/html,<script>alert(1)</script>")).toBe("");
    expect(sanitizeUrl("vbscript:msgbox(1)")).toBe("");
  });

  it("blocks a leading-whitespace javascript: URL", () => {
    expect(sanitizeUrl("   javascript:alert(1)")).toBe("");
  });

  it("passes through an empty string", () => {
    expect(sanitizeUrl("")).toBe("");
  });
});

describe("normalizeMarkdown", () => {
  it("converts CRLF and lone CR to LF", () => {
    expect(normalizeMarkdown("a\r\nb\rc")).toBe("a\nb\nc");
  });

  it("strips trailing spaces/tabs that would otherwise become a hard break", () => {
    expect(normalizeMarkdown("line one  \nline two\t\n")).toBe("line one\nline two\n");
  });

  it("collapses 3+ consecutive blank lines to a single blank line", () => {
    expect(normalizeMarkdown("a\n\n\n\n\nb")).toBe("a\n\nb");
  });

  it("strips a leading BOM", () => {
    expect(normalizeMarkdown("﻿# Title")).toBe("# Title");
  });

  it("leaves already-clean markdown untouched", () => {
    const clean = "# Title\n\nA paragraph.\n\n- one\n- two\n";
    expect(normalizeMarkdown(clean)).toBe(clean);
  });

  it("returns falsy input as-is", () => {
    expect(normalizeMarkdown("")).toBe("");
  });
});

describe("getNodeText", () => {
  it("extracts text from plain strings and numbers", () => {
    expect(getNodeText("hello")).toBe("hello");
    expect(getNodeText(42)).toBe("42");
  });

  it("extracts and concatenates text from arrays of nodes", () => {
    expect(getNodeText(["a", "b", 1])).toBe("ab1");
  });

  it("recurses into element-like nodes via props.children", () => {
    const fakeElement = { props: { children: ["nested ", { props: { children: "text" } }] } };
    expect(getNodeText(fakeElement)).toBe("nested text");
  });

  it("returns an empty string for null/undefined", () => {
    expect(getNodeText(null)).toBe("");
    expect(getNodeText(undefined)).toBe("");
  });
});
