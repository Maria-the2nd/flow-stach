import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { resolveCodePen } from '../lib/codepen-resolver';
import { runCodePenPreflight } from '../lib/validation/codepen-preflight';
import { processProjectImport } from '../lib/project-engine';

function loadFixtureJsonp(filename: string): string {
  const fixturesDir = join(__dirname, 'fixtures', 'codepen');
  const content = readFileSync(join(fixturesDir, filename), 'utf-8');
  const fixture = JSON.parse(content) as { jsonp: string };
  return fixture.jsonp;
}

describe('codepen integration (resolver -> preflight -> pipeline)', () => {
  let originalFetch: typeof fetch;

  beforeEach(() => {
    const jsonp = loadFixtureJsonp('simple.json');

    // Save original fetch
    originalFetch = globalThis.fetch;

    // Mock fetch
    globalThis.fetch = async (input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('codepen.io')) {
        return {
          ok: true,
          status: 200,
          text: async () => jsonp,
          json: async () => ({ ok: true }),
        } as Response;
      }

      if (url.includes('/api/flowbridge/semantic')) {
        return {
          ok: false,
          status: 500,
          text: async () => '',
          json: async () => ({ ok: false }),
        } as Response;
      }

      return {
        ok: false,
        status: 404,
        text: async () => '',
        json: async () => ({ ok: false }),
      } as Response;
    };
  });

  afterEach(() => {
    // Restore original fetch
    globalThis.fetch = originalFetch;
  });

  it('resolves, preflights, and processes without network', async () => {
    const resolved = await resolveCodePen('https://codepen.io/testuser/pen/simple');
    const preflight = runCodePenPreflight(resolved.input, resolved.meta);

    expect(preflight.blockers).toHaveLength(0);

    const result = await processProjectImport(
      resolved.input.htmlText,
      resolved.input.projectName,
      () => {}
    );

    expect(result.projectName).toBeTruthy();
    expect(result.artifacts.cleanHtml).toBeTruthy();
  });
});
