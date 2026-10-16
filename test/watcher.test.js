import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { startWatcher, isEditorTempFile } from '../lib/watcher.js';

describe('Watch Mode & Debounce (lib/watcher.js)', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'merpako-watch-test-'));
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('correctly identifies editor temporary files', () => {
    assert.equal(isEditorTempFile('.swp'), true);
    assert.equal(isEditorTempFile('test.md.swp'), true);
    assert.equal(isEditorTempFile('test.md~'), true);
    assert.equal(isEditorTempFile('.test.md'), true);
    assert.equal(isEditorTempFile('4913'), true);
    assert.equal(isEditorTempFile('README.md'), false);
    assert.equal(isEditorTempFile('docs/guide.markdown'), false);
  });

  it('debounces rapid modifications and reprocesses changed markdown files', async () => {
    const testFile = path.join(tmpDir, 'test.md');
    fs.writeFileSync(
      testFile,
      `# Watch Test

\`\`\`mermaid
graph TD; A-->B;
\`\`\`
`,
      'utf8'
    );

    const logMessages = [];
    const watcher = startWatcher({
      targets: [tmpDir],
      mode: 'inline',
      debounceMs: 50,
      log: (msg) => logMessages.push(msg)
    });

    try {
      // Rapid writes
      fs.appendFileSync(testFile, '\n<!-- edit 1 -->');
      fs.appendFileSync(testFile, '\n<!-- edit 2 -->');

      // Wait for debounce and execution
      await new Promise((resolve) => setTimeout(resolve, 300));

      // File should now be transformed by watcher
      const content = fs.readFileSync(testFile, 'utf8');
      assert.ok(content.includes('<!-- merpako:start -->'));
      assert.ok(logMessages.some((msg) => msg.includes('Reprocessed') || msg.includes('test.md')));
    } finally {
      watcher.close();
    }
  });
});
