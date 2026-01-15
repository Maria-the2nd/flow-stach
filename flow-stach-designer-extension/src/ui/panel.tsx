/**
 * Extension UI Panel
 * Main React component for the extension interface
 */

import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { ClipboardMonitor } from '../clipboard/monitor';
import { detectCollisions } from '../collision/detector';
import { installPayload } from '../injector/dom';
import { CollisionDialog } from './CollisionDialog';
import type { ClipboardPayload, CollisionReport, InstallResult } from '../types';

function ExtensionPanel() {
  const [detectedPayload, setDetectedPayload] = useState<ClipboardPayload | null>(null);
  const [collisionReport, setCollisionReport] = useState<CollisionReport | null>(null);
  const [isInstalling, setIsInstalling] = useState(false);
  const [installResult, setInstallResult] = useState<InstallResult | null>(null);
  const [monitor, setMonitor] = useState<ClipboardMonitor | null>(null);

  useEffect(() => {
    const clipboardMonitor = new ClipboardMonitor();
    clipboardMonitor.start();
    setMonitor(clipboardMonitor);

    const handler = (e: Event) => {
      const customEvent = e as CustomEvent<{ payload: ClipboardPayload }>;
      setDetectedPayload(customEvent.detail.payload);
      // Reset install result when new payload detected
      setInstallResult(null);
      setCollisionReport(null);
    };

    window.addEventListener('flowstach:payload-detected', handler as EventListener);
    
    return () => {
      clipboardMonitor.stop();
      window.removeEventListener('flowstach:payload-detected', handler as EventListener);
    };
  }, []);

  async function handleInstall() {
    if (!detectedPayload) return;

    setIsInstalling(true);
    setInstallResult(null);
    
    try {
      // 1. Detect collisions
      const report = await detectCollisions(detectedPayload);
      setCollisionReport(report);

      // 2. Show collision dialog if needed
      if (report.existingClasses.length > 0) {
        // User will confirm in dialog
        setIsInstalling(false);
        return;
      }

      // 3. Install directly if no collisions
      const result = await installPayload(detectedPayload, []);
      setInstallResult(result);
    } catch (error) {
      console.error('[Flow Stach] Install error:', error);
      setInstallResult({
        success: false,
        nodesCreated: 0,
        classesCreated: 0,
        classesSkipped: 0,
        variablesCreated: 0,
        errors: [error instanceof Error ? error.message : String(error)]
      });
    } finally {
      setIsInstalling(false);
    }
  }

  async function handleConfirmInstall(skipClasses: string[]) {
    if (!detectedPayload) return;

    setIsInstalling(true);
    setCollisionReport(null);
    
    try {
      const result = await installPayload(detectedPayload, skipClasses);
      setInstallResult(result);
    } catch (error) {
      console.error('[Flow Stach] Install error:', error);
      setInstallResult({
        success: false,
        nodesCreated: 0,
        classesCreated: 0,
        classesSkipped: 0,
        variablesCreated: 0,
        errors: [error instanceof Error ? error.message : String(error)]
      });
    } finally {
      setIsInstalling(false);
    }
  }

  function handleCancelCollision() {
    setCollisionReport(null);
    setIsInstalling(false);
  }

  return (
    <div style={{
      padding: '16px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      fontSize: '14px',
      color: '#1a1a1a'
    }}>
      <h2 style={{
        margin: '0 0 16px 0',
        fontSize: '18px',
        fontWeight: '600'
      }}>
        Flow Stach Installer
      </h2>

      {detectedPayload ? (
        <div>
          <div style={{
            backgroundColor: '#f0f9ff',
            border: '1px solid #bae6fd',
            borderRadius: '6px',
            padding: '12px',
            marginBottom: '16px'
          }}>
            <p style={{ margin: '0 0 4px 0', fontWeight: '500' }}>
              ✓ Payload detected
            </p>
            <p style={{ margin: 0, fontSize: '13px', color: '#666' }}>
              {detectedPayload.payload.nodes.length} nodes, {detectedPayload.payload.styles.length} classes
            </p>
          </div>

          {installResult && (
            <div style={{
              backgroundColor: installResult.success ? '#f0fdf4' : '#fef2f2',
              border: `1px solid ${installResult.success ? '#86efac' : '#fca5a5'}`,
              borderRadius: '6px',
              padding: '12px',
              marginBottom: '16px'
            }}>
              <p style={{ margin: '0 0 4px 0', fontWeight: '500' }}>
                {installResult.success ? '✓ Install complete' : '✗ Install failed'}
              </p>
              <p style={{ margin: 0, fontSize: '13px', color: '#666' }}>
                {installResult.classesCreated} classes created, {installResult.nodesCreated} nodes created
                {installResult.variablesCreated > 0 && `, ${installResult.variablesCreated} variables created`}
              </p>
              {installResult.errors && installResult.errors.length > 0 && (
                <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px', fontSize: '12px', color: '#dc2626' }}>
                  {installResult.errors.map((error, i) => (
                    <li key={i}>{error}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <button
            onClick={handleInstall}
            disabled={isInstalling}
            style={{
              width: '100%',
              padding: '10px 16px',
              border: 'none',
              borderRadius: '6px',
              backgroundColor: isInstalling ? '#ccc' : '#0066cc',
              color: '#fff',
              cursor: isInstalling ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            {isInstalling ? 'Installing...' : 'Install Component'}
          </button>

          {collisionReport && collisionReport.existingClasses.length > 0 && (
            <CollisionDialog
              report={collisionReport}
              onConfirm={handleConfirmInstall}
              onCancel={handleCancelCollision}
            />
          )}
        </div>
      ) : (
        <div style={{
          textAlign: 'center',
          padding: '24px 0',
          color: '#666'
        }}>
          <p style={{ margin: 0 }}>
            Copy a Flow Stach component to clipboard...
          </p>
          <p style={{ margin: '8px 0 0 0', fontSize: '12px' }}>
            The extension will automatically detect @webflow/XscpData payloads
          </p>
        </div>
      )}

      {monitor && (
        <div style={{
          marginTop: '16px',
          paddingTop: '16px',
          borderTop: '1px solid #e5e5e5',
          fontSize: '12px',
          color: '#999'
        }}>
          <p style={{ margin: 0 }}>
            Monitor: {monitor.isActive() ? '✓ Active' : '✗ Inactive'}
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Initialize the extension panel
 */
export function initializePanel(): void {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    console.error('[Flow Stach] Root element not found');
    return;
  }

  const root = createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <ExtensionPanel />
    </React.StrictMode>
  );
  
  console.log('[Flow Stach Extension] Panel initialized');
}
