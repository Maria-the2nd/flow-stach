import { describe, it, expect } from 'vitest';
import { loadAllFixtures } from '../fixtures/fixture-loader';
import { ensureWebflowPasteSafety } from '@/lib/webflow-safety-gate';

type WebflowPayload = {
  payload?: {
    nodes?: Array<{ _id?: string; classes?: Array<string | null> }>;
    styles?: Array<{ _id?: string }>;
  };
};

function getMissingStyleRefs(payload: WebflowPayload): string[] {
  const styles = new Set(
    (payload.payload?.styles || [])
      .map((style) => style?._id)
      .filter((id): id is string => typeof id === 'string')
  );

  const missing: string[] = [];
  for (const node of payload.payload?.nodes || []) {
    for (const classRef of node.classes || []) {
      if (typeof classRef === 'string' && !styles.has(classRef)) {
        missing.push(classRef);
      }
    }
  }

  return missing;
}

describe('Style reference integrity', () => {
  it('ensures fixture payloads use style IDs in node.classes', () => {
    const fixtures = loadAllFixtures('valid-patterns');

    fixtures.forEach((fixture) => {
      const missing = getMissingStyleRefs(fixture.payload as unknown as WebflowPayload);
      expect(missing).toEqual([]);
    });
  });

  it('keeps node.classes aligned with styles after sanitization', () => {
    const fixtures = [
      ...loadAllFixtures('valid-patterns'),
      ...loadAllFixtures('crash-patterns'),
    ];

    fixtures.forEach((fixture) => {
      const result = ensureWebflowPasteSafety({
        payload: fixture.payload,
        cssEmbed: (fixture.payload as { embedCSS?: string }).embedCSS,
        jsEmbed: (fixture.payload as { embedJS?: string }).embedJS,
      });

      const missing = getMissingStyleRefs(result.payload as unknown as WebflowPayload);
      expect(missing).toEqual([]);
    });
  });
});
