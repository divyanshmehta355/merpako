import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { runCli, parseArgs } from '../lib/cli.js';

describe('CLI Commands & Interface (lib/cli.js)', () => {
  let tmpDir;
  let logs;
  let errors;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'merpako-cli-test-'));
    logs = [];
    errors = [];
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  const captureLog = (msg) => logs.push(msg);
  const captureError = (msg) => errors.push(msg);

  it('--help prints usage guide and exits 0', async () => {
    const code = await runCli(['--help'], { log: captureLog, error: captureError });
    assert.equal(code, 0);
    assert.ok(logs.some((l) => l.includes('merpako 🫧')));
    assert.ok(logs.some((l) => l.includes('USAGE:')));
  });

  it('--version prints package version and exits 0', async () => {
    const code = await runCli(['--version'], { log: captureLog, error: captureError });
    assert.equal(code, 0);
    assert.ok(logs.some((l) => /merpako v\d+\.\d+\.\d+/.test(l)));
  });

  it('rejects unknown options with exit code 1', async () => {
    const code = await runCli(['--unknown-flag'], { log: captureLog, error: captureError });
    assert.equal(code, 1);
    assert.ok(errors.some((e) => e.includes('Unknown option: --unknown-flag')));
  });

  it('rejects incompatible option combinations', async () => {
    const code = await runCli(['--check', '--revert', '.'], { log: captureLog, error: captureError });
    assert.equal(code, 1);
    assert.ok(errors.some((e) => e.includes('Cannot combine --check and --revert')));
  });

  it('reports missing files with exit code 1', async () => {
    const code = await runCli(['missing-file-xyz.md'], { log: captureLog, error: captureError });
    assert.equal(code, 1);
    assert.ok(errors.some((e) => e.includes('File or directory not found: missing-file-xyz.md')));
  });

  it('end-to-end: transforms file, checks it passes, reverts it, and checks it fails', async () => {
    const sampleFile = path.join(tmpDir, 'spec.md');
    const rawContent = `# Spec

### Diagram: User Flow
\`\`\`mermaid
graph TD
  Start --> Stop
\`\`\`
`;
    fs.writeFileSync(sampleFile, rawContent, 'utf8');

    // 1. Initial check mode should fail because spec.md contains a raw block
    let checkCode = await runCli(['--check', sampleFile], { log: captureLog, error: captureError });
    assert.equal(checkCode, 1);
    assert.ok(errors.some((e) => e.includes('Check failed')));

    // 2. Transform the file
    logs = [];
    errors = [];
    const transformCode = await runCli([sampleFile], { log: captureLog, error: captureError });
    assert.equal(transformCode, 0);
    assert.ok(logs.some((l) => l.includes('Transformed')));

    // Verify content on disk
    const transformedContent = fs.readFileSync(sampleFile, 'utf8');
    assert.ok(transformedContent.includes('<!-- merpako:start -->'));
    assert.ok(transformedContent.includes('https://mermaid.ink/svg/pako:'));

    // 3. Check mode should now pass
    logs = [];
    errors = [];
    checkCode = await runCli(['--check', sampleFile], { log: captureLog, error: captureError });
    assert.equal(checkCode, 0);
    assert.ok(logs.some((l) => l.includes('Check passed')));

    // 4. Revert the file
    logs = [];
    errors = [];
    const revertCode = await runCli(['--revert', sampleFile], { log: captureLog, error: captureError });
    assert.equal(revertCode, 0);
    assert.ok(logs.some((l) => l.includes('Reverted')));

    // Verify content on disk is restored
    const revertedContent = fs.readFileSync(sampleFile, 'utf8');
    assert.ok(!revertedContent.includes('<!-- merpako:start -->'));
    assert.ok(revertedContent.includes('```mermaid'));
    assert.ok(revertedContent.includes('Start --> Stop'));

    // 5. Check mode should fail again
    logs = [];
    errors = [];
    checkCode = await runCli(['--check', sampleFile], { log: captureLog, error: captureError });
    assert.equal(checkCode, 1);
  });

  it('correctly parses --download with custom output root and target file', () => {
    const opts = parseArgs(['--download', './custom-out', 'README.md']);
    assert.equal(opts.mode, 'download');
    assert.equal(opts.outputRoot, path.resolve('./custom-out'));
    assert.deepEqual(opts.targets, ['README.md']);
  });

  it('correctly parses --download without custom root followed by target file', () => {
    const opts = parseArgs(['--download', 'README.md']);
    assert.equal(opts.mode, 'download');
    assert.equal(opts.outputRoot, process.cwd());
    assert.deepEqual(opts.targets, ['README.md']);
  });
});
