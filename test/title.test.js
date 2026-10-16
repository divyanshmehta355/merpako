import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  cleanHeadingText,
  extractMermaidDirectiveTitle,
  resolveDiagramTitle,
  escapeMarkdownLabel,
  escapeHtml,
  slugify
} from '../lib/title.js';

describe('Diagram Title Engine (lib/title.js)', () => {
  describe('cleanHeadingText()', () => {
    it('strips leading and trailing markdown hashes', () => {
      assert.equal(cleanHeadingText('### Video Upload Flow'), 'Video Upload Flow');
      assert.equal(cleanHeadingText('# Main System #'), 'Main System');
    });

    it('strips markdown bold, italics, code, and links', () => {
      assert.equal(cleanHeadingText('## **Architecture** of `Core`'), 'Architecture of Core');
      assert.equal(cleanHeadingText('### [Overview](https://example.com) *Guide*'), 'Overview Guide');
    });

    it('strips Diagram: or Figure: prefix if followed by title', () => {
      assert.equal(cleanHeadingText('### Diagram: Video Upload Flow'), 'Video Upload Flow');
      assert.equal(cleanHeadingText('## Figure: Authentication Pipeline'), 'Authentication Pipeline');
      assert.equal(cleanHeadingText('### Flow: Checkout Process'), 'Checkout Process');
    });

    it('keeps heading intact if no prefix or just Diagram', () => {
      assert.equal(cleanHeadingText('### Diagram'), 'Diagram');
    });
  });

  describe('extractMermaidDirectiveTitle()', () => {
    it('extracts title from YAML frontmatter', () => {
      const code = `---
title: Video Upload Flow
---
sequenceDiagram
  Alice->>Bob: Hello`;
      assert.equal(extractMermaidDirectiveTitle(code), 'Video Upload Flow');
    });

    it('extracts quoted title from YAML frontmatter', () => {
      const code = `---
title: "User Registration Flow"
---
flowchart TD
  A --> B`;
      assert.equal(extractMermaidDirectiveTitle(code), 'User Registration Flow');
    });

    it('extracts title directive inside diagram body', () => {
      const code = `sequenceDiagram
  title User Authentication
  Alice->>Bob: Authenticate`;
      assert.equal(extractMermaidDirectiveTitle(code), 'User Authentication');

      const codeWithColon = `flowchart TD
  title: Order Processing Pipeline
  A --> B`;
      assert.equal(extractMermaidDirectiveTitle(codeWithColon), 'Order Processing Pipeline');
    });

    it('extracts accTitle directive', () => {
      const code = `classDiagram
  accTitle: Domain Models
  class User`;
      assert.equal(extractMermaidDirectiveTitle(code), 'Domain Models');
    });

    it('returns null if no directive is found', () => {
      const code = `graph TD\n  A-->B`;
      assert.equal(extractMermaidDirectiveTitle(code), null);
    });
  });

  describe('resolveDiagramTitle() precedence order', () => {
    it('prefers nearby Markdown heading over Mermaid directive', () => {
      const code = `---
title: Directive Title
---
graph TD
  A-->B`;
      const title = resolveDiagramTitle({
        nearbyHeading: '### Diagram: Nearby Heading Title',
        mermaidCode: code,
        diagramIndex: 0
      });
      assert.equal(title, 'Nearby Heading Title');
    });

    it('falls back to Mermaid directive if no nearby heading is present', () => {
      const code = `---
title: Directive Title
---
graph TD
  A-->B`;
      const title = resolveDiagramTitle({
        nearbyHeading: null,
        mermaidCode: code,
        diagramIndex: 0
      });
      assert.equal(title, 'Directive Title');
    });

    it('falls back to deterministic Diagram N if neither is present', () => {
      const code = 'graph TD\n  A-->B';
      const title1 = resolveDiagramTitle({
        nearbyHeading: null,
        mermaidCode: code,
        diagramIndex: 0
      });
      const title2 = resolveDiagramTitle({
        nearbyHeading: null,
        mermaidCode: code,
        diagramIndex: 1
      });

      assert.equal(title1, 'Diagram 1');
      assert.equal(title2, 'Diagram 2');
    });
  });

  describe('escapeMarkdownLabel() and escapeHtml()', () => {
    it('escapes square brackets in markdown labels', () => {
      assert.equal(escapeMarkdownLabel('System [v2.0] Diagram'), 'System \\[v2.0\\] Diagram');
    });

    it('collapses newlines in markdown labels', () => {
      assert.equal(escapeMarkdownLabel('Line 1\nLine 2'), 'Line 1 Line 2');
    });

    it('escapes HTML special characters', () => {
      assert.equal(escapeHtml('<script>alert("xss") & test</script>'), '&lt;script&gt;alert(&quot;xss&quot;) &amp; test&lt;/script&gt;');
    });
  });

  describe('slugify()', () => {
    it('creates clean filesystem-safe slugs', () => {
      assert.equal(slugify('Video Upload Flow!'), 'video-upload-flow');
      assert.equal(slugify('Architecture & Design (v2)'), 'architecture-design-v2');
      assert.equal(slugify(''), 'diagram');
    });
  });
});
