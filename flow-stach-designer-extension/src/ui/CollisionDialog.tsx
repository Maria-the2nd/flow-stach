/**
 * Collision Dialog Component
 * Shows collision warnings and lets user choose which classes to skip
 */

import React, { useState } from 'react';
import type { CollisionReport } from '../types';

interface CollisionDialogProps {
  report: CollisionReport;
  onConfirm: (skipClasses: string[]) => void;
  onCancel: () => void;
}

export function CollisionDialog({ report, onConfirm, onCancel }: CollisionDialogProps) {
  const [selectedSkip, setSelectedSkip] = useState<Set<string>>(
    new Set(report.existingClasses)
  );

  const handleToggle = (className: string) => {
    const newSet = new Set(selectedSkip);
    if (newSet.has(className)) {
      newSet.delete(className);
    } else {
      newSet.add(className);
    }
    setSelectedSkip(newSet);
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '8px',
        padding: '24px',
        maxWidth: '500px',
        width: '90%',
        maxHeight: '80vh',
        overflow: 'auto',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
      }}>
        <h3 style={{
          margin: '0 0 16px 0',
          fontSize: '18px',
          fontWeight: '600',
          color: '#1a1a1a'
        }}>
          Class Name Collisions Detected
        </h3>
        
        <p style={{
          margin: '0 0 16px 0',
          fontSize: '14px',
          color: '#666'
        }}>
          The following classes already exist in this site:
        </p>
        
        <ul style={{
          listStyle: 'none',
          padding: 0,
          margin: '0 0 16px 0',
          maxHeight: '300px',
          overflow: 'auto'
        }}>
          {report.existingClasses.map(className => (
            <li key={className} style={{
              padding: '8px 0',
              borderBottom: '1px solid #e5e5e5'
            }}>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                cursor: 'pointer',
                fontSize: '14px'
              }}>
                <input
                  type="checkbox"
                  checked={selectedSkip.has(className)}
                  onChange={() => handleToggle(className)}
                  style={{
                    marginRight: '8px',
                    cursor: 'pointer'
                  }}
                />
                <code style={{
                  backgroundColor: '#f5f5f5',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  fontSize: '13px',
                  fontFamily: 'monospace'
                }}>
                  .{className}
                </code>
              </label>
            </li>
          ))}
        </ul>
        
        <p style={{
          margin: '0 0 16px 0',
          fontSize: '13px',
          color: '#666',
          fontStyle: 'italic'
        }}>
          Selected classes will be skipped (existing styles will be used).
        </p>
        
        <div style={{
          display: 'flex',
          gap: '8px',
          justifyContent: 'flex-end'
        }}>
          <button
            onClick={onCancel}
            style={{
              padding: '8px 16px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              backgroundColor: '#fff',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(Array.from(selectedSkip))}
            style={{
              padding: '8px 16px',
              border: 'none',
              borderRadius: '4px',
              backgroundColor: '#0066cc',
              color: '#fff',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            Install (Skip Selected)
          </button>
        </div>
      </div>
    </div>
  );
}
