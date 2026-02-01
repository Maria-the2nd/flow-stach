/**
 * Tests for nth-child to BEM converter
 */

import { describe, expect, test } from "vitest";
import {
  convertNthChildToBem,
  applyNthChildModifiersToHtml,
  applyFirstLastChildModifiersToHtml,
  applyOddEvenModifiersToHtml,
  applyAnFormulaModifiersToHtml,
  applyAnPlusBModifiersToHtml,
  applyNthLastChildModifiersToHtml,
  removeConvertedNthChildRules,
  removeConvertedFirstLastChildRules,
  removeConvertedOddEvenRules,
  removeConvertedAnFormulaRules,
  removeConvertedAnPlusBRules,
  removeConvertedNthLastChildRules,
} from "../lib/nth-child-converter";

describe("nth-child to BEM Converter", () => {
  describe("convertNthChildToBem", () => {
    test("converts simple numeric nth-child rules to BEM modifiers", () => {
      const css = `
        .step-card:nth-child(1) { background: #aefbff; }
        .step-card:nth-child(2) { background: #f6bbfd; }
        .step-card:nth-child(3) { background: #ffff94; }
      `;

      const result = convertNthChildToBem(css);

      expect(result.report.totalFound).toBe(3);
      expect(result.report.converted).toBe(3);
      expect(result.htmlInjections.length).toBe(3);

      // Check semantic color naming
      const injectionNames = result.htmlInjections.map(i => i.modifierClass);
      expect(injectionNames).toContain("step-card-cyan");
      expect(injectionNames).toContain("step-card-pink");
      expect(injectionNames).toContain("step-card-yellow");
    });

    test("uses numbered modifiers when colors are not recognizable", () => {
      const css = `
        .item:nth-child(1) { transform: rotate(10deg); }
        .item:nth-child(2) { transform: rotate(20deg); }
      `;

      const result = convertNthChildToBem(css);

      expect(result.report.converted).toBe(2);
      expect(result.htmlInjections[0].modifierClass).toBe("item-1");
      expect(result.htmlInjections[1].modifierClass).toBe("item-2");
    });

    test("leaves truly complex nth-child expressions unconverted", () => {
      const css = `
        .card:nth-child(-n+3) { padding: 5px; }
        .card:nth-child(n+5) { margin: 10px; }
      `;

      const result = convertNthChildToBem(css);

      // Complex expressions (negative or no coefficient) should be left unconverted
      expect(result.report.converted).toBe(0);
      expect(result.report.leftInEmbed).toBe(2);
      expect(result.unconvertedCss).toContain(":nth-child(-n+3)");
      expect(result.unconvertedCss).toContain(":nth-child(n+5)");
    });

    test("converts simple nth-child and odd/even independently", () => {
      const css = `
        .card:nth-child(odd) { background: #fff; }
        .simple:nth-child(1) { color: #aefbff; }
        .simple:nth-child(2) { color: #f6bbfd; }
      `;

      const result = convertNthChildToBem(css);

      // All rules should be converted (odd is now supported)
      expect(result.report.converted).toBe(3);
      expect(result.report.leftInEmbed).toBe(0);
      expect(result.convertedCss).toContain(".card-odd");
      expect(result.convertedCss).toContain(".simple-cyan");
      expect(result.convertedCss).toContain(".simple-pink");
    });

    test("handles multiple base classes independently", () => {
      const css = `
        .step-card:nth-child(1) { background: #aefbff; }
        .step-card:nth-child(2) { background: #f6bbfd; }
        .bento-stat:nth-child(1) { background: #ffff94; }
        .bento-stat:nth-child(2) { background: #f6bbfd; }
      `;

      const result = convertNthChildToBem(css);

      expect(result.report.converted).toBe(4);

      // Check step-card injections
      const stepCardInjections = result.htmlInjections.filter(i => i.baseClass === "step-card");
      expect(stepCardInjections.length).toBe(2);

      // Check bento-stat injections
      const bentoStatInjections = result.htmlInjections.filter(i => i.baseClass === "bento-stat");
      expect(bentoStatInjections.length).toBe(2);
    });

    test("returns empty results when no nth-child rules present", () => {
      const css = `
        .card { background: blue; }
        .card:hover { background: red; }
      `;

      const result = convertNthChildToBem(css);

      expect(result.report.totalFound).toBe(0);
      expect(result.report.converted).toBe(0);
      expect(result.htmlInjections.length).toBe(0);
    });
  });

  describe("applyNthChildModifiersToHtml", () => {
    test("adds modifier classes to elements based on position", () => {
      const html = `
        <div class="step-card">Card 1</div>
        <div class="step-card">Card 2</div>
        <div class="step-card">Card 3</div>
      `;

      const injections = [
        { baseClass: "step-card", position: 1, modifierClass: "step-card-cyan" },
        { baseClass: "step-card", position: 2, modifierClass: "step-card-pink" },
        { baseClass: "step-card", position: 3, modifierClass: "step-card-yellow" },
      ];

      const result = applyNthChildModifiersToHtml(html, injections);

      expect(result).toContain('class="step-card step-card-cyan"');
      expect(result).toContain('class="step-card step-card-pink"');
      expect(result).toContain('class="step-card step-card-yellow"');
    });

    test("handles elements with multiple classes", () => {
      const html = `
        <div class="step-card featured">Card 1</div>
        <div class="step-card">Card 2</div>
      `;

      const injections = [
        { baseClass: "step-card", position: 1, modifierClass: "step-card-cyan" },
        { baseClass: "step-card", position: 2, modifierClass: "step-card-pink" },
      ];

      const result = applyNthChildModifiersToHtml(html, injections);

      expect(result).toContain('class="step-card step-card-cyan featured"');
      expect(result).toContain('class="step-card step-card-pink"');
    });

    test("returns unchanged HTML when no injections", () => {
      const html = '<div class="card">Content</div>';
      const result = applyNthChildModifiersToHtml(html, []);
      expect(result).toBe(html);
    });
  });

  describe("removeConvertedNthChildRules", () => {
    test("removes converted nth-child rules from CSS", () => {
      const css = `
        .step-card { padding: 20px; }
        .step-card:nth-child(1) { background: #aefbff; }
        .step-card:nth-child(2) { background: #f6bbfd; }
        .other-class { color: red; }
      `;

      const injections = [
        { baseClass: "step-card", position: 1, modifierClass: "step-card-cyan" },
        { baseClass: "step-card", position: 2, modifierClass: "step-card-pink" },
      ];

      const result = removeConvertedNthChildRules(css, injections);

      expect(result).toContain(".step-card { padding: 20px; }");
      expect(result).toContain(".other-class { color: red; }");
      expect(result).not.toContain(":nth-child(1)");
      expect(result).not.toContain(":nth-child(2)");
    });
  });

  describe("semantic color naming", () => {
    test("recognizes cyan family colors", () => {
      const css = `.card:nth-child(1) { background: #aefbff; }`;
      const result = convertNthChildToBem(css);
      expect(result.htmlInjections[0].modifierClass).toBe("card-cyan");
    });

    test("recognizes pink family colors", () => {
      const css = `.card:nth-child(1) { background: #f6bbfd; }`;
      const result = convertNthChildToBem(css);
      expect(result.htmlInjections[0].modifierClass).toBe("card-pink");
    });

    test("recognizes yellow family colors", () => {
      const css = `.card:nth-child(1) { background: #ffff94; }`;
      const result = convertNthChildToBem(css);
      expect(result.htmlInjections[0].modifierClass).toBe("card-yellow");
    });

    test("recognizes green family colors", () => {
      const css = `.card:nth-child(1) { background: #82eda6; }`;
      const result = convertNthChildToBem(css);
      expect(result.htmlInjections[0].modifierClass).toBe("card-green");
    });

    test("recognizes purple family colors", () => {
      const css = `.card:nth-child(1) { background: #c88cfd; }`;
      const result = convertNthChildToBem(css);
      expect(result.htmlInjections[0].modifierClass).toBe("card-purple");
    });

    test("recognizes blue family colors", () => {
      const css = `.card:nth-child(1) { background: #589af0; }`;
      const result = convertNthChildToBem(css);
      expect(result.htmlInjections[0].modifierClass).toBe("card-blue");
    });

    test("recognizes orange family colors", () => {
      const css = `.card:nth-child(1) { background: #fdc068; }`;
      const result = convertNthChildToBem(css);
      expect(result.htmlInjections[0].modifierClass).toBe("card-orange");
    });
  });

  describe("integration with normalizer", () => {
    test("full conversion flow for step-card example", () => {
      // This is the actual CSS from flow-bridge-bento.html
      const css = `
        .step-card:nth-child(1){background:#aefbff}
        .step-card:nth-child(2){background:#f6bbfd}
        .step-card:nth-child(3){background:#ffff94}
      `;

      const html = `
        <div class="step-card">
          <span class="step-number">01</span>
          <h3>PASTE</h3>
        </div>
        <div class="step-card">
          <span class="step-number">02</span>
          <h3>CONVERT</h3>
        </div>
        <div class="step-card">
          <span class="step-number">03</span>
          <h3>PERFECT</h3>
        </div>
      `;

      // Step 1: Convert CSS
      const cssResult = convertNthChildToBem(css);
      expect(cssResult.report.converted).toBe(3);

      // Step 2: Apply to HTML
      const modifiedHtml = applyNthChildModifiersToHtml(html, cssResult.htmlInjections);

      // Verify HTML has modifier classes
      expect(modifiedHtml).toContain("step-card-cyan");
      expect(modifiedHtml).toContain("step-card-pink");
      expect(modifiedHtml).toContain("step-card-yellow");

      // Step 3: Verify CSS has BEM classes
      expect(cssResult.convertedCss).toContain(".step-card-cyan");
      expect(cssResult.convertedCss).toContain(".step-card-pink");
      expect(cssResult.convertedCss).toContain(".step-card-yellow");
      expect(cssResult.convertedCss).toContain("background");
    });
  });

  describe(":first-child and :last-child support", () => {
    test("converts :first-child rules to BEM modifiers", () => {
      const css = `
        .card:first-child { border-radius: 20px 20px 0 0; }
      `;

      const result = convertNthChildToBem(css);

      expect(result.report.totalFound).toBe(1);
      expect(result.report.converted).toBe(1);
      expect(result.firstLastInjections.length).toBe(1);
      expect(result.firstLastInjections[0].type).toBe("first");
      expect(result.firstLastInjections[0].modifierClass).toBe("card-first");
      expect(result.convertedCss).toContain(".card-first");
      expect(result.convertedCss).toContain("border-radius");
    });

    test("converts :last-child rules to BEM modifiers", () => {
      const css = `
        .card:last-child { border-radius: 0 0 20px 20px; margin-bottom: 0; }
      `;

      const result = convertNthChildToBem(css);

      expect(result.report.totalFound).toBe(1);
      expect(result.report.converted).toBe(1);
      expect(result.firstLastInjections.length).toBe(1);
      expect(result.firstLastInjections[0].type).toBe("last");
      expect(result.firstLastInjections[0].modifierClass).toBe("card-last");
      expect(result.convertedCss).toContain(".card-last");
      expect(result.convertedCss).toContain("margin-bottom");
    });

    test("converts both :first-child and :last-child for same class", () => {
      const css = `
        .card:first-child { border-radius: 20px 20px 0 0; }
        .card:last-child { border-radius: 0 0 20px 20px; }
      `;

      const result = convertNthChildToBem(css);

      expect(result.report.converted).toBe(2);
      expect(result.firstLastInjections.length).toBe(2);

      const firstInjection = result.firstLastInjections.find(i => i.type === "first");
      const lastInjection = result.firstLastInjections.find(i => i.type === "last");

      expect(firstInjection?.modifierClass).toBe("card-first");
      expect(lastInjection?.modifierClass).toBe("card-last");
    });

    test("handles multiple classes with first/last-child", () => {
      const css = `
        .card:first-child { border-radius: 20px; }
        .item:last-child { margin-bottom: 0; }
      `;

      const result = convertNthChildToBem(css);

      expect(result.report.converted).toBe(2);
      expect(result.firstLastInjections.length).toBe(2);

      const cardInjection = result.firstLastInjections.find(i => i.baseClass === "card");
      const itemInjection = result.firstLastInjections.find(i => i.baseClass === "item");

      expect(cardInjection?.modifierClass).toBe("card-first");
      expect(itemInjection?.modifierClass).toBe("item-last");
    });
  });

  describe("applyFirstLastChildModifiersToHtml", () => {
    test("adds -first modifier to first element", () => {
      const html = `
        <div class="card">Card 1</div>
        <div class="card">Card 2</div>
        <div class="card">Card 3</div>
      `;

      const injections = [
        { baseClass: "card", type: "first" as const, modifierClass: "card-first" },
      ];

      const result = applyFirstLastChildModifiersToHtml(html, injections);

      expect(result).toContain('class="card card-first"');
      // Only first element should have the modifier
      expect(result.match(/card-first/g)?.length).toBe(1);
    });

    test("adds -last modifier to last element", () => {
      const html = `
        <div class="card">Card 1</div>
        <div class="card">Card 2</div>
        <div class="card">Card 3</div>
      `;

      const injections = [
        { baseClass: "card", type: "last" as const, modifierClass: "card-last" },
      ];

      const result = applyFirstLastChildModifiersToHtml(html, injections);

      expect(result).toContain('class="card card-last"');
      // Only last element should have the modifier
      expect(result.match(/card-last/g)?.length).toBe(1);
    });

    test("adds both -first and -last modifiers", () => {
      const html = `
        <div class="card">Card 1</div>
        <div class="card">Card 2</div>
        <div class="card">Card 3</div>
      `;

      const injections = [
        { baseClass: "card", type: "first" as const, modifierClass: "card-first" },
        { baseClass: "card", type: "last" as const, modifierClass: "card-last" },
      ];

      const result = applyFirstLastChildModifiersToHtml(html, injections);

      expect(result).toContain('class="card card-first"');
      expect(result).toContain('class="card card-last"');
      expect(result.match(/card-first/g)?.length).toBe(1);
      expect(result.match(/card-last/g)?.length).toBe(1);
    });

    test("handles single element with both first and last", () => {
      const html = `<div class="card">Only Card</div>`;

      const injections = [
        { baseClass: "card", type: "first" as const, modifierClass: "card-first" },
        { baseClass: "card", type: "last" as const, modifierClass: "card-last" },
      ];

      const result = applyFirstLastChildModifiersToHtml(html, injections);

      // Single element should get both modifiers
      expect(result).toContain("card-first");
      expect(result).toContain("card-last");
    });
  });

  describe("removeConvertedFirstLastChildRules", () => {
    test("removes converted first-child rules from CSS", () => {
      const css = `
        .card { padding: 20px; }
        .card:first-child { border-radius: 20px 20px 0 0; }
        .card:last-child { border-radius: 0 0 20px 20px; }
        .other-class { color: red; }
      `;

      const injections = [
        { baseClass: "card", type: "first" as const, modifierClass: "card-first" },
        { baseClass: "card", type: "last" as const, modifierClass: "card-last" },
      ];

      const result = removeConvertedFirstLastChildRules(css, injections);

      expect(result).toContain(".card { padding: 20px; }");
      expect(result).toContain(".other-class { color: red; }");
      expect(result).not.toContain(":first-child");
      expect(result).not.toContain(":last-child");
    });
  });

  describe("combined nth-child with first/last-child", () => {
    test("converts both nth-child and first/last-child in same CSS", () => {
      const css = `
        .card:first-child { border-radius: 20px 20px 0 0; }
        .card:nth-child(2) { background: #f6bbfd; }
        .card:last-child { border-radius: 0 0 20px 20px; }
      `;

      const result = convertNthChildToBem(css);

      // Should convert all 3 rules
      expect(result.report.converted).toBe(3);

      // Should have 2 first/last injections
      expect(result.firstLastInjections.length).toBe(2);

      // Should have 1 nth-child injection
      expect(result.htmlInjections.length).toBe(1);

      // Check CSS output
      expect(result.convertedCss).toContain(".card-first");
      expect(result.convertedCss).toContain(".card-last");
      expect(result.convertedCss).toContain(".card-pink");
    });
  });

  describe(":nth-child(odd) and :nth-child(even) support", () => {
    test("converts :nth-child(odd) to BEM modifiers", () => {
      const css = `
        .row:nth-child(odd) { background: #f5f5f5; }
      `;

      const result = convertNthChildToBem(css);

      expect(result.report.totalFound).toBe(1);
      expect(result.report.converted).toBe(1);
      expect(result.oddEvenInjections.length).toBe(1);
      expect(result.oddEvenInjections[0].type).toBe("odd");
      expect(result.oddEvenInjections[0].modifierClass).toBe("row-odd");
      expect(result.convertedCss).toContain(".row-odd");
      expect(result.convertedCss).toContain("background: #f5f5f5");
    });

    test("converts :nth-child(even) to BEM modifiers", () => {
      const css = `
        .row:nth-child(even) { background: #ffffff; }
      `;

      const result = convertNthChildToBem(css);

      expect(result.report.totalFound).toBe(1);
      expect(result.report.converted).toBe(1);
      expect(result.oddEvenInjections.length).toBe(1);
      expect(result.oddEvenInjections[0].type).toBe("even");
      expect(result.oddEvenInjections[0].modifierClass).toBe("row-even");
      expect(result.convertedCss).toContain(".row-even");
    });

    test("converts both odd and even for same class", () => {
      const css = `
        .row:nth-child(odd) { background: #f5f5f5; }
        .row:nth-child(even) { background: #ffffff; }
      `;

      const result = convertNthChildToBem(css);

      expect(result.report.converted).toBe(2);
      expect(result.oddEvenInjections.length).toBe(2);

      const oddInjection = result.oddEvenInjections.find(i => i.type === "odd");
      const evenInjection = result.oddEvenInjections.find(i => i.type === "even");

      expect(oddInjection?.modifierClass).toBe("row-odd");
      expect(evenInjection?.modifierClass).toBe("row-even");

      expect(result.convertedCss).toContain(".row-odd");
      expect(result.convertedCss).toContain(".row-even");
    });

    test("handles case-insensitive odd/even", () => {
      const css = `
        .row:nth-child(ODD) { background: #f5f5f5; }
        .row:nth-child(EVEN) { background: #ffffff; }
      `;

      const result = convertNthChildToBem(css);

      expect(result.report.converted).toBe(2);
      expect(result.oddEvenInjections.length).toBe(2);
    });
  });

  describe("applyOddEvenModifiersToHtml", () => {
    test("adds -odd modifier to odd position elements", () => {
      const html = `
        <div class="row">Row 1</div>
        <div class="row">Row 2</div>
        <div class="row">Row 3</div>
        <div class="row">Row 4</div>
      `;

      const injections = [
        { baseClass: "row", type: "odd" as const, modifierClass: "row-odd" },
      ];

      const result = applyOddEvenModifiersToHtml(html, injections);

      // Should have 2 odd classes (positions 1 and 3)
      expect(result.match(/row-odd/g)?.length).toBe(2);
    });

    test("adds -even modifier to even position elements", () => {
      const html = `
        <div class="row">Row 1</div>
        <div class="row">Row 2</div>
        <div class="row">Row 3</div>
        <div class="row">Row 4</div>
      `;

      const injections = [
        { baseClass: "row", type: "even" as const, modifierClass: "row-even" },
      ];

      const result = applyOddEvenModifiersToHtml(html, injections);

      // Should have 2 even classes (positions 2 and 4)
      expect(result.match(/row-even/g)?.length).toBe(2);
    });

    test("adds both -odd and -even modifiers alternating", () => {
      const html = `
        <div class="row">Row 1</div>
        <div class="row">Row 2</div>
        <div class="row">Row 3</div>
        <div class="row">Row 4</div>
      `;

      const injections = [
        { baseClass: "row", type: "odd" as const, modifierClass: "row-odd" },
        { baseClass: "row", type: "even" as const, modifierClass: "row-even" },
      ];

      const result = applyOddEvenModifiersToHtml(html, injections);

      // Should have 2 odd and 2 even classes
      expect(result.match(/row-odd/g)?.length).toBe(2);
      expect(result.match(/row-even/g)?.length).toBe(2);

      // First and third should be odd
      expect(result).toContain('class="row row-odd">Row 1');
      expect(result).toContain('class="row row-odd">Row 3');

      // Second and fourth should be even
      expect(result).toContain('class="row row-even">Row 2');
      expect(result).toContain('class="row row-even">Row 4');
    });
  });

  describe("removeConvertedOddEvenRules", () => {
    test("removes converted odd/even rules from CSS", () => {
      const css = `
        .row { padding: 10px; }
        .row:nth-child(odd) { background: #f5f5f5; }
        .row:nth-child(even) { background: #ffffff; }
        .other { color: red; }
      `;

      const injections = [
        { baseClass: "row", type: "odd" as const, modifierClass: "row-odd" },
        { baseClass: "row", type: "even" as const, modifierClass: "row-even" },
      ];

      const result = removeConvertedOddEvenRules(css, injections);

      expect(result).toContain(".row { padding: 10px; }");
      expect(result).toContain(".other { color: red; }");
      expect(result).not.toContain(":nth-child(odd)");
      expect(result).not.toContain(":nth-child(even)");
    });
  });

  describe("zebra striping full flow", () => {
    test("full conversion flow for table rows", () => {
      const css = `
        .table-row:nth-child(odd) { background: #f9fafb; }
        .table-row:nth-child(even) { background: #ffffff; }
      `;

      const html = `
        <div class="table-row">Row 1</div>
        <div class="table-row">Row 2</div>
        <div class="table-row">Row 3</div>
        <div class="table-row">Row 4</div>
        <div class="table-row">Row 5</div>
      `;

      // Step 1: Convert CSS
      const cssResult = convertNthChildToBem(css);
      expect(cssResult.report.converted).toBe(2);

      // Step 2: Apply to HTML
      const modifiedHtml = applyOddEvenModifiersToHtml(html, cssResult.oddEvenInjections);

      // Verify alternating pattern
      expect(modifiedHtml).toContain('class="table-row table-row-odd">Row 1');
      expect(modifiedHtml).toContain('class="table-row table-row-even">Row 2');
      expect(modifiedHtml).toContain('class="table-row table-row-odd">Row 3');
      expect(modifiedHtml).toContain('class="table-row table-row-even">Row 4');
      expect(modifiedHtml).toContain('class="table-row table-row-odd">Row 5');

      // Step 3: Verify CSS has BEM classes
      expect(cssResult.convertedCss).toContain(".table-row-odd");
      expect(cssResult.convertedCss).toContain(".table-row-even");
    });
  });

  describe(":nth-child(Nn) simple an formula support", () => {
    test("converts :nth-child(3n) to BEM modifier (every 3rd)", () => {
      const css = `
        .item:nth-child(3n) { margin-right: 0; }
      `;

      const result = convertNthChildToBem(css);

      expect(result.report.totalFound).toBe(1);
      expect(result.report.converted).toBe(1);
      expect(result.anFormulaInjections.length).toBe(1);
      expect(result.anFormulaInjections[0].coefficient).toBe(3);
      expect(result.anFormulaInjections[0].modifierClass).toBe("item-every-3rd");
      expect(result.convertedCss).toContain(".item-every-3rd");
    });

    test("converts :nth-child(4n) to BEM modifier (every 4th)", () => {
      const css = `
        .grid-item:nth-child(4n) { margin-right: 0; }
      `;

      const result = convertNthChildToBem(css);

      expect(result.report.converted).toBe(1);
      expect(result.anFormulaInjections[0].modifierClass).toBe("grid-item-every-4th");
    });

    test("converts :nth-child(2n) to BEM modifier (every 2nd)", () => {
      const css = `
        .col:nth-child(2n) { padding-right: 0; }
      `;

      const result = convertNthChildToBem(css);

      expect(result.report.converted).toBe(1);
      expect(result.anFormulaInjections[0].modifierClass).toBe("col-every-2nd");
    });

    test("handles multiple an formulas for same class", () => {
      const css = `
        .item:nth-child(3n) { margin-right: 0; }
        .item:nth-child(6n) { background: #f5f5f5; }
      `;

      const result = convertNthChildToBem(css);

      expect(result.report.converted).toBe(2);
      expect(result.anFormulaInjections.length).toBe(2);

      const injection3n = result.anFormulaInjections.find(i => i.coefficient === 3);
      const injection6n = result.anFormulaInjections.find(i => i.coefficient === 6);

      expect(injection3n?.modifierClass).toBe("item-every-3rd");
      expect(injection6n?.modifierClass).toBe("item-every-6th");
    });

    test("handles large coefficients up to 12n", () => {
      const css = `
        .item:nth-child(12n) { page-break-after: always; }
      `;

      const result = convertNthChildToBem(css);

      expect(result.report.converted).toBe(1);
      expect(result.anFormulaInjections[0].modifierClass).toBe("item-every-12th");
    });
  });

  describe("applyAnFormulaModifiersToHtml", () => {
    test("adds modifier to every 3rd element", () => {
      const html = `
        <div class="item">Item 1</div>
        <div class="item">Item 2</div>
        <div class="item">Item 3</div>
        <div class="item">Item 4</div>
        <div class="item">Item 5</div>
        <div class="item">Item 6</div>
      `;

      const injections = [
        { baseClass: "item", coefficient: 3, modifierClass: "item-every-3rd" },
      ];

      const result = applyAnFormulaModifiersToHtml(html, injections);

      // Should have 2 occurrences (positions 3 and 6)
      expect(result.match(/item-every-3rd/g)?.length).toBe(2);

      // Position 3 and 6 should have the modifier
      expect(result).not.toContain('class="item item-every-3rd">Item 1');
      expect(result).not.toContain('class="item item-every-3rd">Item 2');
      expect(result).toContain('class="item item-every-3rd">Item 3');
      expect(result).not.toContain('class="item item-every-3rd">Item 4');
      expect(result).not.toContain('class="item item-every-3rd">Item 5');
      expect(result).toContain('class="item item-every-3rd">Item 6');
    });

    test("adds modifier to every 4th element in grid", () => {
      const html = `
        <div class="grid-item">1</div>
        <div class="grid-item">2</div>
        <div class="grid-item">3</div>
        <div class="grid-item">4</div>
        <div class="grid-item">5</div>
        <div class="grid-item">6</div>
        <div class="grid-item">7</div>
        <div class="grid-item">8</div>
      `;

      const injections = [
        { baseClass: "grid-item", coefficient: 4, modifierClass: "grid-item-every-4th" },
      ];

      const result = applyAnFormulaModifiersToHtml(html, injections);

      // Should have 2 occurrences (positions 4 and 8)
      expect(result.match(/grid-item-every-4th/g)?.length).toBe(2);
    });
  });

  describe("removeConvertedAnFormulaRules", () => {
    test("removes converted an formula rules from CSS", () => {
      const css = `
        .item { padding: 10px; }
        .item:nth-child(3n) { margin-right: 0; }
        .other { color: red; }
      `;

      const injections = [
        { baseClass: "item", coefficient: 3, modifierClass: "item-every-3rd" },
      ];

      const result = removeConvertedAnFormulaRules(css, injections);

      expect(result).toContain(".item { padding: 10px; }");
      expect(result).toContain(".other { color: red; }");
      expect(result).not.toContain(":nth-child(3n)");
    });
  });

  describe("grid layout full flow (every Nth)", () => {
    test("full conversion flow for 3-column grid", () => {
      const css = `
        .grid-item:nth-child(3n) { margin-right: 0; }
      `;

      const html = `
        <div class="grid-item">1</div>
        <div class="grid-item">2</div>
        <div class="grid-item">3</div>
        <div class="grid-item">4</div>
        <div class="grid-item">5</div>
        <div class="grid-item">6</div>
      `;

      // Step 1: Convert CSS
      const cssResult = convertNthChildToBem(css);
      expect(cssResult.report.converted).toBe(1);
      expect(cssResult.anFormulaInjections.length).toBe(1);

      // Step 2: Apply to HTML
      const modifiedHtml = applyAnFormulaModifiersToHtml(html, cssResult.anFormulaInjections);

      // Verify only 3rd and 6th have modifier
      expect(modifiedHtml.match(/grid-item-every-3rd/g)?.length).toBe(2);
      expect(modifiedHtml).toContain('class="grid-item grid-item-every-3rd">3');
      expect(modifiedHtml).toContain('class="grid-item grid-item-every-3rd">6');

      // Step 3: Verify CSS has BEM class
      expect(cssResult.convertedCss).toContain(".grid-item-every-3rd");
      expect(cssResult.convertedCss).toContain("margin-right: 0");
    });
  });

  describe(":nth-child(an+b) offset formula support", () => {
    test("converts :nth-child(6n+1) to BEM modifier (slot 1 in 6-cycle)", () => {
      const css = `
        .grid-item:nth-child(6n+1) { width: 100%; }
      `;

      const result = convertNthChildToBem(css);

      expect(result.report.totalFound).toBe(1);
      expect(result.report.converted).toBe(1);
      expect(result.anPlusBInjections.length).toBe(1);
      expect(result.anPlusBInjections[0].cycleLength).toBe(6);
      expect(result.anPlusBInjections[0].slotPosition).toBe(1);
      expect(result.anPlusBInjections[0].modifierClass).toBe("grid-item-slot-1");
      expect(result.convertedCss).toContain(".grid-item-slot-1");
    });

    test("converts :nth-child(6n+2) and :nth-child(6n+3) for editorial grid", () => {
      const css = `
        .grid-item:nth-child(6n+1) { width: 100%; }
        .grid-item:nth-child(6n+2) { width: 50%; }
        .grid-item:nth-child(6n+3) { width: 50%; }
      `;

      const result = convertNthChildToBem(css);

      expect(result.report.converted).toBe(3);
      expect(result.anPlusBInjections.length).toBe(3);

      const slot1 = result.anPlusBInjections.find(i => i.slotPosition === 1);
      const slot2 = result.anPlusBInjections.find(i => i.slotPosition === 2);
      const slot3 = result.anPlusBInjections.find(i => i.slotPosition === 3);

      expect(slot1?.modifierClass).toBe("grid-item-slot-1");
      expect(slot2?.modifierClass).toBe("grid-item-slot-2");
      expect(slot3?.modifierClass).toBe("grid-item-slot-3");
    });

    test("converts :nth-child(3n+1) for 3-column layout", () => {
      const css = `
        .col:nth-child(3n+1) { clear: left; }
      `;

      const result = convertNthChildToBem(css);

      expect(result.report.converted).toBe(1);
      expect(result.anPlusBInjections[0].cycleLength).toBe(3);
      expect(result.anPlusBInjections[0].slotPosition).toBe(1);
      expect(result.anPlusBInjections[0].modifierClass).toBe("col-slot-1");
    });

    test("handles negative offset formulas like 6n-1", () => {
      const css = `
        .item:nth-child(6n-1) { background: #f5f5f5; }
      `;

      const result = convertNthChildToBem(css);

      expect(result.report.converted).toBe(1);
      // 6n-1 = positions 5, 11, 17, etc. = slot 5 in 6-cycle
      expect(result.anPlusBInjections[0].slotPosition).toBe(5);
      expect(result.anPlusBInjections[0].modifierClass).toBe("item-slot-5");
    });
  });

  describe("applyAnPlusBModifiersToHtml", () => {
    test("adds modifier to correct slot positions in 6-cycle", () => {
      const html = `
        <div class="grid-item">1</div>
        <div class="grid-item">2</div>
        <div class="grid-item">3</div>
        <div class="grid-item">4</div>
        <div class="grid-item">5</div>
        <div class="grid-item">6</div>
        <div class="grid-item">7</div>
        <div class="grid-item">8</div>
      `;

      const injections = [
        { baseClass: "grid-item", cycleLength: 6, slotPosition: 1, modifierClass: "grid-item-slot-1" },
        { baseClass: "grid-item", cycleLength: 6, slotPosition: 2, modifierClass: "grid-item-slot-2" },
      ];

      const result = applyAnPlusBModifiersToHtml(html, injections);

      // Slot 1: positions 1, 7 (1 + 6*k)
      expect(result).toContain('class="grid-item grid-item-slot-1">1');
      expect(result).toContain('class="grid-item grid-item-slot-1">7');

      // Slot 2: positions 2, 8 (2 + 6*k)
      expect(result).toContain('class="grid-item grid-item-slot-2">2');
      expect(result).toContain('class="grid-item grid-item-slot-2">8');

      // Count occurrences
      expect(result.match(/grid-item-slot-1/g)?.length).toBe(2);
      expect(result.match(/grid-item-slot-2/g)?.length).toBe(2);
    });

    test("Pattern 6 editorial grid full cycle", () => {
      const html = `
        <div class="card">1</div>
        <div class="card">2</div>
        <div class="card">3</div>
        <div class="card">4</div>
        <div class="card">5</div>
        <div class="card">6</div>
      `;

      const injections = [
        { baseClass: "card", cycleLength: 6, slotPosition: 1, modifierClass: "card-slot-1" },
        { baseClass: "card", cycleLength: 6, slotPosition: 2, modifierClass: "card-slot-2" },
        { baseClass: "card", cycleLength: 6, slotPosition: 3, modifierClass: "card-slot-3" },
        { baseClass: "card", cycleLength: 6, slotPosition: 4, modifierClass: "card-slot-4" },
        { baseClass: "card", cycleLength: 6, slotPosition: 5, modifierClass: "card-slot-5" },
        { baseClass: "card", cycleLength: 6, slotPosition: 6, modifierClass: "card-slot-6" },
      ];

      const result = applyAnPlusBModifiersToHtml(html, injections);

      // Each card should have its slot modifier
      expect(result).toContain('class="card card-slot-1">1');
      expect(result).toContain('class="card card-slot-2">2');
      expect(result).toContain('class="card card-slot-3">3');
      expect(result).toContain('class="card card-slot-4">4');
      expect(result).toContain('class="card card-slot-5">5');
      expect(result).toContain('class="card card-slot-6">6');
    });
  });

  describe("removeConvertedAnPlusBRules", () => {
    test("removes converted an+b rules from CSS", () => {
      const css = `
        .grid-item { display: block; }
        .grid-item:nth-child(6n+1) { width: 100%; }
        .grid-item:nth-child(6n+2) { width: 50%; }
        .other { color: red; }
      `;

      const injections = [
        { baseClass: "grid-item", cycleLength: 6, slotPosition: 1, modifierClass: "grid-item-slot-1" },
        { baseClass: "grid-item", cycleLength: 6, slotPosition: 2, modifierClass: "grid-item-slot-2" },
      ];

      const result = removeConvertedAnPlusBRules(css, injections);

      expect(result).toContain(".grid-item { display: block; }");
      expect(result).toContain(".other { color: red; }");
      expect(result).not.toContain(":nth-child(6n+1)");
      expect(result).not.toContain(":nth-child(6n+2)");
    });
  });

  describe("Pattern 6 editorial grid full flow", () => {
    test("full conversion flow for magazine-style layout", () => {
      const css = `
        .grid-item:nth-child(6n+1) { width: 100%; }
        .grid-item:nth-child(6n+2) { width: 50%; }
        .grid-item:nth-child(6n+3) { width: 50%; }
        .grid-item:nth-child(6n+4) { width: 33.33%; }
        .grid-item:nth-child(6n+5) { width: 33.33%; }
        .grid-item:nth-child(6n+6) { width: 33.33%; }
      `;

      const html = `
        <div class="grid-item">Hero</div>
        <div class="grid-item">Left</div>
        <div class="grid-item">Right</div>
        <div class="grid-item">Third 1</div>
        <div class="grid-item">Third 2</div>
        <div class="grid-item">Third 3</div>
        <div class="grid-item">Hero 2</div>
      `;

      // Step 1: Convert CSS
      const cssResult = convertNthChildToBem(css);
      expect(cssResult.report.converted).toBe(6);
      expect(cssResult.anPlusBInjections.length).toBe(6);

      // Step 2: Apply to HTML
      const modifiedHtml = applyAnPlusBModifiersToHtml(html, cssResult.anPlusBInjections);

      // Verify pattern repeats correctly
      expect(modifiedHtml).toContain('class="grid-item grid-item-slot-1">Hero');
      expect(modifiedHtml).toContain('class="grid-item grid-item-slot-2">Left');
      expect(modifiedHtml).toContain('class="grid-item grid-item-slot-3">Right');
      expect(modifiedHtml).toContain('class="grid-item grid-item-slot-4">Third 1');
      expect(modifiedHtml).toContain('class="grid-item grid-item-slot-5">Third 2');
      expect(modifiedHtml).toContain('class="grid-item grid-item-slot-6">Third 3');
      // Position 7 = slot 1 again
      expect(modifiedHtml).toContain('class="grid-item grid-item-slot-1">Hero 2');

      // Step 3: Verify CSS has all slot classes
      expect(cssResult.convertedCss).toContain(".grid-item-slot-1");
      expect(cssResult.convertedCss).toContain(".grid-item-slot-2");
      expect(cssResult.convertedCss).toContain(".grid-item-slot-3");
      expect(cssResult.convertedCss).toContain(".grid-item-slot-4");
      expect(cssResult.convertedCss).toContain(".grid-item-slot-5");
      expect(cssResult.convertedCss).toContain(".grid-item-slot-6");
    });
  });

  describe(":nth-last-child() support", () => {
    test("converts :nth-last-child(1) to BEM modifier (last item)", () => {
      const css = `
        .item:nth-last-child(1) { margin-bottom: 0; }
      `;

      const result = convertNthChildToBem(css);

      expect(result.report.totalFound).toBe(1);
      expect(result.report.converted).toBe(1);
      expect(result.nthLastChildInjections.length).toBe(1);
      expect(result.nthLastChildInjections[0].positionFromEnd).toBe(1);
      expect(result.nthLastChildInjections[0].modifierClass).toBe("item-from-end-1");
      expect(result.convertedCss).toContain(".item-from-end-1");
    });

    test("converts :nth-last-child(2) to BEM modifier (second to last)", () => {
      const css = `
        .item:nth-last-child(2) { border-bottom: none; }
      `;

      const result = convertNthChildToBem(css);

      expect(result.report.converted).toBe(1);
      expect(result.nthLastChildInjections[0].positionFromEnd).toBe(2);
      expect(result.nthLastChildInjections[0].modifierClass).toBe("item-from-end-2");
    });

    test("converts multiple :nth-last-child rules for same class", () => {
      const css = `
        .item:nth-last-child(1) { margin-bottom: 0; }
        .item:nth-last-child(2) { padding-bottom: 10px; }
        .item:nth-last-child(3) { background: #f5f5f5; }
      `;

      const result = convertNthChildToBem(css);

      expect(result.report.converted).toBe(3);
      expect(result.nthLastChildInjections.length).toBe(3);

      const injection1 = result.nthLastChildInjections.find(i => i.positionFromEnd === 1);
      const injection2 = result.nthLastChildInjections.find(i => i.positionFromEnd === 2);
      const injection3 = result.nthLastChildInjections.find(i => i.positionFromEnd === 3);

      expect(injection1?.modifierClass).toBe("item-from-end-1");
      expect(injection2?.modifierClass).toBe("item-from-end-2");
      expect(injection3?.modifierClass).toBe("item-from-end-3");
    });

    test("handles multiple classes with nth-last-child", () => {
      const css = `
        .card:nth-last-child(1) { border-radius: 0 0 20px 20px; }
        .row:nth-last-child(1) { border-bottom: none; }
      `;

      const result = convertNthChildToBem(css);

      expect(result.report.converted).toBe(2);
      expect(result.nthLastChildInjections.length).toBe(2);

      const cardInjection = result.nthLastChildInjections.find(i => i.baseClass === "card");
      const rowInjection = result.nthLastChildInjections.find(i => i.baseClass === "row");

      expect(cardInjection?.modifierClass).toBe("card-from-end-1");
      expect(rowInjection?.modifierClass).toBe("row-from-end-1");
    });
  });

  describe("applyNthLastChildModifiersToHtml", () => {
    test("adds modifier to last element (position from end 1)", () => {
      const html = `
        <div class="item">Item 1</div>
        <div class="item">Item 2</div>
        <div class="item">Item 3</div>
        <div class="item">Item 4</div>
      `;

      const injections = [
        { baseClass: "item", positionFromEnd: 1, modifierClass: "item-from-end-1" },
      ];

      const result = applyNthLastChildModifiersToHtml(html, injections);

      // Only the last element (Item 4) should have the modifier
      expect(result.match(/item-from-end-1/g)?.length).toBe(1);
      expect(result).toContain('class="item item-from-end-1">Item 4');
    });

    test("adds modifier to second-to-last element (position from end 2)", () => {
      const html = `
        <div class="item">Item 1</div>
        <div class="item">Item 2</div>
        <div class="item">Item 3</div>
        <div class="item">Item 4</div>
      `;

      const injections = [
        { baseClass: "item", positionFromEnd: 2, modifierClass: "item-from-end-2" },
      ];

      const result = applyNthLastChildModifiersToHtml(html, injections);

      // Only Item 3 (second to last) should have the modifier
      expect(result.match(/item-from-end-2/g)?.length).toBe(1);
      expect(result).toContain('class="item item-from-end-2">Item 3');
    });

    test("adds modifiers to multiple positions from end", () => {
      const html = `
        <div class="item">Item 1</div>
        <div class="item">Item 2</div>
        <div class="item">Item 3</div>
        <div class="item">Item 4</div>
        <div class="item">Item 5</div>
      `;

      const injections = [
        { baseClass: "item", positionFromEnd: 1, modifierClass: "item-from-end-1" },
        { baseClass: "item", positionFromEnd: 2, modifierClass: "item-from-end-2" },
        { baseClass: "item", positionFromEnd: 3, modifierClass: "item-from-end-3" },
      ];

      const result = applyNthLastChildModifiersToHtml(html, injections);

      // Item 5 = from-end-1, Item 4 = from-end-2, Item 3 = from-end-3
      expect(result).toContain('class="item item-from-end-1">Item 5');
      expect(result).toContain('class="item item-from-end-2">Item 4');
      expect(result).toContain('class="item item-from-end-3">Item 3');
    });

    test("handles single element with nth-last-child(1)", () => {
      const html = `<div class="item">Only Item</div>`;

      const injections = [
        { baseClass: "item", positionFromEnd: 1, modifierClass: "item-from-end-1" },
      ];

      const result = applyNthLastChildModifiersToHtml(html, injections);

      // Single element is both first and last
      expect(result).toContain('class="item item-from-end-1"');
    });
  });

  describe("removeConvertedNthLastChildRules", () => {
    test("removes converted nth-last-child rules from CSS", () => {
      const css = `
        .item { padding: 10px; }
        .item:nth-last-child(1) { margin-bottom: 0; }
        .item:nth-last-child(2) { padding-bottom: 5px; }
        .other { color: red; }
      `;

      const injections = [
        { baseClass: "item", positionFromEnd: 1, modifierClass: "item-from-end-1" },
        { baseClass: "item", positionFromEnd: 2, modifierClass: "item-from-end-2" },
      ];

      const result = removeConvertedNthLastChildRules(css, injections);

      expect(result).toContain(".item { padding: 10px; }");
      expect(result).toContain(".other { color: red; }");
      expect(result).not.toContain(":nth-last-child(1)");
      expect(result).not.toContain(":nth-last-child(2)");
    });
  });

  describe("nth-last-child full flow", () => {
    test("full conversion flow for styling last N items", () => {
      const css = `
        .list-item:nth-last-child(1) { margin-bottom: 0; border-bottom: none; }
        .list-item:nth-last-child(2) { padding-bottom: 10px; }
      `;

      const html = `
        <div class="list-item">Item 1</div>
        <div class="list-item">Item 2</div>
        <div class="list-item">Item 3</div>
        <div class="list-item">Item 4</div>
        <div class="list-item">Item 5</div>
      `;

      // Step 1: Convert CSS
      const cssResult = convertNthChildToBem(css);
      expect(cssResult.report.converted).toBe(2);
      expect(cssResult.nthLastChildInjections.length).toBe(2);

      // Step 2: Apply to HTML
      const modifiedHtml = applyNthLastChildModifiersToHtml(html, cssResult.nthLastChildInjections);

      // Verify correct items have modifiers
      expect(modifiedHtml).not.toContain('item-from-end">Item 1');
      expect(modifiedHtml).not.toContain('item-from-end">Item 2');
      expect(modifiedHtml).not.toContain('item-from-end">Item 3');
      expect(modifiedHtml).toContain('class="list-item list-item-from-end-2">Item 4');
      expect(modifiedHtml).toContain('class="list-item list-item-from-end-1">Item 5');

      // Step 3: Verify CSS has BEM classes
      expect(cssResult.convertedCss).toContain(".list-item-from-end-1");
      expect(cssResult.convertedCss).toContain(".list-item-from-end-2");
      expect(cssResult.convertedCss).toContain("margin-bottom: 0");
      expect(cssResult.convertedCss).toContain("border-bottom: none");
    });
  });

  describe("combined nth-child and nth-last-child", () => {
    test("converts both nth-child and nth-last-child in same CSS", () => {
      const css = `
        .card:nth-child(1) { background: #aefbff; }
        .card:nth-last-child(1) { margin-bottom: 0; }
      `;

      const result = convertNthChildToBem(css);

      // Should convert both rules
      expect(result.report.converted).toBe(2);

      // Should have 1 nth-child injection
      expect(result.htmlInjections.length).toBe(1);
      expect(result.htmlInjections[0].modifierClass).toBe("card-cyan");

      // Should have 1 nth-last-child injection
      expect(result.nthLastChildInjections.length).toBe(1);
      expect(result.nthLastChildInjections[0].modifierClass).toBe("card-from-end-1");
    });

    test("combines all positional selector types", () => {
      const css = `
        .item:first-child { border-top: none; }
        .item:nth-child(2) { background: #f6bbfd; }
        .item:nth-child(odd) { background: #f5f5f5; }
        .item:nth-child(3n) { margin-right: 0; }
        .item:nth-child(6n+1) { clear: left; }
        .item:nth-last-child(1) { border-bottom: none; }
        .item:last-child { margin-bottom: 0; }
      `;

      const result = convertNthChildToBem(css);

      // All 7 rules should be converted
      expect(result.report.converted).toBe(7);

      // Check each type of injection
      expect(result.firstLastInjections.length).toBe(2); // first-child + last-child
      expect(result.htmlInjections.length).toBe(1); // nth-child(2)
      expect(result.oddEvenInjections.length).toBe(1); // nth-child(odd)
      expect(result.anFormulaInjections.length).toBe(1); // nth-child(3n)
      expect(result.anPlusBInjections.length).toBe(1); // nth-child(6n+1)
      expect(result.nthLastChildInjections.length).toBe(1); // nth-last-child(1)
    });
  });
});
