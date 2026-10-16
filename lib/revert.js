import fs from 'node:fs';
import path from 'node:path';
import { parseMarkdown } from './parser.js';

/**
 * Reverts merpako-generated blocks in a Markdown string back to raw Mermaid code fences.
 *
 * @param {string} markdown - The markdown content to revert
 * @returns {{ content: string, changed: boolean, revertedCount: number }}
 */
export function revertMarkdown(markdown) {
  const { blocks, eol } = parseMarkdown(markdown);
  const merpakoBlocks = blocks.filter((b) => b.type === 'merpako');

  if (merpakoBlocks.length === 0) {
    return {
      content: markdown,
      changed: false,
      revertedCount: 0
    };
  }

  // Sort backwards by start offset to perform clean string slices
  merpakoBlocks.sort((a, b) => b.startOffset - a.startOffset);

  let result = markdown;
  for (const block of merpakoBlocks) {
    const rawFence = [
      '```mermaid',
      block.preservedSource,
      '```'
    ].join(eol);

    const before = result.slice(0, block.startOffset);
    const after = result.slice(block.endOffset);
    result = before + rawFence + after;
  }

  return {
    content: result,
    changed: true,
    revertedCount: merpakoBlocks.length
  };
}

/**
 * Reverts a Markdown file on disk back to raw Mermaid code blocks.
 *
 * @param {string} filePath - Path to markdown file
 * @returns {Promise<{ filePath: string, changed: boolean, revertedCount: number }>}
 */
export async function revertFile(filePath) {
  const content = await fs.promises.readFile(filePath, 'utf8');
  const { content: newContent, changed, revertedCount } = revertMarkdown(content);

  if (changed) {
    const dir = path.dirname(path.resolve(filePath));
    const tempFile = path.join(dir, `.merpako.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`);
    await fs.promises.writeFile(tempFile, newContent, 'utf8');
    await fs.promises.rename(tempFile, filePath);
  }

  return {
    filePath,
    changed,
    revertedCount
  };
}
