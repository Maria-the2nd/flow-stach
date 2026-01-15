/**
 * Flow Stach Designer Extension Entry Point
 * Initializes the extension and sets up the UI panel
 */

import { initializePanel } from './ui/panel';

// Initialize extension when Webflow Designer is ready
function init() {
  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initializePanel();
    });
  } else {
    initializePanel();
  }
}

// Check if we're in the panel HTML context
if (document.getElementById('root')) {
  console.log('[Flow Stach Extension] Initializing panel...');
  init();
} else {
  console.log('[Flow Stach Extension] Waiting for panel to load...');
  // Panel will be loaded separately via HTML
}
