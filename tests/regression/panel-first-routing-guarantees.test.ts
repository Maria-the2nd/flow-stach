import { describe, expect, it } from "vitest";
import { mergeEmbedCSS, routeCSS } from "../../lib/css-embed-router";
import { normalizeHtmlCssForWebflow } from "../../lib/webflow-normalizer";
import { parseCSS } from "../../lib/css-parser";

function runTwoPassPanelFirst(html: string, css: string) {
  const preRouting = routeCSS(css, {
    strategy: "panel-first",
    phase: "hard-blockers",
  });

  const normalized = normalizeHtmlCssForWebflow(html, preRouting.native);

  const postRouting = routeCSS(normalized.css, {
    strategy: "panel-first",
    phase: "full",
  });

  const finalEmbed = mergeEmbedCSS(
    normalized.bodyBackgroundEmbed || "",
    preRouting.embed,
    postRouting.embed,
  );

  return {
    preRouting,
    normalized,
    postRouting,
    native: postRouting.native,
    embed: finalEmbed,
  };
}

describe("Panel-first routing guarantees", () => {
  describe("1) @keyframes and surrounding rules integrity", () => {
    it("keeps @keyframes complete and preserves classes before/after animations", () => {
      const html = `
        <div class="before">Before</div>
        <div class="between">Between</div>
        <div class="after">After</div>
      `;

      const css = `
        :root { --text: #f1f5f9; }
        .before { color: var(--text); }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-5px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .between { animation: fadeIn 300ms ease-out; }
        @keyframes gradient-anim {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .after { background: linear-gradient(45deg, #ff0000, #00ffff); }
      `;

      const result = runTwoPassPanelFirst(html, css);

      expect(result.embed).toContain("@keyframes fadeIn");
      expect(result.embed).toContain("from{opacity:0");
      expect(result.embed).toContain("to{opacity:1");
      expect(result.embed).toContain("@keyframes gradient-anim");
      expect(result.embed).toContain("50%{background-position:100% 50%}");

      expect(result.native).toMatch(/\.before\s*\{[^}]*color:\s*#f1f5f9/i);
      expect(result.native).toMatch(/\.between\s*\{[^}]*animation:\s*fadeIn/i);
      expect(result.native).toMatch(/\.after\s*\{[^}]*linear-gradient/i);

      // Guard against malformed extraction leaking keyframe internals to native CSS.
      expect(result.native).not.toMatch(/(^|\n)\s*(from|to|50%)\s*\{/i);
      expect(result.native).not.toContain("@keyframes");
    });
  });

  describe("2) full-viewport body background preservation", () => {
    const cases = [
      {
        name: "plain color background",
        css: `
          body {
            background-color: #0b0f1a;
            color: #f1f5f9;
            max-width: 1200px;
            margin: 0 auto;
            padding: 2rem;
          }
          h1 { margin: 0; }
        `,
        expectedBodyBackground: "background-color: #0b0f1a",
      },
      {
        name: "variable-based background resolved before extraction",
        css: `
          :root { --app-bg: #102030; }
          body {
            background-color: var(--app-bg);
            color: #ffffff;
            width: 1100px;
            margin: 0 auto;
            padding: 1.5rem;
          }
          p { line-height: 1.6; }
        `,
        expectedBodyBackground: "background-color: #102030",
      },
    ];

    it.each(cases)(
      "extracts body background for $name",
      ({ css, expectedBodyBackground }) => {
        const html = `
        <header><h1>Heading</h1></header>
        <main><p>Body text</p></main>
      `;

        const result = runTwoPassPanelFirst(html, css);

        expect(result.normalized.bodyBackgroundEmbed).toBeDefined();
        expect(result.normalized.bodyBackgroundEmbed).toContain("body {");
        expect(result.normalized.bodyBackgroundEmbed).toContain(
          expectedBodyBackground,
        );

        expect(result.embed).toContain("body {");
        expect(result.embed).toContain(expectedBodyBackground);

        expect(result.native).toMatch(
          /\.wf-body\s*\{[^}]*max-width|\.wf-body\s*\{[^}]*width/i,
        );
        expect(result.native).toMatch(/\.wf-body\s*\{[^}]*margin:\s*0 auto/i);
        expect(result.native).toMatch(/\.wf-body\s*\{[^}]*padding:/i);
        expect(result.native).not.toContain(expectedBodyBackground);
      },
    );
  });

  describe("3) stateful descendant selectors remain interaction-safe", () => {
    it("keeps dynamic state descendants in embed while preserving static combo flattening", () => {
      const html = `
        <div class="hero-tabs">
          <button class="hero-tab active"><span class="tab-number">(01)</span><span class="tab-arrow">→</span></button>
          <button class="hero-tab"><span class="tab-number">(02)</span><span class="tab-arrow">→</span></button>
        </div>
        <div class="faq-item active"><div class="faq-answer">Answer</div></div>
        <div class="pack-card featured"><h3 class="pack-title">Title</h3></div>
      `;

      const css = `
        .hero-tab.active .tab-number { color: #fafafa; }
        .hero-tab.active .tab-arrow { opacity: 1; }
        .faq-item.active .faq-answer { max-height: 200px; }
        .pack-card.featured .pack-title { color: #ffffff; }
      `;

      const result = runTwoPassPanelFirst(html, css);

      expect(result.embed).toContain(".hero-tab.active .tab-number");
      expect(result.embed).toContain(".faq-item.active .faq-answer");

      expect(result.normalized.html).not.toContain("active-tab-number");
      expect(result.normalized.html).not.toContain("active-faq-answer");
      expect(result.native).not.toContain(".active-tab-number");
      expect(result.native).not.toContain(".active-faq-answer");

      // Static modifier descendant flattening is still allowed for panel-first editability.
      expect(result.native).toContain(".featured-pack-title");
      expect(result.normalized.html).toContain("featured-pack-title");
    });
  });

  describe("4) quoted layout values are never dequoted", () => {
    it("preserves grid-template-areas strings in base and media rules", () => {
      const html = `<section class="bento-grid"><div class="testimonial-card"></div><div class="stat-card-1"></div><div class="showcase-card"></div><div class="process-card"></div><div class="timeline-card"></div><div class="stat-card-2"></div></section>`;

      const css = `
        .bento-grid {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          grid-template-areas:
            "testimonial stat1     showcase"
            "testimonial process   showcase"
            "timeline    timeline  stat2";
          gap: 1.5rem;
        }
        @media (max-width: 1024px) {
          .bento-grid {
            grid-template-columns: 1fr 1fr;
            grid-template-areas:
              "testimonial stat1"
              "testimonial process"
              "showcase   showcase"
              "timeline   stat2";
          }
        }
      `;

      const result = runTwoPassPanelFirst(html, css);

      expect(result.native).toMatch(
        /grid-template-areas:\s*"testimonial\s+stat1\s+showcase"\s*"testimonial\s+process\s+showcase"\s*"timeline\s+timeline\s+stat2";/s,
      );
      expect(result.native).toMatch(
        /@media\s*\(max-width:\s*1024px\)\s*\{[^}]*grid-template-areas:\s*"testimonial\s+stat1"\s*"testimonial\s+process"\s*"showcase\s+showcase"\s*"timeline\s+stat2";/s,
      );

      expect(result.native).not.toContain("grid-template-areas: testimonial");
      expect(result.native).not.toContain("stat2; gap");
    });
  });

  describe("5) global anchor base styles remain applied", () => {
    it("maps element selector a -> .link and injects link class on anchor nodes", () => {
      const html = `
        <nav>
          <a href="#" class="nav-logo">Flow Party</a>
          <a href="#pricing">Pricing</a>
        </nav>
      `;

      const css = `
        a {
          text-decoration: none;
          color: inherit;
        }
      `;

      const result = runTwoPassPanelFirst(html, css);

      expect(result.native).toMatch(/\.link\s*\{[^}]*text-decoration:\s*none/i);
      expect(result.native).toMatch(/\.link\s*\{[^}]*color:\s*inherit/i);

      expect(result.normalized.html).toMatch(
        /class="[^"]*\bnav-logo\b[^"]*\blink\b|class="[^"]*\blink\b[^"]*\bnav-logo\b/,
      );
      expect(result.normalized.html).toMatch(
        /<a[^>]*class="[^"]*\blink\b[^"]*"[^>]*>Pricing<\/a>/,
      );
    });
  });

  describe("6) script-dependent animation defaults stay layout-safe", () => {
    it("uses visible-state transform defaults for scroll reveal classes", () => {
      const html = `<section class="fade-up">Animated block</section>`;
      const css = `
        .fade-up {
          opacity: 0;
          transform: translateY(30px);
          transition: opacity 0.6s ease, transform 0.6s ease;
        }
        .fade-up.visible {
          opacity: 1;
          transform: translateY(0);
        }
      `;

      const result = runTwoPassPanelFirst(html, css);

      expect(result.native).toMatch(/\.fade-up\s*\{[^}]*opacity:\s*1/i);
      expect(result.native).toMatch(
        /\.fade-up\s*\{[^}]*(transform:\s*translateY\(0\)|transform:\s*none)/i,
      );
      expect(result.native).not.toMatch(
        /\.fade-up\s*\{[^}]*transform:\s*translateY\(30px\)/i,
      );
    });

    it("infers final static state from unknown class + state combo", () => {
      const html = `<div class="intro-block">Card</div>`;
      const css = `
        .intro-block {
          opacity: 0;
          transform: translateY(16px);
          transition: opacity 0.3s ease, transform 0.3s ease;
        }
        .intro-block.visible {
          opacity: 1;
          transform: translateY(0);
        }
      `;

      const result = runTwoPassPanelFirst(html, css);

      expect(result.native).toMatch(/\.intro-block\s*\{[^}]*opacity:\s*1/i);
      expect(result.native).toMatch(
        /\.intro-block\s*\{[^}]*transform:\s*translateY\(0\)/i,
      );
    });

    it("neutralizes offscreen transform when no visible state rule exists", () => {
      const html = `<div class="slide-up">Card</div>`;
      const css = `
        .slide-up {
          opacity: 0;
          transform: translateY(24px);
          transition: opacity 0.4s ease, transform 0.4s ease;
        }
      `;

      const result = runTwoPassPanelFirst(html, css);

      expect(result.native).toMatch(/\.slide-up\s*\{[^}]*opacity:\s*1/i);
      expect(result.native).toMatch(/\.slide-up\s*\{[^}]*transform:\s*none/i);
    });
  });

  describe("7) embed selector parity with normalized element classes", () => {
    it("remaps split embed selectors from bare elements to normalized class selectors", () => {
      const html = `<h1>Gradient Title</h1>`;
      const css = `
        h1 {
          background: linear-gradient(to right, #a78bfa, #38bdf8);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
      `;

      const result = runTwoPassPanelFirst(html, css);

      expect(result.native).toMatch(
        /\.heading-h1\s*\{[^}]*background:\s*linear-gradient/i,
      );
      expect(result.embed).toMatch(
        /\.heading-h1\{[^}]*-webkit-background-clip:text/i,
      );
      expect(result.embed).toMatch(
        /\.heading-h1\{[^}]*-webkit-text-fill-color:transparent/i,
      );
      expect(result.embed).not.toMatch(
        /(^|[,{])h1\{[^}]*-webkit-background-clip/i,
      );
    });
  });

  describe("8) nonStandardMediaCss consumed in parseCSS output", () => {
    it("routes max-width >991px breakpoints into nonStandardMediaCss", () => {
      const css = `
        .grid { display: grid; grid-template-columns: 1fr 1fr 1fr; }
        @media (max-width: 1024px) {
          .grid { grid-template-columns: 1fr 1fr; }
        }
        @media (max-width: 768px) {
          .grid { grid-template-columns: 1fr; }
        }
      `;

      const result = parseCSS(css);

      // The 1024px rule exceeds Webflow's 991px max → nonStandardMediaCss
      expect(result.classIndex.nonStandardMediaCss).toBeDefined();
      expect(result.classIndex.nonStandardMediaCss).toContain("1024px");
      expect(result.classIndex.nonStandardMediaCss).toContain("grid-template-columns");

      // The 768px rule fits within Webflow breakpoints → classIndex (small)
      expect(result.classIndex.classes["grid"]).toBeDefined();
    });
  });

  describe("9) pseudo-class + breakpoint rules route to embed", () => {
    it("routes :hover inside @media to nonStandardMediaCss instead of dropping", () => {
      const css = `
        .btn { background: blue; }
        .btn:hover { background: darkblue; }
        @media (min-width: 1024px) {
          .btn:hover { background: navy; }
        }
      `;

      const result = parseCSS(css);

      // The :hover inside @media should go to nonStandardMediaCss, not be dropped
      expect(result.classIndex.nonStandardMediaCss).toBeDefined();
      expect(result.classIndex.nonStandardMediaCss).toContain(".btn:hover");
      expect(result.classIndex.nonStandardMediaCss).toContain("background");
    });
  });

  describe("10) .class element descendant safety net in full phase", () => {
    it("routes non-flattenable .class element selectors to embed in full phase", () => {
      // span/div are NOT in the flattenable set — they go to embed
      const css = `.nav span { color: white; text-decoration: none; }`;

      const fullResult = routeCSS(css, {
        strategy: "panel-first",
        phase: "full",
      });

      expect(fullResult.embed).toContain(".nav span");
      expect(fullResult.embed).toContain("color:white");
    });

    it("keeps flattenable .class element selectors native (parser creates modifier class)", () => {
      // a, h1-h6, p etc. are flattenable — parser creates modifier classes like "nav-a"
      const css = `.nav a { color: white; text-decoration: none; }`;

      const fullResult = routeCSS(css, {
        strategy: "panel-first",
        phase: "full",
      });

      expect(fullResult.native).toContain(".nav a");
      expect(fullResult.embed).not.toContain(".nav a");
    });

    it("defers .class element to normalizer in hard-blockers phase", () => {
      const css = `.nav span { color: white; }`;

      const preResult = routeCSS(css, {
        strategy: "panel-first",
        phase: "hard-blockers",
      });

      // Hard-blockers phase defers to normalizer
      expect(preResult.native).toContain(".nav span");
      expect(preResult.embed).not.toContain(".nav span");
    });
  });

  describe("11) static is-* modifier not flagged as stateful", () => {
    it("does not early-route .is-solution descendant as stateful in hard-blockers", () => {
      // .card.is-solution .card-title is a descendant selector — it WILL go to embed
      // in the full phase. But the point is that .is-solution should NOT trigger
      // hasStatefulClassAncestor (which would route it in hard-blockers too).
      const css = `.card.is-solution .card-title { color: #ffffff; }`;

      const preResult = routeCSS(css, {
        strategy: "panel-first",
        phase: "hard-blockers",
      });

      // In hard-blockers, descendant selectors are deferred to normalizer
      // Stateful ancestors would bypass this deferral — .is-solution should NOT
      expect(preResult.native).toContain(".card.is-solution .card-title");
      expect(preResult.embed).not.toContain("is-solution");
    });

    it("still early-routes .is-active descendant as stateful in hard-blockers", () => {
      const css = `.tab.is-active .tab-label { color: #ffffff; }`;

      const preResult = routeCSS(css, {
        strategy: "panel-first",
        phase: "hard-blockers",
      });

      // .is-active IS a known stateful class → hard-blockers routes immediately to embed
      expect(preResult.embed).toContain("is-active");
    });
  });
});
