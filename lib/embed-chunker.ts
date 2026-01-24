/**
 * Embed Chunker
 *
 * Splits large CSS, JS, and HTML embeds into smaller chunks that fit within
 * Webflow's custom code size limits. Respects syntax boundaries to ensure
 * valid code in each chunk.
 */

export interface EmbedChunk {
  index: number;
  content: string;
  size: number;
  type: 'css' | 'js' | 'html';
}

export interface ChunkedEmbedResult {
  wasChunked: boolean;
  chunks: EmbedChunk[];
  totalSize: number;
  originalSize: number;
  instructions: string[];
}

const DEFAULT_MAX_SIZE = 40_000; // 40KB soft limit (provides safety margin)

/**
 * Parse CSS into complete rules (preserving rule boundaries)
 */
function parseCSSRules(css: string): string[] {
  const rules: string[] = [];
  let currentRule = '';
  let braceDepth = 0;
  let inString = false;
  let stringChar = '';

  for (let i = 0; i < css.length; i++) {
    const char = css[i];
    const prevChar = i > 0 ? css[i - 1] : '';

    // Track string boundaries
    if ((char === '"' || char === "'") && prevChar !== '\\') {
      if (!inString) {
        inString = true;
        stringChar = char;
      } else if (char === stringChar) {
        inString = false;
      }
    }

    currentRule += char;

    // Track brace depth (only outside strings)
    if (!inString) {
      if (char === '{') {
        braceDepth++;
      } else if (char === '}') {
        braceDepth--;

        // End of a complete rule
        if (braceDepth === 0 && currentRule.trim()) {
          rules.push(currentRule);
          currentRule = '';
        }
      }
    }
  }

  // Add any remaining content
  if (currentRule.trim()) {
    rules.push(currentRule);
  }

  return rules;
}

/**
 * Parse JavaScript into statements (preserving function boundaries)
 * This is a simplified parser that splits on semicolons outside of blocks
 */
function parseJSStatements(js: string): string[] {
  const statements: string[] = [];
  let currentStatement = '';
  let braceDepth = 0;
  let parenDepth = 0;
  let inString = false;
  let stringChar = '';
  let inComment = false;
  let inMultiLineComment = false;

  for (let i = 0; i < js.length; i++) {
    const char = js[i];
    const nextChar = i < js.length - 1 ? js[i + 1] : '';
    const prevChar = i > 0 ? js[i - 1] : '';

    // Handle comments
    if (!inString) {
      if (char === '/' && nextChar === '/' && !inMultiLineComment) {
        inComment = true;
      } else if (char === '/' && nextChar === '*') {
        inMultiLineComment = true;
      } else if (char === '*' && nextChar === '/' && inMultiLineComment) {
        currentStatement += '*/';
        inMultiLineComment = false;
        i++; // Skip the next '/'
        continue;
      } else if (char === '\n' && inComment) {
        inComment = false;
      }
    }

    // Track string boundaries
    if (!inComment && !inMultiLineComment) {
      if ((char === '"' || char === "'" || char === '`') && prevChar !== '\\') {
        if (!inString) {
          inString = true;
          stringChar = char;
        } else if (char === stringChar) {
          inString = false;
        }
      }
    }

    currentStatement += char;

    // Track brace and paren depth (only outside strings and comments)
    if (!inString && !inComment && !inMultiLineComment) {
      if (char === '{') {
        braceDepth++;
      } else if (char === '}') {
        braceDepth--;
      } else if (char === '(') {
        parenDepth++;
      } else if (char === ')') {
        parenDepth--;
      } else if (char === ';' && braceDepth === 0 && parenDepth === 0) {
        // End of a statement at top level
        if (currentStatement.trim()) {
          statements.push(currentStatement);
          currentStatement = '';
        }
      }
    }
  }

  // Add any remaining content
  if (currentStatement.trim()) {
    statements.push(currentStatement);
  }

  // If we only got one big statement, split by newlines as fallback
  if (statements.length === 1 && statements[0].length > DEFAULT_MAX_SIZE) {
    const lines = statements[0].split('\n');
    return lines.filter(line => line.trim());
  }

  return statements;
}

/**
 * Parse HTML into complete elements (preserving element boundaries)
 */
function parseHTMLElements(html: string): string[] {
  const elements: string[] = [];
  let currentElement = '';
  let depth = 0;
  let inTag = false;
  let inString = false;
  let stringChar = '';

  for (let i = 0; i < html.length; i++) {
    const char = html[i];
    const nextChar = i < html.length - 1 ? html[i + 1] : '';
    const prevChar = i > 0 ? html[i - 1] : '';

    // Track strings inside tags
    if (inTag && (char === '"' || char === "'") && prevChar !== '\\') {
      if (!inString) {
        inString = true;
        stringChar = char;
      } else if (char === stringChar) {
        inString = false;
      }
    }

    currentElement += char;

    // Track tag and depth (only outside strings)
    if (!inString) {
      if (char === '<') {
        inTag = true;

        // Check if opening or closing tag
        if (nextChar !== '/') {
          // Opening tag (unless self-closing)
          const restOfTag = html.substring(i);
          const tagEnd = restOfTag.indexOf('>');
          if (tagEnd !== -1) {
            const tagContent = restOfTag.substring(0, tagEnd);
            if (!tagContent.endsWith('/')) {
              depth++;
            }
          }
        } else {
          // Closing tag
          depth--;
        }
      } else if (char === '>') {
        inTag = false;

        // End of a complete top-level element
        if (depth === 0 && currentElement.trim()) {
          elements.push(currentElement);
          currentElement = '';
        }
      }
    }
  }

  // Add any remaining content
  if (currentElement.trim()) {
    elements.push(currentElement);
  }

  return elements;
}

