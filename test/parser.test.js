import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseMarkdown } from '../lib/parser.js';

describe('Markdown Fence Parser (lib/parser.js)', () => {
  it('parses standard backtick Mermaid fence', () => {
    const md = `# Overview

\`\`\`mermaid
graph TD
  A --> B
\`\`\`

End of doc.`;

    const { blocks } = parseMarkdown(md);
    assert.equal(blocks.length, 1);
    assert.equal(blocks[0].type, 'raw');
    assert.equal(blocks[0].fenceChar, '`');
    assert.equal(blocks[0].fenceLength, 3);
    assert.equal(blocks[0].mermaidCode.trim(), 'graph TD\n  A --> B');
    assert.equal(blocks[0].precedingHeading, '# Overview');
  });

  it('parses tilde Mermaid fence (~~~mermaid)', () => {
    const md = `~~~mermaid
sequenceDiagram
  Alice->>Bob: Hi
~~~`;

    const { blocks } = parseMarkdown(md);
    assert.equal(blocks.length, 1);
    assert.equal(blocks[0].type, 'raw');
    assert.equal(blocks[0].fenceChar, '~');
    assert.equal(blocks[0].fenceLength, 3);
    assert.equal(blocks[0].mermaidCode.trim(), 'sequenceDiagram\n  Alice->>Bob: Hi');
  });

  it('supports 4+ fence characters (e.g. ````mermaid)', () => {
    const md = `\`\`\`\`mermaid
flowchart LR
  X --> Y
\`\`\`\``;

    const { blocks } = parseMarkdown(md);
    assert.equal(blocks.length, 1);
    assert.equal(blocks[0].fenceLength, 4);
    assert.equal(blocks[0].mermaidCode.trim(), 'flowchart LR\n  X --> Y');
  });

  it('supports valid CommonMark indentation (1 to 3 spaces)', () => {
    const md = `   \`\`\`mermaid
   graph LR
     A --> B
   \`\`\``;

    const { blocks } = parseMarkdown(md);
    assert.equal(blocks.length, 1);
    assert.equal(blocks[0].indent, '   ');
    assert.ok(blocks[0].mermaidCode.includes('A --> B'));
  });

  it('does NOT parse non-Mermaid code fences or Mermaid inside other code blocks', () => {
    const md = `# Documentation

\`\`\`javascript
// Here is some code:
const str = \`\`\`mermaid
graph TD
  A --> B
\`\`\`;
\`\`\`

\`\`\`python
def test():
    return "No mermaid here"
\`\`\`
`;

    const { blocks } = parseMarkdown(md);
    assert.equal(blocks.length, 0, 'Must not treat non-mermaid code blocks as diagrams');
  });

  it('parses multiple Mermaid diagrams in one document in order', () => {
    const md = `# Diagrams

### Diagram 1
\`\`\`mermaid
graph TD; A-->B;
\`\`\`

Middle prose text.

### Diagram 2
~~~mermaid
graph LR; C-->D;
~~~
`;

    const { blocks } = parseMarkdown(md);
    assert.equal(blocks.length, 2);
    assert.equal(blocks[0].precedingHeading, '### Diagram 1');
    assert.equal(blocks[0].mermaidCode.trim(), 'graph TD; A-->B;');
    assert.equal(blocks[1].precedingHeading, '### Diagram 2');
    assert.equal(blocks[1].mermaidCode.trim(), 'graph LR; C-->D;');
  });

  it('recognizes existing merpako blocks and does not count them as raw blocks', () => {
    const md = `# Architecture

<!-- merpako:start -->
[![Architecture Overview](https://mermaid.ink/svg/pako:abc)](https://mermaid.live/edit#pako:abc)

<details>
<summary><b>View Mermaid Source</b></summary>

\`\`\`mermaid
graph TD
  Client --> Server
\`\`\`

</details>
<!-- merpako:end -->
`;

    const { blocks } = parseMarkdown(md);
    assert.equal(blocks.length, 1);
    assert.equal(blocks[0].type, 'merpako');
    assert.equal(blocks[0].title, 'Architecture Overview');
    assert.equal(blocks[0].preservedSource.trim(), 'graph TD\n  Client --> Server');
  });

  it('handles CRLF line endings properly', () => {
    const md = '# Title\r\n\r\n```mermaid\r\ngraph TD\r\n  A --> B\r\n```\r\n';
    const { blocks, eol } = parseMarkdown(md);

    assert.equal(eol, '\r\n');
    assert.equal(blocks.length, 1);
    assert.equal(blocks[0].mermaidCode, 'graph TD\r\n  A --> B');
  });

  it('returns empty blocks for documents without Mermaid diagrams', () => {
    const md = '# Just A Regular Markdown File\n\nNo diagrams here.\n';
    const { blocks } = parseMarkdown(md);
    assert.equal(blocks.length, 0);
  });
});
