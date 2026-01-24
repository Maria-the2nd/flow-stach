/**
 * Image Extractor for HTML and CSS
 * Detects all image assets and classifies them
 */

export interface ImageAsset {
    url: string;
    type: string;
    estimatedSize?: number;
    sizeWarning: boolean;
    blocked: boolean;
    classification: 'absolute' | 'relative' | 'data-uri';
}

/**
 * Extract all unique image assets from HTML and CSS
 */
export function extractImages(html: string, css: string): ImageAsset[] {
    const imageUrls = new Set<string>();
    const assets: ImageAsset[] = [];

    // 1. Extract from <img> tags
    const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
    let match;
    while ((match = imgRegex.exec(html)) !== null) {
        imageUrls.add(match[1].trim());
    }

    // 2. Extract from style attributes (background-image)
    const styleImgRegex = /style=["'][^"']*background-image\s*:\s*url\((?:['"]?)([^'"]+)(?:['"]?)\)[^"']*["']/gi;
    while ((match = styleImgRegex.exec(html)) !== null) {
        imageUrls.add(match[1].trim());
    }

    // 3. Extract from CSS content
    const cssImgRegex = /url\(['"]?([^'"]+?)['"]?\)/gi;
    while ((match = cssImgRegex.exec(css)) !== null) {
        // Avoid capturing data: URIs that are fonts
        const url = match[1].trim();
        if (!url.startsWith('data:font') && !url.startsWith('data:application/font')) {
            imageUrls.add(url);
        }
    }

    // Process and classify each unique URL
    imageUrls.forEach(url => {
        if (!url) return;

        const classification = classifyUrl(url);
        const type = detectType(url);

        // Estimate size for data URIs
        let estimatedSize = undefined;
        if (classification === 'data-uri') {
            const base64Data = url.split(',')[1] || '';
            estimatedSize = Math.floor((base64Data.length * 3) / 4);
        }

        const isOversized = (estimatedSize || 0) > 1024 * 1024; // > 1MB

        assets.push({
            url,
            type,
            estimatedSize,
            classification,
            sizeWarning: isOversized,
            blocked: classification === 'relative' || isOversized,
        });
    });

    return assets;
}

function classifyUrl(url: string): 'absolute' | 'relative' | 'data-uri' {
    if (url.startsWith('data:')) return 'data-uri';
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('//')) return 'absolute';
    return 'relative';
}

function detectType(url: string): string {
    if (url.startsWith('data:')) {
        const match = url.match(/^data:([^;]+);/);
        return match ? match[1] : 'image/unknown';
    }

    const extMatch = url.split(/[?#]/)[0].match(/\.([a-z0-9]+)$/i);
    if (extMatch) {
        const ext = extMatch[1].toLowerCase();
        const mimeMap: Record<string, string> = {
            'png': 'image/png',
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'gif': 'image/gif',
            'svg': 'image/svg+xml',
            'webp': 'image/webp',
            'avif': 'image/avif',
        };
        return mimeMap[ext] || `image/${ext}`;
    }

    return 'image/unknown';
}
