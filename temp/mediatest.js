const css = `
.bento-grid { grid-template-columns: repeat(4, 1fr); }
@media (max-width: 1200px) {
.bento-grid { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 900px) {
.bento-grid { grid-template-columns: 1fr; }
}
`;
const mediaRegex = /@media\s*([^{]+)\s*\{([\s\S]*?)\}(?=\s*(?:@|\.|\s*$))/g;
let match;
let count = 0;
while ((match = mediaRegex.exec(css)) !== null) {
    count++;
    console.log('Match', count, ':', match[1].trim());
    console.log('Content:', match[2].trim().slice(0, 50) + '...');
}
console.log('Total matches:', count);
