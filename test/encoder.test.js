import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { encodeMermaid, decodeMermaid, createSvgUrl, createEditorUrl } from '../lib/encoder.js';

describe('Encoder & Decoder (lib/encoder.js)', () => {
  it('generates the expected JSON payload shape and pako hash', () => {
    const code = 'graph TD;\n  A-->B;';
    const result = encodeMermaid(code);

    assert.equal(typeof result.hash, 'string');
    assert.ok(result.hash.length > 0);
    assert.ok(result.pakoHash.startsWith('pako:'));
    assert.deepEqual(result.payload, {
      code,
      mermaid: { theme: 'default' }
    });
  });

  it('uses base64url characters only without +, /, or =', () => {
    const complexCode = 'sequenceDiagram\n  autonumber\n  Alice->>Bob: Hello (test + / =)\n  Bob-->>Alice: Hi';
    const { hash } = encodeMermaid(complexCode);

    assert.ok(!hash.includes('+'), 'hash must not contain +');
    assert.ok(!hash.includes('/'), 'hash must not contain /');
    assert.ok(!hash.includes('='), 'hash must not contain =');
    assert.match(hash, /^[A-Za-z0-9_-]+$/);
  });

  it('generates valid mermaid.ink and mermaid.live URLs', () => {
    const code = 'pie title Pets\n  "Dogs": 386\n  "Cats": 85';
    const { pakoHash, svgUrl, editorUrl } = encodeMermaid(code);

    assert.equal(svgUrl, `https://mermaid.ink/svg/${pakoHash}`);
    assert.equal(editorUrl, `https://mermaid.live/edit#${pakoHash}`);
    assert.equal(createSvgUrl(pakoHash), svgUrl);
    assert.equal(createEditorUrl(pakoHash), editorUrl);
  });

  it('correctly compresses and decompresses payload round-trip', () => {
    const code = `classDiagram
  class Animal {
    +int age
    +String gender
    +isMammal()
    +mate()
  }
  class Duck {
    +String beakColor
    +swim()
    +quack()
  }
  Animal <|-- Duck`;

    const { pakoHash, svgUrl } = encodeMermaid(code);

    // Decode using pakoHash
    const decodedFromHash = decodeMermaid(pakoHash);
    assert.equal(decodedFromHash.code, code);
    assert.deepEqual(decodedFromHash.mermaid, { theme: 'default' });

    // Decode using full SVG URL
    const decodedFromUrl = decodeMermaid(svgUrl);
    assert.equal(decodedFromUrl.code, code);
  });

  it('handles Unicode, non-Latin scripts, and Emojis', () => {
    const unicodeCode = `flowchart TD
  A[こんにちは 🌸] --> B[Приве́т 🚀]
  B --> C[مرحبا 🌟]
  C --> D[Café & Crème brûlée]`;

    const { pakoHash } = encodeMermaid(unicodeCode);
    const decoded = decodeMermaid(pakoHash);
    assert.equal(decoded.code, unicodeCode);
  });

  it('handles quotes, brackets, and punctuation safely', () => {
    const specialCode = `graph LR
  A["Node with 'single' and \\"double\\" quotes"] --> B["[Bracket] {Brace} (Paren) <Angle>"]
  B --> C["Ampersand & Slash / Backslash \\\\ Pipe |"]`;

    const { pakoHash } = encodeMermaid(specialCode);
    const decoded = decodeMermaid(pakoHash);
    assert.equal(decoded.code, specialCode);
  });

  it('handles CRLF and LF line endings in diagram source', () => {
    const crlfCode = 'graph TD;\r\n  Start --> Stop;\r\n';
    const { pakoHash: hashCrlf } = encodeMermaid(crlfCode);
    const decodedCrlf = decodeMermaid(hashCrlf);
    assert.equal(decodedCrlf.code, crlfCode);

    const lfCode = 'graph TD;\n  Start --> Stop;\n';
    const { pakoHash: hashLf } = encodeMermaid(lfCode);
    const decodedLf = decodeMermaid(hashLf);
    assert.equal(decodedLf.code, lfCode);
  });

  it('throws TypeError if input code is not a string', () => {
    assert.throws(() => encodeMermaid(null), TypeError);
    assert.throws(() => encodeMermaid(123), TypeError);
    assert.throws(() => decodeMermaid(null), TypeError);
  });
});
