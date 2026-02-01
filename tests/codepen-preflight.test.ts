import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { runCodePenPreflight } from '../lib/validation/codepen-preflight';
import type { ImportInput } from '../lib/codepen-resolver';

type CodePenFixture = {
  expectedInput: ImportInput;
  meta?: {
    preprocessors?: string[];
    penUrl?: string;
  };
};

function loadFixture(filename: string): CodePenFixture {
  const fixturesDir = join(__dirname, 'fixtures', 'codepen');
  const content = readFileSync(join(fixturesDir, filename), 'utf-8');
  return JSON.parse(content) as CodePenFixture;
}

describe('runCodePenPreflight', () => {
  it('returns info-only for simple fixture', () => {
    const fixture = loadFixture('simple.json');
    const input = fixture.expectedInput as ImportInput;

    const result = runCodePenPreflight(input, fixture.meta);
    expect(result.blockers).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
    expect(result.infos.length).toBeGreaterThan(0);
  });

  it('classifies blockers and warnings for heavy fixture', () => {
    const fixture = loadFixture('heavy-js.json');
    const input = fixture.expectedInput as ImportInput;

    const result = runCodePenPreflight(input, fixture.meta);

    const blockerCodes = result.blockers.map((item) => item.code);
    const warningCodes = result.warnings.map((item) => item.code);

    expect(blockerCodes).toContain('js.es_modules');
    expect(warningCodes).toContain('html.canvas');
    expect(warningCodes).toContain('html.svg_filters');
    expect(warningCodes).toContain('js.storage_api');
    expect(warningCodes).toContain('js.network');
    expect(warningCodes).toContain('meta.preprocessors');
    expect(warningCodes).toContain('libraries.gsap_version_mismatch');
  });

  it('detects duplicate URLs and jQuery version conflicts', () => {
    const input: ImportInput = {
      projectName: 'Conflict Test',
      htmlText: '<div></div>',
      cssText: '',
      jsText: '',
      cssUrls: ['https://cdn.example.com/a.css', 'https://cdn.example.com/a.css'],
      jsUrls: [
        'https://code.jquery.com/jquery-3.6.0.min.js',
        'https://cdn.jsdelivr.net/npm/jquery@3.7.1/dist/jquery.min.js',
      ],
      provenance: 'codepen',
    };

    const result = runCodePenPreflight(input);
    const warningCodes = result.warnings.map((item) => item.code);

    expect(warningCodes).toContain('libraries.duplicates');
    expect(warningCodes).toContain('libraries.jquery_conflict');
  });
});
