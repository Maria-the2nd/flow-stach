import fs from "fs";
const data = JSON.parse(fs.readFileSync('temp/debug-output/classIndex.json', 'utf-8'));
const bg = data.classes['bento-grid'];

fs.writeFileSync('temp/bento-grid-result.txt', `
=== bento-grid full entry ===
baseStyles: ${bg.baseStyles}

mediaQueries:
  desktop: ${bg.mediaQueries?.desktop || '(empty)'}
  medium: ${bg.mediaQueries?.medium || '(empty)'}
  small: ${bg.mediaQueries?.small || '(empty)'}
  tiny: ${bg.mediaQueries?.tiny || '(empty)'}

selectors: ${JSON.stringify(bg.selectors)}
isLayoutContainer: ${bg.isLayoutContainer}
`);

console.log('Written to temp/bento-grid-result.txt');
