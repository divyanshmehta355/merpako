import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { revertMarkdown } from '../lib/revert.js';
import { transformMarkdown } from '../lib/transformer.js';

describe('Reversion Engine (lib/revert.js)', () => {
  it('restores generated merpako block back to original raw Mermaid fence', async () => {
    const original = `# My Title

### Diagram: Test Flow
\`\`\`mermaid
graph TD
  A --> B
\`\`\`

Footer text.`;

    // 1. Transform it
    const transformed = await transformMarkdown({
      content: original,
      mode: 'inline'
    });
    assert.ok(transformed.content.includes('<!-- merpako:start -->'));

    // 2. Revert it
    const reverted = revertMarkdown(transformed.content);
    assert.equal(reverted.changed, true);
    assert.equal(reverted.revertedCount, 1);
    assert.ok(!reverted.content.includes('<!-- merpako:start -->'));
    assert.ok(reverted.content.includes('```mermaid'));
    assert.ok(reverted.content.includes('graph TD\n  A --> B'));
  });

  it('restores multiple merpako blocks in a document', async () => {
    const original = `# Two Diagrams
\`\`\`mermaid
graph TD; A-->B;
\`\`\`
Middle
\`\`\`mermaid
graph LR; C-->D;
\`\`\`
`;

    const transformed = await transformMarkdown({ content: original, mode: 'inline' });
    const reverted = revertMarkdown(transformed.content);

    assert.equal(reverted.revertedCount, 2);
    assert.ok(!reverted.content.includes('<!-- merpako:start -->'));
    assert.ok(reverted.content.includes('graph TD; A-->B;'));
    assert.ok(reverted.content.includes('graph LR; C-->D;'));
  });

  it('preserves Unicode, quotes, and punctuation on reversion', async () => {
    const original = `\`\`\`mermaid
flowchart TD
  A["こんにちは 'world' \\"test\\""] --> B["[🚀 Rocket]"]
\`\`\``;
    const transformed = await transformMarkdown({ content: original, mode: 'inline' });
    const reverted = revertMarkdown(transformed.content);
    assert.equal(reverted.content, original);
  });

  it('returns changed: false if no merpako blocks exist', () => {
    const raw = '# Clean Doc\n\n```mermaid\ngraph TD; A-->B;\n```\n';
    const reverted = revertMarkdown(raw);
    assert.equal(reverted.changed, false);
    assert.equal(reverted.revertedCount, 0);
    assert.equal(reverted.content, raw);
  });
});
