import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { discoverMarkdownFiles, globToRegex } from '../lib/glob.js';

describe('Glob and File Discovery (lib/glob.js)', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'merpako-glob-test-'));

    // Create sample directory tree
    fs.mkdirSync(path.join(tmpDir, 'docs', 'nested'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, 'folder with spaces'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, 'node_modules', 'sub'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, '.git'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, 'assets', 'diagrams'), { recursive: true });

    fs.writeFileSync(path.join(tmpDir, 'README.md'), '# Root', 'utf8');
    fs.writeFileSync(path.join(tmpDir, 'docs', 'guide.markdown'), '# Guide', 'utf8');
    fs.writeFileSync(path.join(tmpDir, 'docs', 'nested', 'deep.md'), '# Deep', 'utf8');
    fs.writeFileSync(path.join(tmpDir, 'folder with spaces', 'my notes.md'), '# Notes', 'utf8');
    fs.writeFileSync(path.join(tmpDir, 'node_modules', 'pkg.md'), '# Ignore', 'utf8');
    fs.writeFileSync(path.join(tmpDir, 'assets', 'diagrams', 'cached.svg'), '<svg></svg>', 'utf8');
    fs.writeFileSync(path.join(tmpDir, 'code.js'), 'console.log()', 'utf8');
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('globToRegex properly matches glob expressions', () => {
    const regex1 = globToRegex('**/*.md');
    assert.ok(regex1.test('README.md'));
    assert.ok(regex1.test('docs/nested/deep.md'));
    assert.ok(!regex1.test('file.js'));

    const regex2 = globToRegex('docs/*.markdown');
    assert.ok(regex2.test('docs/guide.markdown'));
    assert.ok(!regex2.test('docs/nested/deep.markdown'));
  });

  it('discovers a single file directly', () => {
    const singleFile = path.join(tmpDir, 'README.md');
    const files = discoverMarkdownFiles(singleFile, { cwd: tmpDir });

    assert.equal(files.length, 1);
    assert.equal(files[0], path.resolve(singleFile));
  });

  it('recursively discovers files in directory while ignoring node_modules, .git, assets/diagrams', () => {
    const files = discoverMarkdownFiles(tmpDir, { cwd: tmpDir });

    assert.equal(files.length, 4);
    const basenames = files.map((f) => path.basename(f)).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    assert.deepEqual(basenames, ['deep.md', 'guide.markdown', 'my notes.md', 'README.md']);
  });

  it('expands quoted glob pattern internally', () => {
    const files = discoverMarkdownFiles('docs/**/*.md', { cwd: tmpDir });

    assert.equal(files.length, 1);
    assert.equal(path.basename(files[0]), 'deep.md');
  });

  it('handles paths with spaces correctly', () => {
    const spacePath = path.join(tmpDir, 'folder with spaces', 'my notes.md');
    const files = discoverMarkdownFiles(spacePath, { cwd: tmpDir });

    assert.equal(files.length, 1);
    assert.equal(files[0], path.resolve(spacePath));
  });

  it('eliminates duplicates and provides stable sorted ordering', () => {
    const single = path.join(tmpDir, 'README.md');
    const files = discoverMarkdownFiles([single, tmpDir, 'README.md'], { cwd: tmpDir });

    assert.equal(files.length, 4);
    // Verify sorted
    const sorted = [...files].sort();
    assert.deepEqual(files, sorted);
  });

  it('throws helpful error for nonexistent file', () => {
    assert.throws(
      () => discoverMarkdownFiles('nonexistent-file.md', { cwd: tmpDir }),
      /File or directory not found: nonexistent-file\.md/
    );
  });
});
