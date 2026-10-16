import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  generateSvgFilename,
  calculateRelativeSvgPath,
  downloadDiagramSvg
} from '../lib/downloader.js';
import { transformMarkdown } from '../lib/transformer.js';

describe('SVG Downloader & Download Mode (lib/downloader.js)', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'merpako-download-test-'));
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('generates deterministic, filesystem-safe filenames with content hashes', () => {
    const filename1 = generateSvgFilename({
      markdownFilePath: 'docs/architecture/overview.md',
      title: 'User Authentication Flow!',
      code: 'graph TD; A-->B;'
    });

    const filename2 = generateSvgFilename({
      markdownFilePath: 'docs/architecture/overview.md',
      title: 'User Authentication Flow!',
      code: 'graph TD; A-->B;'
    });

    assert.equal(filename1, filename2);
    assert.ok(filename1.startsWith('overview-user-authentication-flow-'));
    assert.ok(filename1.endsWith('.svg'));
    assert.match(filename1, /^[a-z0-9-]+\.svg$/);
  });

  it('calculates correct relative paths from Markdown file to SVG with forward slashes', () => {
    const mdPath = path.resolve('/repo/docs/guide.md');
    const svgPath = path.resolve('/repo/assets/diagrams/guide-diagram-12345678.svg');

    const rel = calculateRelativeSvgPath(mdPath, svgPath);
    assert.equal(rel, '../assets/diagrams/guide-diagram-12345678.svg');
    assert.ok(!rel.includes('\\'), 'Path must use forward slashes');
  });

  it('downloads SVG and writes atomically when mocked fetch succeeds', async () => {
    const mockSvg = '<svg id="mermaid-svg" xmlns="http://www.w3.org/2000/svg"><g><text>Diagram</text></g></svg>';
    const mockFetch = async () => ({
      ok: true,
      status: 200,
      text: async () => mockSvg
    });

    const mdFile = path.join(tmpDir, 'README.md');
    fs.writeFileSync(mdFile, '# Readme', 'utf8');

    const res = await downloadDiagramSvg({
      svgUrl: 'https://mermaid.ink/svg/pako:fake',
      markdownFilePath: mdFile,
      title: 'Test Diagram',
      code: 'graph TD; A-->B;',
      outputRoot: tmpDir,
      fetchFn: mockFetch
    });

    assert.equal(res.skipped, false);
    assert.ok(fs.existsSync(res.svgFilePath));
    const content = fs.readFileSync(res.svgFilePath, 'utf8');
    assert.equal(content, mockSvg);
    assert.equal(res.relativePath, 'assets/diagrams/' + path.basename(res.svgFilePath));
  });

  it('skips network download if matching valid SVG already exists', async () => {
    const mockSvg = '<svg xmlns="http://www.w3.org/2000/svg"></svg>';
    let fetchCalled = false;
    const mockFetch = async () => {
      fetchCalled = true;
      return { ok: true, status: 200, text: async () => mockSvg };
    };

    const mdFile = path.join(tmpDir, 'README.md');
    const code = 'graph TD; A-->B;';
    const title = 'Cached Diagram';

    // First call saves it
    await downloadDiagramSvg({
      svgUrl: 'https://mermaid.ink/svg/pako:fake',
      markdownFilePath: mdFile,
      title,
      code,
      outputRoot: tmpDir,
      fetchFn: mockFetch
    });
    assert.equal(fetchCalled, true);

    // Second call should skip download
    fetchCalled = false;
    const secondRes = await downloadDiagramSvg({
      svgUrl: 'https://mermaid.ink/svg/pako:fake',
      markdownFilePath: mdFile,
      title,
      code,
      outputRoot: tmpDir,
      fetchFn: mockFetch
    });

    assert.equal(secondRes.skipped, true);
    assert.equal(fetchCalled, false, 'Fetch must not be called when file exists and is valid');
  });

  it('throws error and does not save file if response is HTTP error', async () => {
    const mockFetch = async () => ({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error'
    });

    const mdFile = path.join(tmpDir, 'README.md');

    await assert.rejects(
      () =>
        downloadDiagramSvg({
          svgUrl: 'https://mermaid.ink/svg/pako:fake',
          markdownFilePath: mdFile,
          title: 'Error Diagram',
          code: 'graph TD; A-->B;',
          outputRoot: tmpDir,
          fetchFn: mockFetch
        }),
      /Failed to download SVG/
    );
  });

  it('throws error if response is not valid SVG', async () => {
    const mockFetch = async () => ({
      ok: true,
      status: 200,
      text: async () => '<html><body>502 Bad Gateway</body></html>'
    });

    const mdFile = path.join(tmpDir, 'README.md');

    await assert.rejects(
      () =>
        downloadDiagramSvg({
          svgUrl: 'https://mermaid.ink/svg/pako:fake',
          markdownFilePath: mdFile,
          title: 'Invalid Diagram',
          code: 'graph TD; A-->B;',
          outputRoot: tmpDir,
          fetchFn: mockFetch
        }),
      /Invalid SVG response received/
    );
  });

  it('transformMarkdown in download mode embeds local relative path and preserves editor URL', async () => {
    const mockSvg = '<svg xmlns="http://www.w3.org/2000/svg"><text>Hello</text></svg>';
    const mockFetch = async () => ({
      ok: true,
      status: 200,
      text: async () => mockSvg
    });

    const mdContent = `### Diagram: Local Flow
\`\`\`mermaid
graph TD; X-->Y;
\`\`\``;

    const mdFile = path.join(tmpDir, 'docs', 'spec.md');
    fs.mkdirSync(path.join(tmpDir, 'docs'), { recursive: true });

    const res = await transformMarkdown({
      content: mdContent,
      markdownFilePath: mdFile,
      mode: 'download',
      outputRoot: tmpDir,
      fetchFn: mockFetch
    });

    assert.equal(res.changed, true);
    // Relative link from docs/spec.md to assets/diagrams/... should be ../assets/diagrams/...
    assert.ok(res.content.includes('[![Local Flow](../assets/diagrams/'));
    // Preserves interactive editor link
    assert.ok(res.content.includes('](https://mermaid.live/edit#pako:'));
    // Preserves original source
    assert.ok(res.content.includes('graph TD; X-->Y;'));
  });
});
