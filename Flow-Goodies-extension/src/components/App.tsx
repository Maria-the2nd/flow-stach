import React, { useState } from 'react';
import { sampleComponents } from '../data/sampleComponents';
import { ComponentGrid } from './ComponentGrid';
import { SearchBar } from './SearchBar';
import './App.css';

export const App: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  // Get unique categories
  const categories = ['All', ...new Set(sampleComponents.map(c => c.category))];

  // Filter components
  const filteredComponents = sampleComponents.filter(component => {
    const matchesSearch = 
      component.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      component.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      component.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesCategory = 
      selectedCategory === 'All' || component.category === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

  // Debug: Log to console
  console.log('Sample components:', sampleComponents);
  console.log('Filtered components:', filteredComponents);
  console.log('Selected category:', selectedCategory);

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">Flow Stash</h1>
        <p className="app-subtitle">Premium Webflow Components</p>
      </header>

      <SearchBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        categories={categories}
        selectedCategory={selectedCategory}
        onCategoryChange={setSelectedCategory}
      />

      <ComponentGrid components={filteredComponents} />

      {filteredComponents.length === 0 && (
        <div className="empty-state">
          <p>No components found</p>
          <p className="empty-subtitle">Try adjusting your search or filters</p>
        </div>
      )}
    </div>
  );
};
