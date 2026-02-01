/**
 * Visual Comparison Tool
 *
 * Generates side-by-side HTML files for visual comparison:
 * 1. Original HTML (as-is)
 * 2. Webflow-ready HTML (native CSS + embed CSS + JS)
 *
 * Usage:
 *   npx tsx audit/tools/visual-compare.ts <test-slug>
 *   npx tsx audit/tools/visual-compare.ts --all
 */

import fs from 'fs';
import path from 'path';
import { extractCleanHtml } from '../../lib/html-parser';
import { normalizeHtmlCssForWebflow } from '../../lib/webflow-normalizer';
import { routeCSS, wrapEmbedCSSInStyleTag } from '../../lib/css-embed-router';
import { loadAllManifests, loadManifestBySlug, filterSkipped } from '../manifest/loader';
import { assembleBundle, createHtmlBundle } from '../runner/bundle-assembler';
import { AUDIT_CONFIG } from '../config';

interface CompareResult {
  slug: string;
  originalPath: string;
  webflowReadyPath: string;
  stats: {
    nativeRules: number;
    embedRules: number;
    preservationRate: string;
  };
}

/**
 * Generate visual comparison files for a single test
 */
function generateComparison(slug: string): CompareResult | null {
  const manifest = loadManifestBySlug(slug);
  if (!manifest) {
    console.error(`Test not found: ${slug}`);
    return null;
  }

  console.log(`\nProcessing: ${slug}`);

  // 1. Assemble the original bundle
  const bundle = assembleBundle({
    manifestPath: manifest.filePath,
    manifest: manifest.manifest,
    slug: manifest.slug,
  });

  if (bundle.error) {
    console.error(`  Error: ${bundle.error}`);
    return null;
  }

  // 2. Create original HTML bundle
  const originalHtml = createHtmlBundle(
    bundle.html,
    bundle.css,
    bundle.js,
    manifest.manifest.name
  );

  // 3. Extract and normalize
  const cleanResult = extractCleanHtml(originalHtml);
  let combinedCss = cleanResult.extractedStyles;
  if (bundle.css) {
    combinedCss = `${combinedCss}\n\n/* External CSS */\n${bundle.css}`;
  }

  const normResult = normalizeHtmlCssForWebflow(cleanResult.cleanHtml, combinedCss);

  // 4. Route CSS to native vs embed
  const routingResult = routeCSS(normResult.css);

  // 5. Build Webflow-ready HTML with BOTH native and embed CSS
  const webflowReadyHtml = buildWebflowReadyHtml(
    normResult.html,
    routingResult.native,
    routingResult.embed,
    bundle.js || '',
    manifest.manifest.name,
    normResult.bodyBackgroundEmbed
  );

  // 6. Save files
  const outputDir = path.join(AUDIT_CONFIG.outputDir, slug);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const originalPath = path.join(outputDir, 'visual-original.html');
  const webflowReadyPath = path.join(outputDir, 'visual-webflow-ready.html');

  fs.writeFileSync(originalPath, originalHtml, 'utf-8');
  fs.writeFileSync(webflowReadyPath, webflowReadyHtml, 'utf-8');

  // Calculate stats
  const totalRules = routingResult.stats.nativeRules + routingResult.stats.embedRules;
  const preservationRate = totalRules > 0
    ? ((routingResult.stats.nativeRules / totalRules) * 100).toFixed(1)
    : '100';

  console.log(`  ✓ Native CSS rules: ${routingResult.stats.nativeRules}`);
  console.log(`  ✓ Embed CSS rules: ${routingResult.stats.embedRules}`);
  console.log(`  ✓ Files saved to: ${outputDir}`);

  return {
    slug,
    originalPath,
    webflowReadyPath,
    stats: {
      nativeRules: routingResult.stats.nativeRules,
      embedRules: routingResult.stats.embedRules,
      preservationRate: `${preservationRate}%`,
    },
  };
}

/**
 * Build Webflow-ready HTML with native CSS, embed CSS, and JS
 */
