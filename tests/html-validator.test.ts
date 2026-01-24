/**
 * Tests for HTML Structure Validation
 */

import { describe, it, expect } from 'vitest';
import {
  detectNestedForms,
  detectMissingAlt,
  detectEmptyLinks,
  detectInvalidNesting,
  detectDeprecatedElements,
  validateHTMLStructure,
} from '../lib/html-validator';
import { ErrorIssueCodes, WarningIssueCodes, InfoIssueCodes } from '../lib/validation-types';

describe('detectNestedForms', () => {
  it('should detect nested forms', () => {
    const html = `<form><form></form></form>`;
    const issues = detectNestedForms(html);
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe('error');
    expect(issues[0].code).toBe(ErrorIssueCodes.NESTED_FORM);
  });

  it('should detect deeply nested forms', () => {
    const html = `<form><div><form><input></form></div></form>`;
    const issues = detectNestedForms(html);
    expect(issues).toHaveLength(1);
    expect(issues[0].code).toBe(ErrorIssueCodes.NESTED_FORM);
  });

  it('should allow sequential forms', () => {
    const html = `<form></form><form></form>`;
    const issues = detectNestedForms(html);
    expect(issues).toHaveLength(0);
  });

  it('should allow single form', () => {
    const html = `<form><input type="text"></form>`;
    const issues = detectNestedForms(html);
    expect(issues).toHaveLength(0);
  });

  it('should handle form with attributes', () => {
    const html = `<form action="/submit" method="post"><input type="text"></form>`;
    const issues = detectNestedForms(html);
    expect(issues).toHaveLength(0);
  });

  it('should detect multiple levels of nesting', () => {
    const html = `<form><form><form></form></form></form>`;
    const issues = detectNestedForms(html);
    // Should detect 2 nested forms (the 2nd and 3rd forms are nested)
    expect(issues).toHaveLength(2);
  });
});

describe('detectMissingAlt', () => {
  it('should detect missing alt', () => {
    const html = `<img src="photo.jpg">`;
    const issues = detectMissingAlt(html);
    expect(issues).toHaveLength(1);
    expect(issues[0].code).toBe(WarningIssueCodes.MISSING_ALT);
    expect(issues[0].message).toContain('photo.jpg');
  });

  it('should allow empty alt (decorative image)', () => {
    const html = `<img src="photo.jpg" alt="">`;
    const issues = detectMissingAlt(html);
    expect(issues).toHaveLength(0);
  });

  it('should allow descriptive alt', () => {
    const html = `<img src="photo.jpg" alt="A beautiful sunset">`;
    const issues = detectMissingAlt(html);
    expect(issues).toHaveLength(0);
  });

  it('should detect multiple images missing alt', () => {
    const html = `
      <img src="photo1.jpg">
      <img src="photo2.jpg">
      <img src="photo3.jpg" alt="Has alt">
    `;
    const issues = detectMissingAlt(html);
    expect(issues).toHaveLength(2);
  });

  it('should handle self-closing img tags', () => {
    const html = `<img src="photo.jpg" />`;
    const issues = detectMissingAlt(html);
    expect(issues).toHaveLength(1);
  });

  it('should truncate long src paths in message', () => {
    const html = `<img src="/very/long/path/to/some/image/that/exceeds/the/limit.jpg">`;
    const issues = detectMissingAlt(html);
    expect(issues).toHaveLength(1);
    expect(issues[0].message.length).toBeLessThan(100);
  });
});

