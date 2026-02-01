/**
 * HTML Dashboard Generator
 *
 * Generates interactive index.html dashboard for browsing audit results.
 */

import fs from 'fs';
import path from 'path';
import type { BatchResult, AuditResult } from '../types';
import { AUDIT_CONFIG } from '../config';
import { formatDiffPercentage } from '../diff/image-diff';

/**
 * Generate HTML dashboard from batch results
 */
export async function generateHtmlDashboard(batch: BatchResult): Promise<void> {
  const html = buildDashboardHtml(batch);
  const dashboardPath = path.join(AUDIT_CONFIG.outputDir, 'index.html');
  fs.writeFileSync(dashboardPath, html, 'utf-8');
  console.log(`Dashboard written to: ${dashboardPath}`);
}

/**
 * Build the complete HTML document
 */
function buildDashboardHtml(batch: BatchResult): string {
  const passRate = batch.totalTests > 0
    ? ((batch.passed / batch.totalTests) * 100).toFixed(1)
    : '0';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Audit Dashboard</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      background: #f5f5f5;
      color: #333;
    }
    .container { max-width: 1400px; margin: 0 auto; padding: 20px; }
    header {
      background: #1a1a2e;
      color: white;
      padding: 20px;
      margin-bottom: 20px;
      border-radius: 8px;
    }
    header h1 { font-size: 24px; margin-bottom: 10px; }
    .stats {
      display: flex;
      gap: 20px;
      flex-wrap: wrap;
    }
    .stat {
      background: rgba(255,255,255,0.1);
      padding: 10px 20px;
      border-radius: 4px;
    }
    .stat-value { font-size: 24px; font-weight: bold; }
    .stat-label { font-size: 12px; opacity: 0.8; }
    .stat.passed .stat-value { color: #4ade80; }
    .stat.failed .stat-value { color: #f87171; }
    .filters {
      background: white;
      padding: 15px;
      border-radius: 8px;
      margin-bottom: 20px;
      display: flex;
      gap: 15px;
      flex-wrap: wrap;
      align-items: center;
    }
    .filters label { font-weight: 500; }
    .filters select, .filters input {
      padding: 8px 12px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 14px;
    }
    .test-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
      gap: 20px;
    }
    .test-card {
      background: white;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .test-card.passed { border-left: 4px solid #4ade80; }
    .test-card.failed { border-left: 4px solid #f87171; }
    .test-header {
      padding: 15px;
      border-bottom: 1px solid #eee;
    }
    .test-title {
      font-size: 16px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .test-meta {
      font-size: 12px;
      color: #666;
      margin-top: 5px;
    }
    .test-body { padding: 15px; }
    .diff-previews {
      display: flex;
      gap: 10px;
      margin-bottom: 15px;
    }
    .diff-preview {
      flex: 1;
      text-align: center;
    }
    .diff-preview img {
      max-width: 100%;
      height: 150px;
      object-fit: cover;
      border: 1px solid #ddd;
      border-radius: 4px;
      cursor: pointer;
    }
    .diff-preview img:hover { border-color: #666; }
    .diff-preview .label {
      font-size: 11px;
      color: #666;
      margin-top: 4px;
    }
    .viewport-tabs {
      display: flex;
      gap: 5px;
      margin-bottom: 10px;
    }
    .viewport-tab {
      padding: 4px 10px;
      font-size: 12px;
      border: 1px solid #ddd;
      border-radius: 4px;
      cursor: pointer;
      background: white;
    }
    .viewport-tab.active { background: #333; color: white; border-color: #333; }
    .viewport-tab.passed { border-color: #4ade80; }
    .viewport-tab.failed { border-color: #f87171; }
    .issues-list { font-size: 13px; }
    .issue {
      padding: 8px;
      background: #f9f9f9;
      border-radius: 4px;
      margin-bottom: 5px;
      display: flex;
      gap: 8px;
      align-items: flex-start;
    }
    .issue-severity { font-size: 14px; }
    .issue-category {
      font-size: 10px;
      background: #eee;
      padding: 2px 6px;
      border-radius: 3px;
    }
    .modal {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.9);
      z-index: 1000;
      cursor: pointer;
    }
    .modal.active { display: flex; align-items: center; justify-content: center; }
    .modal img { max-width: 95%; max-height: 95%; object-fit: contain; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>🔍 Audit Dashboard</h1>
      <div class="stats">
        <div class="stat">
          <div class="stat-value">${batch.totalTests}</div>
          <div class="stat-label">Total Tests</div>
        </div>
        <div class="stat passed">
          <div class="stat-value">${batch.passed}</div>
          <div class="stat-label">Passed</div>
        </div>
        <div class="stat failed">
          <div class="stat-value">${batch.failed}</div>
          <div class="stat-label">Failed</div>
        </div>
        <div class="stat">
          <div class="stat-value">${passRate}%</div>
          <div class="stat-label">Pass Rate</div>
        </div>
        <div class="stat">
          <div class="stat-value">${formatDuration(batch.totalDuration)}</div>
          <div class="stat-label">Duration</div>
        </div>
      </div>
    </header>

    <div class="filters">
      <label>Filter:</label>
      <select id="statusFilter" onchange="filterTests()">
        <option value="all">All</option>
        <option value="passed">Passed</option>
        <option value="failed">Failed</option>
      </select>
      <input type="text" id="searchInput" placeholder="Search tests..." oninput="filterTests()">
    </div>

    <div class="test-grid" id="testGrid">
      ${batch.results.map((r) => renderTestCard(r)).join('\n')}
    </div>
  </div>

  <div class="modal" id="imageModal" onclick="closeModal()">
    <img id="modalImage" src="" alt="Preview">
  </div>

  <script>
    function filterTests() {
      const status = document.getElementById('statusFilter').value;
      const search = document.getElementById('searchInput').value.toLowerCase();
      const cards = document.querySelectorAll('.test-card');

      cards.forEach(card => {
        const cardStatus = card.classList.contains('passed') ? 'passed' : 'failed';
        const cardName = card.dataset.name.toLowerCase();

        const statusMatch = status === 'all' || cardStatus === status;
        const searchMatch = !search || cardName.includes(search);

        card.style.display = statusMatch && searchMatch ? 'block' : 'none';
      });
    }

    function openModal(src) {
      document.getElementById('modalImage').src = src;
      document.getElementById('imageModal').classList.add('active');
    }

    function closeModal() {
      document.getElementById('imageModal').classList.remove('active');
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeModal();
    });
  </script>
</body>
</html>`;
}

/**
 * Render individual test card
 */
function renderTestCard(result: AuditResult): string {
  const status = result.success ? 'passed' : 'failed';
  const statusIcon = result.success ? '✅' : '❌';

  // Get first viewport for preview
  const firstScreenshot = result.screenshots?.[0];

  let previewHtml = '';
  if (firstScreenshot) {
    // Use relative paths for images
    const originalRel = path.relative(AUDIT_CONFIG.outputDir, firstScreenshot.originalPath).replace(/\\/g, '/');
    const sanitizedRel = path.relative(AUDIT_CONFIG.outputDir, firstScreenshot.sanitizedPath).replace(/\\/g, '/');
    const diffRel = path.relative(AUDIT_CONFIG.outputDir, firstScreenshot.diffPath).replace(/\\/g, '/');

    previewHtml = `
      <div class="diff-previews">
        <div class="diff-preview">
          <img src="${originalRel}" alt="Original" onclick="openModal('${originalRel}')">
          <div class="label">Original</div>
        </div>
        <div class="diff-preview">
          <img src="${sanitizedRel}" alt="Sanitized" onclick="openModal('${sanitizedRel}')">
          <div class="label">Sanitized</div>
        </div>
        <div class="diff-preview">
          <img src="${diffRel}" alt="Diff" onclick="openModal('${diffRel}')">
          <div class="label">Diff</div>
        </div>
      </div>
    `;
  }

  // Viewport tabs
  let viewportTabsHtml = '';
  if (result.screenshots && result.screenshots.length > 1) {
    viewportTabsHtml = `
      <div class="viewport-tabs">
        ${result.screenshots.map((ss, i) => {
          const vpStatus = ss.stats.passThreshold ? 'passed' : 'failed';
          const active = i === 0 ? 'active' : '';
          return `<button class="viewport-tab ${vpStatus} ${active}">${ss.viewport} (${formatDiffPercentage(ss.stats.diffRatio)})</button>`;
        }).join('')}
      </div>
    `;
  }

  // Issues
  let issuesHtml = '';
  if (result.issues && result.issues.length > 0) {
    issuesHtml = `
      <div class="issues-list">
        ${result.issues.slice(0, 3).map((issue) => {
          const emoji = { high: '🔴', medium: '🟡', low: '🟢' }[issue.severity];
          return `
            <div class="issue">
              <span class="issue-severity">${emoji}</span>
              <span class="issue-category">${issue.category}</span>
              <span>${issue.description}</span>
            </div>
          `;
        }).join('')}
        ${result.issues.length > 3 ? `<div class="issue">... and ${result.issues.length - 3} more issues</div>` : ''}
      </div>
    `;
  }

  // Error message
  let errorHtml = '';
  if (result.error) {
    errorHtml = `<div class="issue"><span class="issue-severity">❌</span><span>${result.error}</span></div>`;
  }

  return `
    <div class="test-card ${status}" data-name="${result.testSlug}">
      <div class="test-header">
        <div class="test-title">
          <span>${statusIcon}</span>
          <span>${result.testSlug}</span>
        </div>
        <div class="test-meta">${result.manifest.name} • ${formatDuration(result.duration)}</div>
      </div>
      <div class="test-body">
        ${viewportTabsHtml}
        ${previewHtml}
        ${issuesHtml}
        ${errorHtml}
      </div>
    </div>
  `;
}

/**
 * Format duration
 */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const min = Math.floor(ms / 60000);
  const sec = Math.round((ms % 60000) / 1000);
  return `${min}m ${sec}s`;
}
