import { describe, it, expect } from "vitest";
import { stripHtml } from "@/lib/html-utils";

describe("stripHtml", () => {
  it("returns empty string for empty input", () => {
    expect(stripHtml("")).toBe("");
  });

  it("removes basic HTML tags", () => {
    expect(stripHtml("<p>Hello world</p>")).toBe("Hello world");
  });

  it("converts <br> tags to newlines then collapses whitespace", () => {
    const result = stripHtml("line1<br>line2");
    expect(result).toContain("line1");
    expect(result).toContain("line2");
  });

  it("decodes &amp; entity", () => {
    expect(stripHtml("A &amp; B")).toBe("A & B");
  });

  it("decodes &lt; and &gt; entities", () => {
    expect(stripHtml("&lt;tag&gt;")).toBe("<tag>");
  });

  it("decodes &quot; entity", () => {
    expect(stripHtml("say &quot;hello&quot;")).toBe('say "hello"');
  });

  it("decodes &#39; entity", () => {
    expect(stripHtml("it&#39;s")).toBe("it's");
  });

  it("decodes &nbsp; as a space", () => {
    expect(stripHtml("A&nbsp;B")).toBe("A B");
  });

  it("collapses multiple spaces into one", () => {
    expect(stripHtml("  hello   world  ")).toBe("hello world");
  });

  it("trims leading and trailing whitespace", () => {
    expect(stripHtml("  hello  ")).toBe("hello");
  });

  it("strips self-closing tags", () => {
    expect(stripHtml("<img src='x'/> text")).toBe("text");
  });

  it("handles mixed tags and text", () => {
    const result = stripHtml("<strong>bold</strong> and <em>italic</em>");
    expect(result).toBe("bold and italic");
  });
});
