import { Component } from '../types/component';

// Sample components for testing
export const sampleComponents: Component[] = [
  {
    id: 'hero-1',
    name: 'Hero Section',
    description: 'Modern hero section with gradient background',
    category: 'Hero',
    thumbnail: '', // TODO: Add thumbnail
    html: `
      <div class="hero-section">
        <div class="hero-content">
          <h1 class="hero-title">Welcome to Your Website</h1>
          <p class="hero-subtitle">Build amazing things with ease</p>
          <button class="hero-button">Get Started</button>
        </div>
      </div>
    `,
    css: `
      .hero-section {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        padding: 2rem;
      }
      
      .hero-content {
        text-align: center;
        color: white;
        max-width: 800px;
      }
      
      .hero-title {
        font-size: 3rem;
        font-weight: bold;
        margin-bottom: 1rem;
      }
      
      .hero-subtitle {
        font-size: 1.5rem;
        margin-bottom: 2rem;
        opacity: 0.9;
      }
      
      .hero-button {
        background: white;
        color: #667eea;
        padding: 1rem 2rem;
        border: none;
        border-radius: 8px;
        font-size: 1rem;
        font-weight: 600;
        cursor: pointer;
        transition: transform 0.2s;
      }
      
      .hero-button:hover {
        transform: scale(1.05);
      }
    `,
    tags: ['hero', 'gradient', 'modern'],
    isPremium: false,
  },
  {
    id: 'card-1',
    name: 'Feature Card',
    description: 'Clean card component with hover effect',
    category: 'Card',
    thumbnail: '',
    html: `
      <div class="feature-card">
        <div class="card-icon">✨</div>
        <h3 class="card-title">Amazing Feature</h3>
        <p class="card-description">This is a description of an amazing feature that will help your users.</p>
      </div>
    `,
    css: `
      .feature-card {
        background: white;
        border-radius: 12px;
        padding: 2rem;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        transition: transform 0.3s, box-shadow 0.3s;
        cursor: pointer;
      }
      
      .feature-card:hover {
        transform: translateY(-8px);
        box-shadow: 0 12px 24px rgba(0, 0, 0, 0.15);
      }
      
      .card-icon {
        font-size: 3rem;
        margin-bottom: 1rem;
      }
      
      .card-title {
        font-size: 1.5rem;
        font-weight: 600;
        margin-bottom: 0.5rem;
        color: #333;
      }
      
      .card-description {
        color: #666;
        line-height: 1.6;
      }
    `,
    tags: ['card', 'feature', 'hover'],
    isPremium: false,
  },
  {
    id: 'nav-1',
    name: 'Navigation Bar',
    description: 'Responsive navigation with logo and menu',
    category: 'Navigation',
    thumbnail: '',
    html: `
      <nav class="navbar">
        <div class="nav-container">
          <div class="nav-logo">Logo</div>
          <div class="nav-menu">
            <a href="#" class="nav-link">Home</a>
            <a href="#" class="nav-link">About</a>
            <a href="#" class="nav-link">Services</a>
            <a href="#" class="nav-link">Contact</a>
          </div>
        </div>
      </nav>
    `,
    css: `
      .navbar {
        background: white;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        position: sticky;
        top: 0;
        z-index: 1000;
      }
      
      .nav-container {
        max-width: 1200px;
        margin: 0 auto;
        padding: 1rem 2rem;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      
      .nav-logo {
        font-size: 1.5rem;
        font-weight: bold;
        color: #333;
      }
      
      .nav-menu {
        display: flex;
        gap: 2rem;
      }
      
      .nav-link {
        color: #666;
        text-decoration: none;
        font-weight: 500;
        transition: color 0.3s;
      }
      
      .nav-link:hover {
        color: #667eea;
      }
    `,
    tags: ['navigation', 'header', 'responsive'],
    isPremium: false,
  },
];
