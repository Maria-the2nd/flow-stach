# Component Patterns

HTML structures for all Warm Serene Luxury components.

## Navigation

```html
<nav class="nav">
  <div class="nav-container">
    <a href="/" class="nav-logo">
      <span class="logo-name">Brand</span>
      <span class="logo-tagline">Tagline</span>
    </a>
    
    <div class="nav-links">
      <a href="#spaces" class="nav-link">
        Spaces
        <span class="nav-link-count">(03)</span>
      </a>
      <a href="#features" class="nav-link">Features</a>
    </div>
    
    <button class="nav-toggle" id="navToggle">
      <span></span>
      <span></span>
      <span></span>
    </button>
    
    <a href="#contact" class="btn btn-primary nav-cta">Book Now</a>
  </div>
</nav>

<!-- Mobile Menu (outside nav, after it) -->
<div class="nav-mobile" id="navMobile">
  <a href="#spaces">Spaces (03)</a>
  <a href="#features">Features</a>
  <a href="#contact" class="btn btn-primary">Book Now</a>
</div>
```

## Hero with Tabs

```html
<section class="hero">
  <div class="container">
    <div class="grid">
      <div class="hero-content fade-in">
        <h1 class="display hero-title">Brand<br>Name</h1>
        <p class="hero-tagline">Tagline for the brand.</p>
        <div class="hero-actions">
          <a href="#contact" class="btn btn-primary">Primary CTA</a>
          <a href="#features" class="btn btn-secondary">Secondary</a>
        </div>
      </div>
      
      <div class="hero-tabs stagger-children">
        <button class="hero-tab active">
          <span class="tab-label">Space</span>
          <span class="tab-number">(01)</span>
          <span class="tab-name">First</span>
        </button>
        <button class="hero-tab">
          <span class="tab-label">Space</span>
          <span class="tab-number">(02)</span>
          <span class="tab-name">Second</span>
        </button>
      </div>
    </div>
  </div>
</section>
```

## Room/Item Card

```html
<article class="room-card">
  <div class="room-card-content">
    <div class="room-preview-header">
      <span class="room-number">(01)</span>
      <h3 class="room-title">Item Name</h3>
      <p class="room-tagline">Short description.</p>
      <a href="#" class="room-link">Learn More →</a>
    </div>
    <div class="room-specs">
      <div class="spec">
        <span class="spec-value">68m²</span>
        <span class="spec-label">Area</span>
      </div>
      <div class="spec">
        <span class="spec-value">4.2m</span>
        <span class="spec-label">Height</span>
      </div>
    </div>
  </div>
  <div class="room-card-images">
    <div class="room-card-image main">
      <img src="main.jpg" alt="">
    </div>
    <div class="room-card-image secondary">
      <img src="detail.jpg" alt="">
    </div>
  </div>
</article>
```

## Stats Row

```html
<div class="stats-row stagger-children">
  <div class="stat">
    <span class="stat-value">850+</span>
    <span class="stat-label">Happy Members</span>
  </div>
  <div class="stat">
    <span class="stat-value">98%</span>
    <span class="stat-label">Return Rate</span>
  </div>
</div>
```

## Section Header

```html
<header class="section-header fade-in">
  <span class="section-label">Label</span>
  <h2 class="display section-title">Headline</h2>
  <p class="section-description">Description text.</p>
  <a href="#" class="btn btn-secondary">CTA</a>
</header>
```

## Info Cards Row

```html
<div class="info-cards stagger-children">
  <div class="info-card">
    <span class="info-label">Hours</span>
    <span class="info-value">Mon–Sun: 9 AM – 8 PM</span>
  </div>
  <div class="info-card">
    <span class="info-label">Location</span>
    <span class="info-value">123 Street, City</span>
  </div>
</div>
```

## Features Grid

```html
<div class="features-grid stagger-children">
  <div class="feature-category">
    <h3>Category</h3>
    <ul class="feature-list">
      <li class="feature-item">Feature 1</li>
      <li class="feature-item">Feature 2</li>
    </ul>
  </div>
</div>
```

## Gallery Grid

```html
<div class="gallery-grid stagger-children">
  <div class="gallery-item tall">
    <img src="tall.jpg" alt="">
  </div>
  <div class="gallery-item">
    <img src="square.jpg" alt="">
  </div>
  <div class="gallery-item wide">
    <img src="wide.jpg" alt="">
  </div>
</div>
```

## Testimonial

```html
<blockquote class="testimonial">
  <p class="testimonial-quote">"Quote text here."</p>
  <footer class="testimonial-author">
    <div class="testimonial-avatar">
      <img src="avatar.jpg" alt="">
    </div>
    <div>
      <cite class="testimonial-name">Name</cite>
      <span class="testimonial-project">Role</span>
    </div>
  </footer>
</blockquote>
```

## Contact Cards

```html
<div class="contact-cards stagger-children">
  <a href="https://maps.google.com" class="contact-card">
    <span class="contact-card-label">Visit Us</span>
    <span class="contact-card-value">123 Street, City</span>
  </a>
  <a href="tel:+1234567890" class="contact-card">
    <span class="contact-card-label">Call Us</span>
    <span class="contact-card-value">+1 (234) 567-890</span>
  </a>
</div>
```

## Footer

```html
<footer class="footer">
  <div class="container">
    <div class="footer-grid stagger-children">
      <div class="footer-brand">
        <a href="/" class="nav-logo">
          <span class="logo-name">Brand</span>
          <span class="logo-tagline">Tagline</span>
        </a>
        <p class="footer-description">Description.</p>
        <p class="footer-copyright">© 2025 Brand. All rights reserved.</p>
      </div>
      
      <div class="footer-column">
        <h4>Menu</h4>
        <a href="#">Link</a>
      </div>
    </div>
  </div>
</footer>
```

## Animation Classes

Add these classes for micro-interactions:
- `.fade-in` — Fade up on scroll
- `.stagger-children` — Children cascade in sequence
- `.image-reveal` — Image scales from 1.1 to 1
