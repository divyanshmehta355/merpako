import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseMarkdown } from '../lib/parser.js';
import { transformMarkdown } from '../lib/transformer.js';

describe('Check Mode Logic (lib/parser.js & CLI check)', () => {
  it('detects raw unprocessed Mermaid code blocks', () => {
    const rawDoc = `# Project

\`\`\`mermaid
graph TD; A-->B;
\`\`\`
`;
    const { blocks } = parseMarkdown(rawDoc);
    const rawBlocks = blocks.filter((b) => b.type === 'raw');
    assert.equal(rawBlocks.length, 1);
  });

  it('does NOT count Mermaid source inside merpako generated blocks as raw', async () => {
    const rawDoc = `# Project

\`\`\`mermaid
graph TD; A-->B;
\`\`\`
`;
    const { content } = await transformMarkdown({ content: rawDoc, mode: 'inline' });

    // Now parse the transformed content
    const { blocks } = parseMarkdown(content);
    const rawBlocks = blocks.filter((b) => b.type === 'raw');
    const merpakoBlocks = blocks.filter((b) => b.type === 'merpako');

    assert.equal(rawBlocks.length, 0, 'No raw blocks should be found after transformation');
    assert.equal(merpakoBlocks.length, 1, 'Exactly one merpako block should be recognized');
  });

  it('reports zero raw blocks for documents with no Mermaid diagrams', () => {
    const md = `# Plain Document\n\nNo diagrams here.\n`;
    const { blocks } = parseMarkdown(md);
    assert.equal(blocks.filter((b) => b.type === 'raw').length, 0);
  });
});
