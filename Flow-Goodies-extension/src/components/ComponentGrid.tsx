import React from 'react';
import { Component } from '../types/component';
import { ComponentCard } from './ComponentCard';

interface ComponentGridProps {
  components: Component[];
}

export const ComponentGrid: React.FC<ComponentGridProps> = ({ components }) => {
  return (
    <div className="component-grid">
      {components.map((component) => (
        <ComponentCard key={component.id} component={component} />
      ))}
    </div>
  );
};
