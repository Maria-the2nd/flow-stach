import React, { useState } from 'react';
import { Component } from '../types/component';
import { copyComponentToWebflow } from '../utils/webflowCopy';

interface ComponentCardProps {
  component: Component;
}

export const ComponentCard: React.FC<ComponentCardProps> = ({ component }) => {
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copying' | 'success' | 'error'>('idle');

  const handleCopy = async () => {
    setCopyStatus('copying');
    
    try {
      await copyComponentToWebflow(component);
      setCopyStatus('success');
      
      // Reset status after 2 seconds
      setTimeout(() => setCopyStatus('idle'), 2000);
    } catch (error) {
      console.error('Copy failed:', error);
      setCopyStatus('error');
      setTimeout(() => setCopyStatus('idle'), 2000);
    }
  };

  const getButtonText = () => {
    switch (copyStatus) {
      case 'copying':
        return 'Copying...';
      case 'success':
        return '✓ Copied!';
      case 'error':
        return '✗ Error';
      default:
        return 'Copy to Webflow';
    }
  };

  return (
    <div className="component-card">
      <div className="card-preview">
        {component.thumbnail ? (
          <img src={component.thumbnail} alt={component.name} />
        ) : (
          <div className="preview-placeholder">
            <span className="preview-icon">{component.category[0]}</span>
          </div>
        )}
      </div>
      
      <div className="card-content">
        <div className="card-header">
          <h3 className="card-title">{component.name}</h3>
          {component.isPremium && <span className="premium-badge">PRO</span>}
        </div>
        
        <p className="card-description">{component.description}</p>
        
        <div className="card-tags">
          {component.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="tag">{tag}</span>
          ))}
        </div>
        
        <button
          className={`copy-button ${copyStatus}`}
          onClick={handleCopy}
          disabled={copyStatus === 'copying'}
        >
          {getButtonText()}
        </button>
      </div>
    </div>
  );
};
