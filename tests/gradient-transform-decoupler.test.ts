import { describe, it, expect } from "vitest";
import {
  hasGradientTransformConflict,
  detectGradientTransformConflicts,
  decoupleGradientsFromTransforms,
} from "../lib/gradient-transform-decoupler";

describe("gradient-transform decoupler", () => {
  it("detects gradient + transform conflicts", () => {
    expect(
      hasGradientTransformConflict(
        "background: linear-gradient(red, blue); transform: scale(1.05);"
      )
    ).toBe(true);
    expect(hasGradientTransformConflict("background: linear-gradient(red, blue);")).toBe(false);
    expect(hasGradientTransformConflict("transform: scale(1.05);")).toBe(false);
    expect(
      hasGradientTransformConflict("background: linear-gradient(red, blue); will-change: transform;")
    ).toBe(true);
    expect(
      hasGradientTransformConflict("background: linear-gradient(red, blue); transition: transform 0.3s;")
    ).toBe(true);
  });

  it("detects conflicts and provides metadata", () => {
    const css = `.card { 
      background: linear-gradient(red, blue); 
      transform: scale(1.05); 
    }`;
    const conflicts = detectGradientTransformConflicts(css);
    expect(conflicts.length).toBe(1);
    expect(conflicts[0].className).toBe("card");
    expect(conflicts[0].hasGradient).toBe(true);
    expect(conflicts[0].hasTransform).toBe(true);
  });

  it("decouples gradients from transforms (basic)", () => {
    const html = '<div class="card">Content</div>';
    const css = `.card { 
      background: linear-gradient(red, blue); 
      transform: scale(1.05); 
    }`;
    const result = decoupleGradientsFromTransforms(html, css);

    expect(result.rewriteCount).toBe(1);
    expect(result.decoupledClasses).toEqual(["card"]);
    expect(result.html).toContain("card-bg");
    expect(result.css).toContain(".card-bg");
    expect(result.css).toContain("position: relative");
    expect(result.css).toContain("position: absolute");
    expect(result.css).toContain("inset: 0");
  });

  it("preserves original children", () => {
    const html = '<div class="card"><span>Text</span><p>Paragraph</p></div>';
    const css = `.card { 
      background: linear-gradient(red, blue); 
      transform: scale(1.05); 
    }`;
    const result = decoupleGradientsFromTransforms(html, css);
    expect(result.html).toContain("<span>Text</span>");
    expect(result.html).toContain("<p>Paragraph</p>");
  });

  it("handles multiple classes", () => {
    const html = '<div class="card"><div class="button">Button</div></div>';
    const css = `.card { 
      background: linear-gradient(red, blue); 
      transform: scale(1.05); 
    }
    .button {
      background: linear-gradient(green, yellow);
      transform: rotate(45deg);
    }`;
    const result = decoupleGradientsFromTransforms(html, css);

    expect(result.rewriteCount).toBe(2);
    expect(result.decoupledClasses.length).toBe(2);
    expect(result.html).toContain("card-bg");
    expect(result.html).toContain("button-bg");
  });

  it("skips pseudo-elements and handles hover", () => {
    const css = `.card { 
      background: linear-gradient(red, blue); 
      transform: scale(1.05); 
    }
    .card::before {
      background: linear-gradient(green, yellow);
      transform: rotate(45deg);
    }
    .card:hover {
      transform: scale(1.1);
    }`;
    const conflicts = detectGradientTransformConflicts(css);
    expect(conflicts.length).toBe(1);
    expect(conflicts[0].className).toBe("card");

    const html = '<div class="card">Content</div>';
    const result = decoupleGradientsFromTransforms(html, css);
    expect(result.css).toContain(".card:hover");
    expect(result.css).toContain(".card-bg:hover");
  });

  it("preserves media queries", () => {
    const html = '<div class="card">Content</div>';
    const css = `.card { 
      background: linear-gradient(red, blue); 
      transform: scale(1.05); 
    }
    @media (max-width: 767px) {
      .card {
        transform: scale(1.02);
      }
    }`;
    const result = decoupleGradientsFromTransforms(html, css);
    expect(result.css).toContain("@media");
    expect(result.css).toContain(".card-bg");
  });

  it("avoids collision with existing -bg class", () => {
    const html = '<div class="card">Content</div>';
    const css = `.card { 
      background: linear-gradient(red, blue); 
      transform: scale(1.05); 
    }
    .card-bg {
      background-color: red;
    }`;
    const result = decoupleGradientsFromTransforms(html, css);
    expect(result.rewriteCount).toBe(0);
    expect(result.warnings.length).toBe(1);
    expect(result.warnings[0]).toContain("already exists");
  });

  it("supports custom suffix and filtering", () => {
    const html = '<div class="card"><div class="button">Button</div></div>';
    const css = `.card { 
      background: linear-gradient(red, blue); 
      transform: scale(1.05); 
    }
    .button {
      background: linear-gradient(green, yellow);
      transform: rotate(45deg);
    }`;
    const result = decoupleGradientsFromTransforms(html, css, {
      gradientLayerSuffix: "-gradient",
      filterClasses: new Set(["card"]),
    });

    expect(result.rewriteCount).toBe(1);
    expect(result.decoupledClasses).toEqual(["card"]);
    expect(result.html).toContain("card-gradient");
    expect(result.css).toContain(".card-gradient");
  });

  it("preserves gradient-related properties", () => {
    const html = '<div class="card">Content</div>';
    const css = `.card { 
      background-image: linear-gradient(red, blue);
      background-size: cover;
      background-position: center;
      transform: scale(1.05); 
    }`;
    const result = decoupleGradientsFromTransforms(html, css);
    expect(result.css).toContain("background-image");
    expect(result.css).toContain("background-size");
    expect(result.css).toContain("background-position");
  });

  it("preserves shared properties like border-radius", () => {
    const html = '<div class="card">Content</div>';
    const css = `.card { 
      background: linear-gradient(red, blue);
      transform: scale(1.05);
      border-radius: 8px;
    }`;
    const result = decoupleGradientsFromTransforms(html, css);
    expect(result.css).toContain("border-radius: 8px");
  });
});
