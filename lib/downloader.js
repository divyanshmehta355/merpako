import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { slugify } from './title.js';

/**
 * Generates a deterministic, filesystem-safe SVG filename for a diagram.
 *
 * @param {object} params
 * @param {string} params.markdownFilePath - Path to the Markdown document
 * @param {string} params.title - Diagram title
 * @param {string} params.code - Diagram Mermaid source code
 * @returns {string} Safe SVG filename
 */
export function generateSvgFilename({ markdownFilePath, title, code }) {
  const baseName = markdownFilePath
    ? path.basename(markdownFilePath, path.extname(markdownFilePath))
    : 'diagram';
  const fileSlug = slugify(baseName);
  const titleSlug = slugify(title);

  // 8-character deterministic content hash
  const hashSlice = crypto
    .createHash('sha256')
    .update(code || '')
    .digest('hex')
    .slice(0, 8);

  return `${fileSlug}-${titleSlug}-${hashSlice}.svg`;
}

/**
 * Calculates a Markdown-relative forward-slash URL/path from a Markdown file to an SVG file.
 *
 * @param {string} markdownFilePath
 * @param {string} svgFilePath
 * @returns {string} Relative path with forward slashes
 */
export function calculateRelativeSvgPath(markdownFilePath, svgFilePath) {
  const markdownDir = path.dirname(path.resolve(markdownFilePath));
  let rel = path.relative(markdownDir, path.resolve(svgFilePath));
  rel = rel.replace(/\\/g, '/');

  // Normalize: if it's in the same directory, use ./filename
  if (!rel.startsWith('.') && !rel.includes('/')) {
    rel = `./${rel}`;
  }

  return rel;
}

/**
 * Downloads a rendered SVG from mermaid.ink and saves it to assets/diagrams/ in the output root.
 *
 * Features:
 * - Native fetch with timeouts
 * - SVG validation (<svg and </svg>)
 * - Atomic file writes
 * - Skips redundant download if matching valid SVG already exists
 * - Accurate relative path computation
 *
 * @param {object} params
 * @param {string} params.svgUrl - Remote SVG URL (e.g. https://mermaid.ink/svg/pako:...)
 * @param {string} params.markdownFilePath - Path to markdown file
 * @param {string} params.title - Diagram title
 * @param {string} params.code - Diagram source code
 * @param {string} [params.outputRoot] - Selected output root, defaults to process.cwd()
 * @param {typeof fetch} [params.fetchFn] - Custom fetch function (for offline testing)
 * @param {number} [params.timeoutMs=10000] - Request timeout in milliseconds
 * @returns {Promise<{ svgFilePath: string, relativePath: string, skipped: boolean }>}
 */
export async function downloadDiagramSvg({
  svgUrl,
  markdownFilePath,
  title,
  code,
  outputRoot = process.cwd(),
  fetchFn = globalThis.fetch,
  timeoutMs = 10000
}) {
  const filename = generateSvgFilename({ markdownFilePath, title, code });
  const targetDir = path.resolve(outputRoot, 'assets', 'diagrams');
  const targetPath = path.join(targetDir, filename);
  const relativePath = calculateRelativeSvgPath(markdownFilePath, targetPath);

  // 1. Check if valid SVG already exists to avoid redundant download
  if (fs.existsSync(targetPath)) {
    try {
      const existing = fs.readFileSync(targetPath, 'utf8');
      if (existing.includes('<svg') && existing.includes('</svg>')) {
        return {
          svgFilePath: targetPath,
          relativePath,
          skipped: true
        };
      }
    } catch {
      // If reading fails, proceed to fetch
    }
  }

  // 2. Fetch remote SVG
  let controller;
  let timer;
  let response;

  try {
    if (typeof AbortController !== 'undefined') {
      controller = new AbortController();
      timer = setTimeout(() => controller.abort(), timeoutMs);
    }

    response = await fetchFn(svgUrl, {
      signal: controller ? controller.signal : undefined,
      headers: {
        'User-Agent': 'merpako/1.0.1 (https://github.com/divyanshmehta355/merpako)'
      }
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeoutMs}ms while downloading SVG from ${svgUrl}`);
    }
    throw new Error(`Network failure downloading SVG: ${err.message}`);
  } finally {
    if (timer) clearTimeout(timer);
  }

  // 3. Validate HTTP status
  if (!response.ok) {
    throw new Error(`Failed to download SVG from ${svgUrl}: HTTP ${response.status} ${response.statusText}`);
  }

  // 4. Validate SVG response content
  const svgText = await response.text();
  if (!svgText.includes('<svg') || !svgText.includes('</svg>')) {
    throw new Error(`Invalid SVG response received from ${svgUrl} (missing <svg> tag)`);
  }

  // 5. Ensure target directory exists
  await fs.promises.mkdir(targetDir, { recursive: true });

  // 6. Write atomically via temp file
  const tempPath = `${targetPath}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
  await fs.promises.writeFile(tempPath, svgText, 'utf8');
  await fs.promises.rename(tempPath, targetPath);

  return {
    svgFilePath: targetPath,
    relativePath,
    skipped: false
  };
}
