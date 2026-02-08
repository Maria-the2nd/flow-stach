import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const CORE_PIPELINE_FILES = [
  "lib/webflow-normalizer.ts",
  "lib/webflow-converter.ts",
  "lib/css-embed-router.ts",
  "lib/webflow-literalizer.ts",
  "lib/gradient-transform-decoupler.ts",
  "audit/runner/pipeline-executor.ts",
];

const BANNED_FIXTURE_TOKENS = [
  "wf-motion-effects-test",
  "flow-party-full",
  "flow-party-warm-serene",
  "flow-party-editorial",
  "flow-bridge-bento",
  "flow-bridge-landing1",
  "flow-bridge-test-all-outputs",
  "box-2d",
];

describe("no fixture hardcoding in core pipeline", () => {
  it("does not contain fixture slugs or fixture-specific class hooks", () => {
    const violations: string[] = [];

    for (const relPath of CORE_PIPELINE_FILES) {
      const absPath = resolve(process.cwd(), relPath);
      const source = readFileSync(absPath, "utf8");
      const lowerSource = source.toLowerCase();

      for (const token of BANNED_FIXTURE_TOKENS) {
        if (lowerSource.includes(token.toLowerCase())) {
          violations.push(`${relPath}: "${token}"`);
        }
      }
    }

    expect(
      violations,
      `Fixture-specific logic detected in core pipeline:\n${violations.join("\n")}`,
    ).toEqual([]);
  });
});
