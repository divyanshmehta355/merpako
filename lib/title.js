/**
 * Strips markdown formatting (bold, italic, code, links, heading hashes) from a text string.
 *
 * @param {string} heading
 * @returns {string}
 */
export function cleanHeadingText(heading) {
  if (!heading) return '';

  let text = heading.trim();

  // Strip leading hashes (e.g. '### ')
  text = text.replace(/^#{1,6}\s+/, '');

  // Strip trailing hashes if any (e.g. ' ###')
  text = text.replace(/\s+#{1,6}$/, '');

  // Strip Markdown links [text](url) -> text
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

  // Strip inline code `code` -> code
  text = text.replace(/`([^`]+)`/g, '$1');

  // Strip bold/italics
  text = text.replace(/(\*\*|__)(.*?)\1/g, '$2');
  text = text.replace(/(\*|_)(.*?)\1/g, '$2');

  // Strip HTML tags if any
  text = text.replace(/<[^>]*>/g, '');

  // If heading starts with 'Diagram:', 'Figure:', etc., clean the prefix if there's following text
  const prefixMatch = text.match(/^(?:Diagram|Figure|Flow)\s*:\s*(.+)$/i);
  if (prefixMatch && prefixMatch[1].trim()) {
    text = prefixMatch[1].trim();
  }

  return text.trim();
}

/**
 * Extracts an explicit title directive from Mermaid diagram code.
 * Supports:
 * - YAML frontmatter title:
 *     ---
 *     title: My Title
 *     ---
 * - Mermaid title directive:
 *     title My Title
 *     title: My Title
 * - accTitle directive:
 *     accTitle: My Title
 *
 * @param {string} code
 * @returns {string|null}
 */
export function extractMermaidDirectiveTitle(code) {
  if (!code || typeof code !== 'string') return null;

  // 1. Check YAML frontmatter (at top of mermaid code)
  const frontmatterMatch = code.match(/^---\s*[\r\n]+([\s\S]*?)[\r\n]+---/);
  if (frontmatterMatch) {
    const yamlBody = frontmatterMatch[1];
    const titleMatch = yamlBody.match(/^title\s*:\s*["']?([^"'\r\n]+)["']?/m);
    if (titleMatch && titleMatch[1].trim()) {
      return titleMatch[1].trim();
    }
  }

  // 2. Check title or accTitle directives
  const lines = code.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    // Match 'title: Something' or 'title Something'
    const directiveMatch = trimmed.match(/^(?:title|accTitle)(?::|\s)\s*["']?([^"']+)["']?$/i);
    if (directiveMatch && directiveMatch[1].trim()) {
      return directiveMatch[1].trim();
    }
  }

  return null;
}

/**
 * Resolves diagram title according to priority:
 * 1. Nearby Markdown heading (including ### Diagram: Video Upload Flow)
 * 2. Explicit Mermaid title directive
 * 3. Fallback: Diagram ${fallbackIndex}
 *
 * @param {object} params
 * @param {string|null} [params.nearbyHeading] - Nearby markdown heading text
 * @param {string} params.mermaidCode - Raw diagram source code
 * @param {number} [params.diagramIndex=0] - 0-based diagram index within document
 * @returns {string} The resolved title
 */
export function resolveDiagramTitle({ nearbyHeading, mermaidCode, diagramIndex = 0 }) {
  // 1. Check nearby Markdown heading
  if (nearbyHeading) {
    const cleaned = cleanHeadingText(nearbyHeading);
    if (cleaned) {
      return cleaned;
    }
  }

  // 2. Check explicit Mermaid title directive
  const directiveTitle = extractMermaidDirectiveTitle(mermaidCode);
  if (directiveTitle) {
    return directiveTitle;
  }

  // 3. Fallback
  return `Diagram ${diagramIndex + 1}`;
}

/**
 * Escapes characters in a title for safe use in Markdown image labels: ![<title>](...)
 * Escapes brackets `[` and `]` to avoid corrupting Markdown syntax.
 * Replaces newlines with spaces.
 *
 * @param {string} title
 * @returns {string}
 */
export function escapeMarkdownLabel(title) {
  if (!title) return '';
  return title
    .replace(/[\r\n]+/g, ' ')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .trim();
}

/**
 * Escapes characters in a string for safe embedding into HTML.
 *
 * @param {string} str
 * @returns {string}
 */
export function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Converts a string into a filesystem-safe slug (e.g. 'Video Upload Flow' -> 'video-upload-flow').
 *
 * @param {string} str
 * @returns {string}
 */
export function slugify(str) {
  if (!str) return 'diagram';
  const slug = str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'diagram';
}
