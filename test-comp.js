import { componentizeHtml } from "./lib/componentizer";

const html = `
<body>
    <!-- Navigation -->
    <nav class="nav">
        <a href="#" class="nav-logo">Logo</a>
    </nav>

    <!-- Hero -->
    <section class="hero">
        <div class="hero-inner">
            <h1>Hero Title</h1>
        </div>
    </section>

    <!-- Bento Features Section -->
    <section class="section" id="features">
        <div class="container">Content</div>
    </section>
</body>
`;

const result = componentizeHtml(html);
console.log('Components found:', result.components.map(c => c.name));
