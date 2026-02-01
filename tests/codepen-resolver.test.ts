import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import {
  normalizeExternalUrls,
  parseCodePenJsonp,
  parseCodePenUrl,
} from '../lib/codepen-resolver';

type CodePenFixture = {
  name: string;
  jsonp: string;
  expectedInput: {
    projectName: string;
    htmlText: string;
    cssText: string;
    jsText: string;
    cssUrls: string[];
    jsUrls: string[];
    provenance: 'codepen';
  };
};

function loadFixtures(): CodePenFixture[] {
  const fixturesDir = join(__dirname, 'fixtures', 'codepen');
  const files = readdirSync(fixturesDir).filter((file) => file.endsWith('.json'));
  return files.map((file) => {
    const content = readFileSync(join(fixturesDir, file), 'utf-8');
    return JSON.parse(content) as CodePenFixture;
  });
}

describe('parseCodePenUrl', () => {
  it('parses /pen/ URLs', () => {
    const result = parseCodePenUrl('https://codepen.io/osmosupply/pen/RNaeYqp');
    expect(result).toEqual({ user: 'osmosupply', slug: 'RNaeYqp' });
  });

  it('parses /full/ URLs', () => {
    const result = parseCodePenUrl('https://codepen.io/osmosupply/full/RNaeYqp');
    expect(result).toEqual({ user: 'osmosupply', slug: 'RNaeYqp' });
  });

  it('parses /debug/ URLs with trailing slash', () => {
    const result = parseCodePenUrl('https://codepen.io/osmosupply/debug/RNaeYqp/');
    expect(result).toEqual({ user: 'osmosupply', slug: 'RNaeYqp' });
  });

  it('rejects non-CodePen domains', () => {
    const result = parseCodePenUrl('https://example.com/osmosupply/pen/RNaeYqp');
    expect(result).toBeNull();
  });

  it('rejects unsupported path variants', () => {
    const result = parseCodePenUrl('https://codepen.io/osmosupply/collection/abc');
    expect(result).toBeNull();
  });
});

describe('parseCodePenJsonp', () => {
  it('parses JSONP wrapper safely', () => {
    const jsonp =
      '__CP_JSONP__12345({"html":"<div>Hi</div>","css":"body{}","js":"console.log(1);"});';
    const payload = parseCodePenJsonp(jsonp);
    expect(payload.html).toBe('<div>Hi</div>');
    expect(payload.css).toBe('body{}');
    expect(payload.js).toBe('console.log(1);');
  });

  it('parses raw JSON payloads', () => {
    const json = '{"html":"<div></div>","css":"","js":""}';
    const payload = parseCodePenJsonp(json);
    expect(payload.html).toBe('<div></div>');
  });
});

describe('normalizeExternalUrls', () => {
  it('splits string lists into URLs', () => {
    const urls = normalizeExternalUrls(
      'https://cdn.example.com/a.css; https://cdn.example.com/b.css\nhttps://cdn.example.com/c.css'
    );
    expect(urls).toEqual([
      'https://cdn.example.com/a.css',
      'https://cdn.example.com/b.css',
      'https://cdn.example.com/c.css',
    ]);
  });

  it('splits semicolon-delimited URLs without spaces', () => {
    const urls = normalizeExternalUrls(
      'https://cdn.example.com/a.js;https://cdn.example.com/b.js'
    );
    expect(urls).toEqual([
      'https://cdn.example.com/a.js',
      'https://cdn.example.com/b.js',
    ]);
  });

  it('normalizes array inputs', () => {
    const urls = normalizeExternalUrls([
      'https://cdn.example.com/a.js',
      ' ',
      'https://cdn.example.com/b.js',
    ]);
    expect(urls).toEqual([
      'https://cdn.example.com/a.js',
      'https://cdn.example.com/b.js',
    ]);
  });
});

describe('fixtures', () => {
  const fixtures = loadFixtures();

  it('parses JSONP fixtures into normalized ImportInput', () => {
    for (const fixture of fixtures) {
      const payload = parseCodePenJsonp(fixture.jsonp);
      const input = {
        projectName: typeof payload.title === 'string' ? payload.title : '',
        htmlText: payload.html ?? '',
        cssText: payload.css ?? '',
        jsText: payload.js ?? '',
        cssUrls: normalizeExternalUrls(payload.css_external),
        jsUrls: normalizeExternalUrls(payload.js_external),
        provenance: 'codepen' as const,
      };

      expect(input).toEqual(fixture.expectedInput);
    }
  });
});
