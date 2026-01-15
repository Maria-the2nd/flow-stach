import fs from "fs";
const css = fs.readFileSync('temp/debug-output/styles.css', 'utf-8');

// This is the current regex from css-parser.ts
const mediaRegex = /@media\s*([^{]+)\s*\{([\s\S]*?)\}(?=\s*(?:@|\.|\s*$))/g;

let match;
let i = 0;
while ((match = mediaRegex.exec(css)) !== null) {
    i++;
    console.log(`\n=== MATCH ${i} ===`);
    console.log('Query:', match[1].trim());
    console.log('Content length:', match[2].length);
    console.log('Content preview:', match[2].slice(0, 100) + '...');
    console.log('Contains bento-grid:', match[2].includes('bento-grid'));
}

// After media queries are removed, what's left?
let cssWithoutMedia = css;
mediaRegex.lastIndex = 0;
while ((match = mediaRegex.exec(css)) !== null) {
    cssWithoutMedia = cssWithoutMedia.replace(match[0], '');
}

console.log('\n=== REMAINING CSS (checking for bento-grid) ===');
const lines = cssWithoutMedia.split('\n').filter(l => l.includes('bento-grid'));
lines.forEach(l => console.log(l.slice(0, 100)));
