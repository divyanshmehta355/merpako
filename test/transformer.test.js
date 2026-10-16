import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { transformMarkdown } from '../lib/transformer.js';
import { decodeMermaid } from '../lib/encoder.js';

describe('Transformer Engine (lib/transformer.js)', () => {
  it('transforms raw Mermaid fence into merpako inline structure', async () => {
    const md = `# Sample Document

### Diagram: Video Upload Flow
\`\`\`mermaid
graph TD
  Upload --> Process --> Complete
\`\`\`

Footer text.`;

    const res = await transformMarkdown({
      content: md,
      mode: 'inline'
    });

    assert.equal(res.changed, true);
    assert.equal(res.diagramsCount, 1);
    assert.equal(res.rawCount, 1);

    // Verify merpako start/end markers
    assert.ok(res.content.includes('<!-- merpako:start -->'));
    assert.ok(res.content.includes('<!-- merpako:end -->'));

    // Verify clickable SVG structure
    assert.ok(res.content.includes('[![Video Upload Flow](https://mermaid.ink/svg/pako:'));
    assert.ok(res.content.includes(')](https://mermaid.live/edit#pako:'));

    // Verify details collapsible source
    assert.ok(res.content.includes('<details>'));
    assert.ok(res.content.includes('<summary><b>View Mermaid Source</b></summary>'));
    assert.ok(res.content.includes('Upload --> Process --> Complete'));
    assert.ok(res.content.includes('</details>'));

    // Verify the URL decodes to the exact original code
    const urlMatch = res.content.match(/\(https:\/\/mermaid\.ink\/svg\/(pako:[^)]+)\)/);
    assert.ok(urlMatch);
    const decoded = decodeMermaid(urlMatch[1]);
    assert.ok(decoded.code.includes('Upload --> Process --> Complete'));
  });

  it('is completely idempotent on repeated runs', async () => {
    const md = `# Idempotence Test

\`\`\`mermaid
graph LR
  A --> B
\`\`\``;

    const firstRun = await transformMarkdown({ content: md, mode: 'inline' });
    assert.equal(firstRun.changed, true);

    const secondRun = await transformMarkdown({ content: firstRun.content, mode: 'inline' });
    assert.equal(secondRun.changed, false);
    assert.equal(secondRun.content, firstRun.content);
  });

  it('handles multiple diagrams in a single file correctly', async () => {
    const md = `# Two Diagrams

### Flow 1
\`\`\`mermaid
graph TD; A-->B;
\`\`\`

Mid text

### Flow 2
\`\`\`mermaid
graph LR; C-->D;
\`\`\`
`;

    const res = await transformMarkdown({ content: md, mode: 'inline' });
    assert.equal(res.changed, true);
    assert.equal(res.diagramsCount, 2);
    assert.equal(res.rawCount, 2);

    assert.ok(res.content.includes('[![Flow 1]'));
    assert.ok(res.content.includes('[![Flow 2]'));
  });

  it('preserves CRLF line endings when input contains CRLF', async () => {
    const crlfMd = '# Title\r\n\r\n```mermaid\r\ngraph TD\r\n  A --> B\r\n```\r\n';
    const res = await transformMarkdown({ content: crlfMd, mode: 'inline' });

    assert.equal(res.changed, true);
    assert.ok(res.content.includes('\r\n'));
    assert.ok(!res.content.includes('<!-- merpako:start -->\n'));
  });

  it('does nothing to documents without Mermaid blocks', async () => {
    const md = '# Normal Markdown\n\nJust text here.\n';
    const res = await transformMarkdown({ content: md, mode: 'inline' });

    assert.equal(res.changed, false);
    assert.equal(res.content, md);
    assert.equal(res.diagramsCount, 0);
  });
});
