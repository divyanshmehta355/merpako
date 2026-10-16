import fs from 'node:fs';
import path from 'node:path';
import { parseMarkdown } from './parser.js';
import { encodeMermaid } from './encoder.js';
import { resolveDiagramTitle, escapeMarkdownLabel } from './title.js';
import { downloadDiagramSvg } from './downloader.js';

/**
 * Builds the standardized merpako Markdown block.
 *
 * @param {object} params
 * @param {string} params.title - Escaped diagram title
 * @param {string} params.imageSrc - Remote SVG URL or local SVG relative path
 * @param {string} params.editorUrl - Remote mermaid.live editor URL
 * @param {string} params.mermaidCode - Raw Mermaid diagram source
 * @param {string} [params.indent=''] - Indentation string
 * @param {string} [params.fenceChar='`'] - Code fence character
 * @param {number} [params.fenceLength=3] - Code fence length
 * @param {string} [params.eol='\n'] - Line ending
 * @returns {string} Formatted merpako block
 */
export function buildMerpakoBlock({
  title,
  imageSrc,
  editorUrl,
  mermaidCode,
  indent = '',
  fenceChar = '`',
  fenceLength = 3,
  eol = '\n'
}) {
  const fence = fenceChar.repeat(Math.max(3, fenceLength));
  const escapedTitle = escapeMarkdownLabel(title);

  const lines = [
    `${indent}<!-- merpako:start -->`,
    `${indent}[![${escapedTitle}](${imageSrc})](${editorUrl})`,
    '',
    `${indent}<details>`,
    `${indent}<summary><b>View Mermaid Source</b></summary>`,
    '',
    `${indent}${fence}mermaid`,
    mermaidCode,
    `${indent}${fence}`,
    '',
    `${indent}</details>`,
    `${indent}<!-- merpako:end -->`
  ];

  return lines.join(eol);
}

/**
 * Transforms Markdown content by converting raw Mermaid blocks (and updating existing merpako blocks)
 * into either inline remote embeds or local SVG links.
 *
 * @param {object} params
 * @param {string} params.content - Raw markdown string
 * @param {string} [params.markdownFilePath] - Path to Markdown file (needed for download mode relative paths)
 * @param {'inline' | 'download'} [params.mode='inline'] - Transformation mode
 * @param {string} [params.outputRoot] - Output root for downloaded SVGs
 * @param {typeof fetch} [params.fetchFn] - Custom fetch function for testing
 * @returns {Promise<{ content: string, changed: boolean, diagramsCount: number, rawCount: number }>}
 */
export async function transformMarkdown({
  content,
  markdownFilePath,
  mode = 'inline',
  outputRoot = process.cwd(),
  fetchFn = globalThis.fetch
}) {
  const { blocks, eol } = parseMarkdown(content);
  if (blocks.length === 0) {
    return {
      content,
      changed: false,
      diagramsCount: 0,
      rawCount: 0
    };
  }

  // Identify all diagram blocks to process
  const prepared = [];
  let rawCount = 0;

  for (let idx = 0; idx < blocks.length; idx++) {
    const block = blocks[idx];
    let mermaidCode = '';
    let indent = '';
    let fenceChar = '`';
    let fenceLength = 3;
    let nearbyHeading = block.precedingHeading;

    if (block.type === 'raw') {
      rawCount++;
      mermaidCode = block.mermaidCode;
      indent = block.indent || '';
      fenceChar = block.fenceChar || '`';
      fenceLength = block.fenceLength || 3;
    } else if (block.type === 'merpako') {
      mermaidCode = block.preservedSource;
    }

    if (!mermaidCode) continue;

    // Resolve diagram title
    const title = resolveDiagramTitle({
      nearbyHeading,
      mermaidCode,
      diagramIndex: idx
    });

    // Encode to pako hash and generate URLs
    const { pakoHash, svgUrl, editorUrl } = encodeMermaid(mermaidCode);

    let imageSrc = svgUrl;

    if (mode === 'download') {
      // Pre-download or check local SVG
      const downloadResult = await downloadDiagramSvg({
        svgUrl,
        markdownFilePath: markdownFilePath || 'diagram.md',
        title,
        code: mermaidCode,
        outputRoot,
        fetchFn
      });
      imageSrc = downloadResult.relativePath;
    }

    const replacement = buildMerpakoBlock({
      title,
      imageSrc,
      editorUrl,
      mermaidCode,
      indent,
      fenceChar,
      fenceLength,
      eol
    });

    prepared.push({
      block,
      replacement
    });
  }

  // Check if any block actually changes
  let hasChanges = false;
  for (const item of prepared) {
    if (item.block.originalText !== item.replacement) {
      hasChanges = true;
      break;
    }
  }

  if (!hasChanges) {
    return {
      content,
      changed: false,
      diagramsCount: blocks.length,
      rawCount
    };
  }

  // Apply replacements from right to left (bottom to top) to preserve character offsets
  let result = content;
  prepared.sort((a, b) => b.block.startOffset - a.block.startOffset);

  for (const item of prepared) {
    const before = result.slice(0, item.block.startOffset);
    const after = result.slice(item.block.endOffset);
    result = before + item.replacement + after;
  }

  return {
    content: result,
    changed: true,
    diagramsCount: blocks.length,
    rawCount
  };
}

/**
 * Transforms a Markdown file on disk atomically.
 *
 * @param {object} params
 * @param {string} params.filePath - Absolute or relative path to Markdown file
 * @param {'inline' | 'download'} [params.mode='inline'] - Transformation mode
 * @param {string} [params.outputRoot] - Output root for SVGs in download mode
 * @param {typeof fetch} [params.fetchFn] - Custom fetch for testing
 * @returns {Promise<{ filePath: string, changed: boolean, diagramsCount: number, rawCount: number }>}
 */
export async function transformFile({
  filePath,
  mode = 'inline',
  outputRoot = process.cwd(),
  fetchFn = globalThis.fetch
}) {
  const content = await fs.promises.readFile(filePath, 'utf8');

  const { content: newContent, changed, diagramsCount, rawCount } = await transformMarkdown({
    content,
    markdownFilePath: filePath,
    mode,
    outputRoot,
    fetchFn
  });

  if (changed) {
    // Write atomically using a temporary file in the same directory
    const dir = path.dirname(path.resolve(filePath));
    const tempFile = path.join(dir, `.merpako.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`);
    await fs.promises.writeFile(tempFile, newContent, 'utf8');
    await fs.promises.rename(tempFile, filePath);
  }

  return {
    filePath,
    changed,
    diagramsCount,
    rawCount
  };
}
