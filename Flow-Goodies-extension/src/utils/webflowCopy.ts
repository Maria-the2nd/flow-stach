import { Component, WebflowClipboardData, WebflowNode, WebflowStyle } from '../types/component';

// Generate unique ID for Webflow
function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Parse HTML string to DOM nodes
function parseHTML(htmlString: string): HTMLElement {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlString, 'text/html');
  return doc.body.firstElementChild as HTMLElement;
}

// Convert DOM element to Webflow node structure
function convertToWebflowNode(element: HTMLElement): WebflowNode {
  const node: WebflowNode = {
    _id: generateId(),
    type: 'Block',
    tag: element.tagName.toLowerCase(),
    classes: Array.from(element.classList),
    children: [],
  };

  // Handle text content
  if (element.childNodes.length === 1 && element.childNodes[0].nodeType === Node.TEXT_NODE) {
    const textContent = element.textContent?.trim();
    if (textContent) {
      node.data = {
        text: textContent,
      };
    }
  } else {
    // Convert child elements
    Array.from(element.children).forEach((child) => {
      if (child instanceof HTMLElement) {
        node.children.push(convertToWebflowNode(child));
      }
    });
  }

  return node;
}

// Parse CSS and extract class styles
function parseCSSToWebflowStyles(css: string): WebflowStyle[] {
  const styles: WebflowStyle[] = [];
  
  // Simple regex to extract class rules (this is basic - can be improved)
  const classRegex = /\.([a-zA-Z0-9_-]+)\s*\{([^}]+)\}/g;
  let match;

  while ((match = classRegex.exec(css)) !== null) {
    const className = match[1];
    const rules = match[2].trim();

    styles.push({
      _id: generateId(),
      name: className,
      styleLess: rules,
      type: 'class',
    });
  }

  return styles;
}

// Get existing class names from current Webflow project (to avoid duplicates)
async function getExistingClassNames(): Promise<Set<string>> {
  try {
    // Get all styles from the current site
    const styles = await webflow.getAllStyles();
    // getName() returns a Promise, so we need to await all of them
    const names = await Promise.all(styles.map(style => style.getName()));
    return new Set(names);
  } catch (error) {
    console.warn('Could not fetch existing styles:', error);
    return new Set();
  }
}

// Main function to copy component to Webflow
export async function copyComponentToWebflow(component: Component): Promise<void> {
  try {
    // Parse HTML to get structure
    const rootElement = parseHTML(component.html);
    const nodes = [convertToWebflowNode(rootElement)];

    // Parse CSS to get styles
    let styles = parseCSSToWebflowStyles(component.css);

    // Check for duplicate class names
    const existingClasses = await getExistingClassNames();
    const usedClassNames = new Set<string>();

    // Filter out duplicate styles, keeping track of unique names
    styles = styles.filter(style => {
      if (existingClasses.has(style.name) || usedClassNames.has(style.name)) {
        console.log(`Skipping duplicate class: ${style.name}`);
        return false;
      }
      usedClassNames.add(style.name);
      return true;
    });

    // Create Webflow clipboard data
    const clipboardData: WebflowClipboardData = {
      type: '@webflow/XscpData',
      payload: {
        nodes,
        styles,
        assets: [],
      },
    };

    // Convert to JSON string
    const jsonString = JSON.stringify(clipboardData);

    // Write to clipboard
    const blob = new Blob([jsonString], { type: 'application/json' });
    const clipboardItem = new ClipboardItem({
      'application/json': blob,
    });

    await navigator.clipboard.write([clipboardItem]);

    console.log('✓ Component copied to clipboard');
    console.log(`✓ ${nodes.length} node(s), ${styles.length} style(s)`);

    // Show JavaScript alert if component has JS
    if (component.javascript) {
      alert(
        `⚠️ This component includes JavaScript.
        
Please paste the component first, then:
1. Go to Page Settings → Custom Code
2. Add this code to the <body> section:

<script>
${component.javascript}
</script>`
      );
    }
  } catch (error) {
    console.error('Failed to copy component:', error);
    throw new Error('Failed to copy component. Please try again.');
  }
}
