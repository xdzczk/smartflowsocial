/**
 * XSS Prevention Tests
 * 
 * Tests that the application properly sanitizes user input to prevent XSS attacks
 */

import { describe, it, expect } from "vitest";
import { sanitizeMarkdown } from "~/lib/markdown-sanitizer.server";

describe("XSS Prevention: Markdown Sanitization", () => {
  it("should remove script tags", () => {
    const malicious = "<script>alert('XSS')</script>Hello";
    const sanitized = sanitizeMarkdown(malicious);
    
    expect(sanitized).not.toContain("<script>");
    expect(sanitized).not.toContain("alert('XSS')");
    expect(sanitized).toContain("Hello");
  });

  it("should remove inline event handlers", () => {
    const malicious = '<img src="x" onerror="alert(\'XSS\')">';
    const sanitized = sanitizeMarkdown(malicious);
    
    expect(sanitized).not.toContain("onerror");
    expect(sanitized).not.toContain("alert");
  });

  it("should remove javascript: protocol", () => {
    const malicious = "[Click me](javascript:alert('XSS'))";
    const sanitized = sanitizeMarkdown(malicious);
    
    expect(sanitized).not.toContain("javascript:");
    expect(sanitized).toContain("Click me");
  });

  it("should remove data: protocol", () => {
    const malicious = "[Click me](data:text/html,<script>alert('XSS')</script>)";
    const sanitized = sanitizeMarkdown(malicious);
    
    expect(sanitized).not.toContain("data:");
  });

  it("should remove iframe tags", () => {
    const malicious = '<iframe src="evil.com"></iframe>';
    const sanitized = sanitizeMarkdown(malicious);
    
    expect(sanitized).not.toContain("<iframe");
  });

  it("should remove embed tags", () => {
    const malicious = '<embed src="evil.swf">';
    const sanitized = sanitizeMarkdown(malicious);
    
    expect(sanitized).not.toContain("<embed");
  });

  it("should remove object tags", () => {
    const malicious = '<object data="evil.swf"></object>';
    const sanitized = sanitizeMarkdown(malicious);
    
    expect(sanitized).not.toContain("<object");
  });

  it("should remove form tags", () => {
    const malicious = '<form action="evil.com"><input type="submit"></form>';
    const sanitized = sanitizeMarkdown(malicious);
    
    expect(sanitized).not.toContain("<form");
    expect(sanitized).not.toContain("<input");
  });

  it("should remove style tags", () => {
    const malicious = '<style>body { background: red; }</style>';
    const sanitized = sanitizeMarkdown(malicious);
    
    expect(sanitized).not.toContain("<style");
  });

  it("should sanitize HTML entities in code blocks", () => {
    const malicious = "```\n<script>alert('XSS')</script>\n```";
    const sanitized = sanitizeMarkdown(malicious);
    
    expect(sanitized).not.toContain("<script>");
    expect(sanitized).toContain("&lt;script&gt;");
  });

  it("should allow safe HTML tags", () => {
    const safe = "**Bold** *Italic* [Link](https://example.com)";
    const sanitized = sanitizeMarkdown(safe);
    
    expect(sanitized).toContain("<strong>");
    expect(sanitized).toContain("<em>");
    expect(sanitized).toContain("<a");
    expect(sanitized).toContain("https://example.com");
  });

  it("should escape HTML in text content", () => {
    const malicious = "Text with <b>HTML</b> tags";
    const sanitized = sanitizeMarkdown(malicious);
    
    // Should either escape or remove unsafe tags
    expect(sanitized).not.toContain("<b>HTML</b>");
  });

  it("should handle nested script tags", () => {
    const malicious = "<script><script>alert('XSS')</script></script>";
    const sanitized = sanitizeMarkdown(malicious);
    
    expect(sanitized).not.toContain("<script>");
  });

  it("should handle script tags with attributes", () => {
    const malicious = '<script type="text/javascript">alert("XSS")</script>';
    const sanitized = sanitizeMarkdown(malicious);
    
    expect(sanitized).not.toContain("<script");
  });

  it("should handle case-insensitive script tags", () => {
    const malicious = "<SCRIPT>alert('XSS')</SCRIPT>";
    const sanitized = sanitizeMarkdown(malicious);
    
    expect(sanitized).not.toContain("<SCRIPT");
    expect(sanitized).not.toContain("alert");
  });
});

describe("XSS Prevention: Input Validation", () => {
  it("should reject null input", () => {
    const sanitized = sanitizeMarkdown(null as any);
    expect(sanitized).toBe("");
  });

  it("should reject undefined input", () => {
    const sanitized = sanitizeMarkdown(undefined as any);
    expect(sanitized).toBe("");
  });

  it("should reject non-string input", () => {
    const sanitized = sanitizeMarkdown(123 as any);
    expect(sanitized).toBe("");
  });

  it("should handle empty strings", () => {
    const sanitized = sanitizeMarkdown("");
    expect(sanitized).toBe("");
  });
});