describe('detectEmptyLinks', () => {
  it('should detect empty links', () => {
    const html = `<a href="/page"></a>`;
    const issues = detectEmptyLinks(html);
    expect(issues).toHaveLength(1);
    expect(issues[0].code).toBe(WarningIssueCodes.EMPTY_LINK);
  });

  it('should detect whitespace-only links', () => {
    const html = `<a href="/page">   </a>`;
    const issues = detectEmptyLinks(html);
    expect(issues).toHaveLength(1);
  });

  it('should detect newline-only links', () => {
    const html = `<a href="/page">
    </a>`;
    const issues = detectEmptyLinks(html);
    expect(issues).toHaveLength(1);
  });

  it('should allow links with text', () => {
    const html = `<a href="/page">Click here</a>`;
    const issues = detectEmptyLinks(html);
    expect(issues).toHaveLength(0);
  });

  it('should allow links with aria-label', () => {
    const html = `<a href="/page" aria-label="Go to page"></a>`;
    const issues = detectEmptyLinks(html);
    expect(issues).toHaveLength(0);
  });

  it('should allow links with image having alt', () => {
    const html = `<a href="/page"><img src="icon.png" alt="Icon"></a>`;
    const issues = detectEmptyLinks(html);
    expect(issues).toHaveLength(0);
  });

  it('should detect links with decorative image only (empty alt)', () => {
    const html = `<a href="/page"><img src="icon.png" alt=""></a>`;
    const issues = detectEmptyLinks(html);
    expect(issues).toHaveLength(1);
  });

  it('should allow links with nested text', () => {
    const html = `<a href="/page"><span>Click</span></a>`;
    const issues = detectEmptyLinks(html);
    expect(issues).toHaveLength(0);
  });

  it('should allow links with aria-label and empty content', () => {
    const html = `<a href="/page" aria-label="Navigation link"><i class="icon"></i></a>`;
    const issues = detectEmptyLinks(html);
    expect(issues).toHaveLength(0);
  });

  it('should detect links with only empty elements', () => {
    // Our improved logic strips HTML tags and checks for actual text content
    const html = `<a href="/page"><span></span></a>`;
    const issues = detectEmptyLinks(html);
    expect(issues).toHaveLength(1);
  });
});

describe('detectInvalidNesting', () => {
  it('should detect div inside span', () => {
    const html = `<span><div>content</div></span>`;
    const issues = detectInvalidNesting(html);
    expect(issues).toHaveLength(1);
    expect(issues[0].code).toBe(WarningIssueCodes.INVALID_NESTING);
    expect(issues[0].message).toContain('div');
    expect(issues[0].message).toContain('span');
  });

  it('should detect div inside p', () => {
    const html = `<p><div>content</div></p>`;
    const issues = detectInvalidNesting(html);
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain('div');
    expect(issues[0].message).toContain('p');
  });

  it('should detect section inside p', () => {
    const html = `<p>Some text <section>content</section></p>`;
    const issues = detectInvalidNesting(html);
    expect(issues).toHaveLength(1);
  });

  it('should detect ul inside span', () => {
    const html = `<span><ul><li>item</li></ul></span>`;
    const issues = detectInvalidNesting(html);
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain('ul');
    expect(issues[0].message).toContain('span');
  });

  it('should allow valid nesting', () => {
    const html = `<div><p><span>content</span></p></div>`;
    const issues = detectInvalidNesting(html);
    expect(issues).toHaveLength(0);
  });

  it('should allow inline elements inside block elements', () => {
    const html = `<p><strong><em>styled text</em></strong></p>`;
    const issues = detectInvalidNesting(html);
    expect(issues).toHaveLength(0);
  });

  it('should allow nested div elements', () => {
    const html = `<div><div><div>nested</div></div></div>`;
    const issues = detectInvalidNesting(html);
    expect(issues).toHaveLength(0);
  });

  it('should detect multiple invalid nesting', () => {
    const html = `
      <span><div>one</div></span>
      <a><p>two</p></a>
    `;
    const issues = detectInvalidNesting(html);
    expect(issues).toHaveLength(2);
  });
});

