import { parseCSS } from "../lib/css-parser";
import { normalizeHtmlCssForWebflow } from "../lib/webflow-normalizer";
import { convertHtmlCssToWebflow } from "../lib/webflow-converter";

const css = `
      :root {
        --bg-dark: #0f1115;
      }
      .gap-grid {
        display: grid;
        grid-template-columns: 1fr;
        gap: 2rem;
        margin-top: 3rem;
      }

      @media (min-width: 768px) {
        .gap-grid { grid-template-columns: 1fr 1fr; }
      }
`;

console.log("Parsing CSS with low-level parser...");
const result = parseCSS(css);

const gapGrid = result.classIndex.classes["gap-grid"];

if (!gapGrid) {
  console.error("Error: .gap-grid class not found in result");
  process.exit(1);
}

console.log("Base Styles:", gapGrid.baseStyles);
console.log("Media Queries:", JSON.stringify(gapGrid.mediaQueries, null, 2));

const baseMap = new Map<string, string>();
gapGrid.baseStyles.split(";").forEach((prop) => {
  const parts = prop.split(":");
  if (parts.length >= 2) {
    baseMap.set(parts[0].trim(), parts.slice(1).join(":").trim());
  }
});

const columns = baseMap.get("grid-template-columns");
console.log("Base grid-template-columns:", columns);

if (columns === "1fr 1fr") {
  console.log("SUCCESS: Base styles promoted to 2 columns.");
} else {
  console.log("FAILURE: Base styles are:", columns);
}

// Check if small/tiny have backfilled 1fr
const smallStyles = gapGrid.mediaQueries.small || "";
const tinyStyles = gapGrid.mediaQueries.tiny || "";

console.log("Small Styles:", smallStyles);
console.log("Tiny Styles:", tinyStyles);

if (
  smallStyles.includes("grid-template-columns: 1fr") &&
  tinyStyles.includes("grid-template-columns: 1fr")
) {
  console.log("SUCCESS: Mobile styles backfilled correctly.");
} else {
  console.log("FAILURE: Mobile styles missing or incorrect.");
}

const html = `
  <section class="section bg-darker">
    <div class="container">
      <div class="text-center mb-3">
        <h2 class="heading-gap">AI generates. Editing sucks.</h2>
      </div>
      <div class="gap-grid">
        <div class="card problem">
          <h3>The Current Pain</h3>
          <p>Right now you either stay in AI editors and fight messy code when you want real design control, or stay in Webflow and miss out on AI speed.</p>
        </div>
        <div class="card solution">
          <h3>The Flow Bridge Way</h3>
          <p>Flow Bridge is the missing link. Import raw code, get structured components. Best of both worlds.</p>
        </div>
      </div>
    </div>
  </section>
`;

console.log("Running full Webflow conversion pipeline...");
const payload = convertHtmlCssToWebflow(html, css);

const normalized = normalizeHtmlCssForWebflow(html, css);
console.log("Normalized CSS:", normalized.css);

const gapStyle = payload.payload.styles.find((s) => s.name === "gap-grid");

if (!gapStyle) {
  console.error("Error: gap-grid style not found in Webflow payload");
  process.exit(1);
}

console.log("Webflow base styleLess for gap-grid:", gapStyle.styleLess);
console.log("Webflow variants for gap-grid:", gapStyle.variants);

const webflowBaseMap = new Map<string, string>();
gapStyle.styleLess.split(";").forEach((prop) => {
  const parts = prop.split(":");
  if (parts.length >= 2) {
    webflowBaseMap.set(parts[0].trim(), parts.slice(1).join(":").trim());
  }
});

const webflowColumns = webflowBaseMap.get("grid-template-columns");
console.log("Webflow base grid-template-columns:", webflowColumns);

if (webflowColumns === "1fr 1fr") {
  console.log("SUCCESS: Webflow payload uses 2 columns on desktop.");
} else {
  console.log("FAILURE: Webflow payload columns are:", webflowColumns);
}