/**
 * Chunk CSS by complete rule boundaries (target: maxSize per chunk)
 */
export function chunkCSSEmbed(css: string, maxSize: number = DEFAULT_MAX_SIZE): string[] {
  const chunks: string[] = [];
  const rules = parseCSSRules(css);

  let currentChunk = '';
  for (const rule of rules) {
    const ruleSize = new Blob([rule]).size;

    // If single rule exceeds maxSize, add it as its own chunk (can't split further)
    if (ruleSize > maxSize) {
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
        currentChunk = '';
      }
      chunks.push(rule.trim());
      continue;
    }

    // Check if adding this rule would exceed the limit
    const combinedSize = new Blob([currentChunk + rule]).size;
    if (combinedSize > maxSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = rule;
    } else {
      currentChunk += rule;
    }
  }

  // Add final chunk
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  // If we couldn't chunk it properly, split by lines as fallback
  if (chunks.length === 0 || (chunks.length === 1 && new Blob([chunks[0]]).size > maxSize)) {
    return css.split('\n').reduce((acc: string[], line: string) => {
      if (acc.length === 0) {
        acc.push(line);
      } else {
        const lastChunk = acc[acc.length - 1];
        const combined = lastChunk + '\n' + line;
        if (new Blob([combined]).size <= maxSize) {
          acc[acc.length - 1] = combined;
        } else {
          acc.push(line);
        }
      }
      return acc;
    }, []);
  }

  return chunks;
}

/**
 * Chunk JS by statement boundaries (preserve IIFE/functions)
 */
export function chunkJSEmbed(js: string, maxSize: number = DEFAULT_MAX_SIZE): string[] {
  const chunks: string[] = [];
  const statements = parseJSStatements(js);

  let currentChunk = '';
  for (const statement of statements) {
    const statementSize = new Blob([statement]).size;

    // If single statement exceeds maxSize, add it as its own chunk
    if (statementSize > maxSize) {
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
        currentChunk = '';
      }
      chunks.push(statement.trim());
      continue;
    }

    const combinedSize = new Blob([currentChunk + statement]).size;
    if (combinedSize > maxSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = statement;
    } else {
      currentChunk += statement;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

/**
 * Chunk HTML by complete element boundaries
 */
export function chunkHTMLEmbed(html: string, maxSize: number = DEFAULT_MAX_SIZE): string[] {
  const chunks: string[] = [];
  const elements = parseHTMLElements(html);

  let currentChunk = '';
  for (const element of elements) {
    const elementSize = new Blob([element]).size;

    if (elementSize > maxSize) {
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
        currentChunk = '';
      }
      chunks.push(element.trim());
      continue;
    }

    const combinedSize = new Blob([currentChunk + element]).size;
    if (combinedSize > maxSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = element;
    } else {
      currentChunk += element;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

/**
 * Main chunking function that returns full metadata
 */
export function chunkEmbed(
  content: string,
  type: 'css' | 'js' | 'html',
  maxSize: number = DEFAULT_MAX_SIZE
): ChunkedEmbedResult {
  const originalSize = new Blob([content]).size;

  // If content fits within limit, return as single chunk
  if (originalSize <= maxSize) {
    return {
      wasChunked: false,
      chunks: [
        {
          index: 0,
          content,
          size: originalSize,
          type,
        },
      ],
      totalSize: originalSize,
      originalSize,
      instructions: [],
    };
  }

  // Chunk based on type
  const chunker = type === 'css' ? chunkCSSEmbed : type === 'js' ? chunkJSEmbed : chunkHTMLEmbed;
  const chunkStrings = chunker(content, maxSize);

  const chunks: EmbedChunk[] = chunkStrings.map((chunk, index) => ({
    index,
    content: chunk,
    size: new Blob([chunk]).size,
    type,
  }));

  const instructions = [
    `${type.toUpperCase()} embed split into ${chunks.length} parts (${originalSize.toLocaleString()} chars total)`,
    `Copy each part to separate Webflow custom code blocks:`,
    ...chunks.map(
      (chunk, idx) => `  Part ${idx + 1}/${chunks.length}: ${chunk.size.toLocaleString()} chars`
    ),
  ];

  return {
    wasChunked: true,
    chunks,
    totalSize: originalSize,
    originalSize,
    instructions,
  };
}