describe('detectDeprecatedElements', () => {
  it('should detect center element', () => {
    const html = `<center>content</center>`;
    const issues = detectDeprecatedElements(html);
    expect(issues).toHaveLength(1);
    expect(issues[0].code).toBe(InfoIssueCodes.DEPRECATED_ELEMENT);
    expect(issues[0].severity).toBe('info');
    expect(issues[0].suggestion).toContain('CSS');
  });

  it('should detect font element', () => {
    const html = `<font color="red">text</font>`;
    const issues = detectDeprecatedElements(html);
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain('font');
  });

  it('should detect marquee element', () => {
    const html = `<marquee>scrolling text</marquee>`;
    const issues = detectDeprecatedElements(html);
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain('marquee');
  });

  it('should detect multiple deprecated elements', () => {
    const html = `<center><font color="red">text</font></center>`;
    const issues = detectDeprecatedElements(html);
    expect(issues).toHaveLength(2);
  });

  it('should detect blink element', () => {
    const html = `<blink>blinking text</blink>`;
    const issues = detectDeprecatedElements(html);
    expect(issues).toHaveLength(1);
  });

  it('should not flag non-deprecated elements', () => {
    const html = `<div><span><p>normal elements</p></span></div>`;
    const issues = detectDeprecatedElements(html);
    expect(issues).toHaveLength(0);
  });

  it('should detect strike element', () => {
    const html = `<strike>strikethrough</strike>`;
    const issues = detectDeprecatedElements(html);
    expect(issues).toHaveLength(1);
    expect(issues[0].suggestion).toContain('<del>');
  });
});

describe('validateHTMLStructure', () => {
  it('should return valid for clean HTML', () => {
    const html = `
      <div>
        <h1>Title</h1>
        <p>Paragraph with <a href="/link">link</a></p>
        <img src="photo.jpg" alt="Description">
      </div>
    `;
    const result = validateHTMLStructure(html);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });

  it('should return isValid false for errors', () => {
    const html = `<form><form></form></form>`;
    const result = validateHTMLStructure(html);
    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('should still be valid with only warnings', () => {
    const html = `<img src="photo.jpg">`;
    const result = validateHTMLStructure(html);
    // Missing alt is a warning, not an error
    expect(result.canProceed).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('should collect all issue types', () => {
    const html = `
      <form><form></form></form>
      <img src="photo.jpg">
      <a href="/page"></a>
      <span><div>invalid</div></span>
      <center>deprecated</center>
    `;
    const result = validateHTMLStructure(html);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.info.length).toBeGreaterThan(0);
  });

  it('should handle empty HTML', () => {
    const result = validateHTMLStructure('');
    expect(result.isValid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('should handle null/undefined HTML', () => {
    const result = validateHTMLStructure(null as unknown as string);
    expect(result.isValid).toBe(true);
  });

  it('should include line numbers in issues', () => {
    const html = `line1
<form>
  <form>nested</form>
</form>`;
    const result = validateHTMLStructure(html);
    const formIssue = result.errors.find(e => e.code === ErrorIssueCodes.NESTED_FORM);
    expect(formIssue).toBeDefined();
    expect(formIssue?.lineNumber).toBeGreaterThan(1);
  });

  it('should include suggestions in issues', () => {
    const html = `<img src="photo.jpg">`;
    const result = validateHTMLStructure(html);
    const altIssue = result.warnings.find(w => w.code === WarningIssueCodes.MISSING_ALT);
    expect(altIssue).toBeDefined();
    expect(altIssue?.suggestion).toBeDefined();
    expect(altIssue?.suggestion).toContain('alt');
  });

  it('should report canProceed=true for nested forms (ERROR level, not FATAL)', () => {
    // Nested forms are ERROR level, which allows paste to proceed with warnings
    // Only FATAL issues block canProceed
    const html = `<form><form></form></form>`;
    const result = validateHTMLStructure(html);
    expect(result.canProceed).toBe(true);
    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('should provide summary for mixed issues', () => {
    const html = `
      <img src="photo.jpg">
      <center>old</center>
    `;
    const result = validateHTMLStructure(html);
    expect(result.summary).toBeTruthy();
    expect(result.summary.length).toBeGreaterThan(0);
  });
});
