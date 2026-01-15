import { parseCSS } from "../lib/css-parser";

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

console.log("Parsing CSS...");
const result = parseCSS(css);

const gapGrid = result.classIndex.classes["gap-grid"];

if (!gapGrid) {
  console.error("Error: .gap-grid class not found in result");
  process.exit(1);
}

console.log("Base Styles:", gapGrid.baseStyles);
console.log("Media Queries:", JSON.stringify(gapGrid.mediaQueries, null, 2));

const baseMap = new Map();
gapGrid.baseStyles.split(";").forEach(prop => {
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

if (smallStyles.includes("grid-template-columns: 1fr") && tinyStyles.includes("grid-template-columns: 1fr")) {
    console.log("SUCCESS: Mobile styles backfilled correctly.");
} else {
    console.log("FAILURE: Mobile styles missing or incorrect.");
}
