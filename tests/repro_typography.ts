
import { literalizeCssForWebflow } from '../lib/webflow-literalizer';

const css = `
:root {
  --font-heading: "Inter", sans-serif;
  --spacing-large: 40px;
  --transform-upper: uppercase;
}

.heading-h1 {
  font-family: var(--font-heading);
  text-transform: var(--transform-upper);
  margin-bottom: var(--spacing-large);
  font-size: clamp(2rem, 5vw, 4rem);
}

.container {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}
`;

console.log("Running Typography Preservation Test...");
const result = literalizeCssForWebflow(css);

console.log("Result CSS:");
console.log(result.css);

const fontCheck = result.css.includes('font-family: "Inter", sans-serif');
const transformCheck = result.css.includes('text-transform: uppercase');
const spacingCheck = result.css.includes('margin-bottom: 40px');
const fontSizeCheck = result.css.includes('font-size: clamp(2rem, 5vw, 4rem)');

if (fontCheck && transformCheck && spacingCheck && fontSizeCheck) {
  console.log("SUCCESS: All typography and spacing properties preserved correctly.");
} else {
  console.log("FAILURE: Some properties were lost or corrupted.");
  if (!fontCheck) console.log("- Font family check failed");
  if (!transformCheck) console.log("- Text transform check failed");
  if (!spacingCheck) console.log("- Spacing check failed");
  if (!fontSizeCheck) console.log("- Font size check failed");
  process.exit(1);
}