function buildWebflowReadyHtml(
  html: string,
  nativeCss: string,
  embedCss: string,
  js: string,
  title: string,
  bodyBackgroundEmbed?: string
): string {
  // Combine all embed CSS
  let allEmbedCss = embedCss;
  if (bodyBackgroundEmbed) {
    allEmbedCss = `${bodyBackgroundEmbed}\n\n${embedCss}`;
  }

  // Create styled embed block
  const embedBlock = allEmbedCss.trim()
    ? wrapEmbedCSSInStyleTag(allEmbedCss)
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - Webflow Ready</title>

  <!-- ============================================ -->
  <!-- NATIVE CSS (converted to Webflow classes)   -->
  <!-- This would be in Webflow's style system     -->
  <!-- ============================================ -->
  <style>
${nativeCss}
  </style>

  <!-- ============================================ -->
  <!-- EMBED CSS (custom code to paste)            -->
  <!-- This goes in a Custom Code embed block      -->
  <!-- ============================================ -->
  ${embedBlock ? `\n  ${embedBlock.split('\n').join('\n  ')}` : '<!-- No embed CSS needed -->'}
</head>
<body>
${html}
${js ? `
<!-- ============================================ -->
<!-- JAVASCRIPT                                   -->
<!-- This goes in Custom Code (before </body>)   -->
<!-- ============================================ -->
<script>
${js}
</script>
` : ''}
</body>
</html>`;
}

/**
 * Generate an index page linking to all comparisons
 */
function generateIndexPage(results: CompareResult[]): void {
  const rows = results.map(r => `
    <tr>
      <td><strong>${r.slug}</strong></td>
      <td>${r.stats.nativeRules}</td>
      <td>${r.stats.embedRules}</td>
      <td>${r.stats.preservationRate}</td>
      <td>
        <a href="${r.slug}/visual-original.html" target="_blank">Original</a> |
        <a href="${r.slug}/visual-webflow-ready.html" target="_blank">Webflow Ready</a>
      </td>
    </tr>
  `).join('');

  const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Visual Comparison Index</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, sans-serif; padding: 40px; background: #f5f5f5; }
    h1 { margin-bottom: 8px; }
    .subtitle { color: #666; margin-bottom: 24px; }
    table { width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    th, td { padding: 12px 16px; text-align: left; border-bottom: 1px solid #eee; }
    th { background: #333; color: white; }
    tr:hover { background: #f9f9f9; }
    a { color: #0066cc; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .instructions { margin-top: 32px; padding: 16px; background: #e8f4ff; border-radius: 8px; }
    .instructions h3 { margin-bottom: 8px; }
    .instructions ol { margin-left: 20px; }
    .instructions li { margin: 4px 0; }
  </style>
</head>
<body>
  <h1>Visual Comparison Index</h1>
  <p class="subtitle">Compare original HTML files with Webflow-ready output</p>

  <table>
    <thead>
      <tr>
        <th>Test</th>
        <th>Native Rules</th>
        <th>Embed Rules</th>
        <th>Native %</th>
        <th>Compare</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>

  <div class="instructions">
    <h3>How to use:</h3>
    <ol>
      <li>Click "Original" to see the source HTML as-is</li>
      <li>Click "Webflow Ready" to see the converted output</li>
      <li>Open both in separate tabs to compare visually</li>
      <li>The "Webflow Ready" file contains:
        <ul>
          <li><strong>Native CSS</strong> - Converted to Webflow classes (would be in Webflow's style panel)</li>
          <li><strong>Embed CSS</strong> - Custom code to paste (::before, ::after, complex selectors)</li>
          <li><strong>JavaScript</strong> - Custom code to paste (if any)</li>
        </ul>
      </li>
    </ol>
  </div>
</body>
</html>`;

  const indexPath = path.join(AUDIT_CONFIG.outputDir, 'visual-compare-index.html');
  fs.writeFileSync(indexPath, indexHtml, 'utf-8');
  console.log(`\nIndex page saved to: ${indexPath}`);
}

// ============================================
// CLI
// ============================================

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('Usage:');
    console.log('  npx tsx audit/tools/visual-compare.ts <test-slug>');
    console.log('  npx tsx audit/tools/visual-compare.ts --all');
    console.log('');
    console.log('Examples:');
    console.log('  npx tsx audit/tools/visual-compare.ts flow-bridge-bento');
    console.log('  npx tsx audit/tools/visual-compare.ts --all');
    process.exit(1);
  }

  // Ensure output directory exists
  if (!fs.existsSync(AUDIT_CONFIG.outputDir)) {
    fs.mkdirSync(AUDIT_CONFIG.outputDir, { recursive: true });
  }

  if (args[0] === '--all') {
    // Process all tests
    const loadResult = loadAllManifests();
    if (loadResult.errors.length > 0) {
      console.warn('Manifest load warnings:');
      loadResult.errors.forEach(e => console.warn(`  ${e.filePath}: ${e.error}`));
    }

    const { active } = filterSkipped(loadResult.manifests);
    console.log(`Found ${active.length} tests to process\n`);

    const results: CompareResult[] = [];

    for (const manifest of active) {
      const result = generateComparison(manifest.slug);
      if (result) {
        results.push(result);
      }
    }

    // Generate index page
    generateIndexPage(results);

    console.log('\n========================================');
    console.log(`Processed ${results.length} tests`);
    console.log(`Open: ${path.join(AUDIT_CONFIG.outputDir, 'visual-compare-index.html')}`);
  } else {
    // Process single test
    const result = generateComparison(args[0]);
    if (result) {
      console.log('\n========================================');
      console.log('Files created:');
      console.log(`  Original: ${result.originalPath}`);
      console.log(`  Webflow Ready: ${result.webflowReadyPath}`);
      console.log('\nOpen both files in a browser to compare visually.');
    }
  }
}

main().catch(console.error);
