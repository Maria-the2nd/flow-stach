export const PUBLIC_TEMPLATES = [
    {
        id: 't-1',
        name: 'SaaS Starter Kit',
        description: 'A complete landing page for SaaS products with pricing and features.',
        price: '$49',
        image: '/prototype/saas_starter.png'
    },
    {
        id: 't-2',
        name: 'Portfolio Minimal',
        description: 'Clean and minimal portfolio template for creatives.',
        price: 'Free',
        image: '/prototype/portfolio_minimal.png'
    },
    {
        id: 't-3',
        name: 'E-commerce Store',
        description: 'Modern e-commerce grid layouts with cart drawer.',
        price: '$79',
        image: '/prototype/ecommerce_store.png'
    }
];

export const PUBLIC_COMPONENTS = [
    {
        id: 'c-1',
        name: 'Hero Section B',
        description: 'Bold hero section with gradient background and CTA buttons.',
        price: '$19',
        image: '/prototype/hero_section.png'
    },
    {
        id: 'c-2',
        name: 'Feature Grid',
        description: 'Responsive 3-column feature grid with icons and descriptions.',
        price: 'Free',
        image: '/prototype/feature_grid.png'
    },
    {
        id: 'c-3',
        name: 'Pricing Table',
        description: 'Modern pricing cards with toggle for monthly/yearly plans.',
        price: '$29',
        image: '/prototype/pricing_table.png'
    }
];

export const PUBLIC_TOOLS = [
    {
        id: 'tool-1',
        name: 'HTML to Webflow',
        description: 'Convert raw HTML/CSS into proper Webflow structures.',
        icon: 'code'
    },
    {
        id: 'tool-2',
        name: 'Code to Components',
        description: 'Extract React components from arbitrary code snippets.',
        icon: 'boxes'
    }
];

export const USER_PROJECTS = [
    {
        id: 'p-1',
        name: 'Marketing Campaign Q1',
        description: 'Global marketing push for the new Q1 products with glassmorphism UI.',
        image: '/prototype/project_marketing.png',
        importedDate: '2023-10-15',
        componentCount: 12,
        status: 'Ready',
        statusColor: 'bg-green-500'
    },
    {
        id: 'p-2',
        name: 'FLOW BRIDGE',
        description: 'Advanced bridge between design systems and semantic code architectures.',
        image: '/prototype/project_blog.png',
        importedDate: '2023-10-12',
        componentCount: 45,
        status: 'Fonts Missing',
        statusColor: 'bg-amber-500'
    }
];

export const USER_LIBRARY = [
    {
        id: 'ul-1',
        name: 'My Custom Blog',
        description: 'Derived from "Legacy Blog Import"',
        thumbnail: 'https://placehold.co/600x400/cbd5e1/475569?text=Blog+Template'
    }
];

export const USER_COMPONENTS = [
    {
        id: 'uc-1',
        name: 'Newsletter Signup',
        source: 'Imported',
        sourceColor: 'bg-blue-100 text-blue-800'
    },
    {
        id: 'uc-2',
        name: 'Hero Section B',
        source: 'Marketplace',
        sourceColor: 'bg-purple-100 text-purple-800'
    },
    {
        id: 'uc-3',
        name: 'Footer Dark',
        source: 'Template',
        sourceColor: 'bg-emerald-100 text-emerald-800'
    }
];

export const PROJECT_DETAILS = {
    overview: {
        summary: 'Imported from https://example.com/campaign-q1 via HTML Upload.',
        fontChecklist: [
            { name: 'Inter', status: 'Available' },
            { name: 'Merriweather', status: 'Missing', warning: true }
        ],
        designTokens: {
            colors: [
                { name: 'Primary Blue', value: '#2563eb' },
                { name: 'Surface White', value: '#ffffff' },
                { name: 'Slate 500', value: '#64748b' }
            ],
            typography: [
                { name: 'Heading', value: '700 2.25rem Inter' },
                { name: 'Body', value: '400 1rem Inter' }
            ]
        }
    },
    artifacts: [
        { name: 'hero_image.png', type: 'Image', size: '1.2MB' },
        { name: 'styles.css', type: 'CSS', size: '14KB' },
        { name: 'content.json', type: 'JSON', size: '2KB' }
    ],
    code: {
        html: '<div class="hero">\n  <h1>Global Marketing</h1>\n  <button class="btn-primary">Launch Now</button>\n</div>',
        css: '.hero {\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  padding: 4rem;\n  background: rgba(255, 255, 255, 0.8);\n  backdrop-filter: blur(20px);\n}\n\n.btn-primary {\n  background: #2563eb;\n  color: white;\n  padding: 0.75rem 1.5rem;\n  border-radius: 0.5rem;\n}',
        js: '// Semantic Action Handler\ndocument.querySelector(".btn-primary").addEventListener("click", () => {\n  console.log("Bridge action triggered");\n  // Handle local state or navigation\n});'
    },
    prompts: {
        import: 'Analyze this HTML and extract semantic components.',
        system: 'You are an expert frontend architect.',
        model: 'GPT-4-Turbo'
    },
    embeds: [
        { type: 'JavaScript', content: '// Lenis Smooth Scroll Init\nconst lenis = new Lenis();\nfunction raf(time) {\n  lenis.raf(time);\n  requestAnimationFrame(raf);\n}\nrequestAnimationFrame(raf);' },
        { type: 'CSS', content: '/* Custom Scrollbar */\n::-webkit-scrollbar {\n  width: 8px;\n}\n::-webkit-scrollbar-thumb {\n  background: #2563eb;\n  border-radius: 10px;\n}' }
    ]
};
