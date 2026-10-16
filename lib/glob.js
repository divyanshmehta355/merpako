import fs from 'node:fs';
import path from 'node:path';

/**
 * Converts a glob pattern into a regular expression.
 * Supports:
 * - `**` (recursive directory match)
 * - `*` (single directory segment match)
 * - `?` (single character)
 * - Case-insensitive extension matching (.md / .MD)
 *
 * @param {string} glob
 * @returns {RegExp}
 */
export function globToRegex(glob) {
  const normalized = glob.replace(/\\/g, '/');
  let regexStr = '^';
  let i = 0;

  while (i < normalized.length) {
    const c = normalized[i];

    if (c === '*' && normalized[i + 1] === '*') {
      // '**/' or '**'
      if (normalized[i + 2] === '/') {
        regexStr += '(?:.*?/)?';
        i += 3;
      } else {
        regexStr += '.*';
        i += 2;
      }
    } else if (c === '*') {
      regexStr += '[^/]*';
      i++;
    } else if (c === '?') {
      regexStr += '[^/]';
      i++;
    } else if ('+()^$.{}|['.includes(c)) {
      regexStr += `\\${c}`;
      i++;
    } else {
      regexStr += c;
      i++;
    }
  }

  regexStr += '$';
  return new RegExp(regexStr, 'i');
}

/**
 * Checks if a string contains glob characters.
 *
 * @param {string} str
 * @returns {boolean}
 */
export function isGlob(str) {
  return /[*?[\]{}]/.test(str);
}

/**
 * Determines whether a file path has a Markdown extension (.md, .markdown).
 *
 * @param {string} filePath
 * @returns {boolean}
 */
export function isMarkdownFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return ext === '.md' || ext === '.markdown';
}

/**
 * Default directory names to ignore during recursive search.
 */
const DEFAULT_IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  '.github',
  '.merpako',
  'coverage',
  '.nyc_output'
]);

/**
 * Recursively discovers files in a directory while skipping ignored directories.
 *
 * @param {string} dir
 * @param {Set<string>} [ignoredDirs]
 * @returns {string[]} List of discovered absolute file paths
 */
function walkDirectory(dir, ignoredDirs = DEFAULT_IGNORED_DIRS) {
  const results = [];

  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return results;
  }

  for (const entry of entries) {
    if (entry.name.startsWith('.') && entry.name !== '.' && entry.name !== '..') {
      // Skip hidden files/directories by default unless explicitly targeted
      if (ignoredDirs.has(entry.name)) continue;
    }

    if (entry.isDirectory()) {
      if (ignoredDirs.has(entry.name)) continue;
      // Skip assets/diagrams output directory
      if (entry.name === 'diagrams' && path.basename(dir) === 'assets') continue;

      const subDir = path.join(dir, entry.name);
      results.push(...walkDirectory(subDir, ignoredDirs));
    } else if (entry.isFile()) {
      results.push(path.join(dir, entry.name));
    }
  }

  return results;
}

/**
 * Discovers all Markdown files matching the given target patterns.
 * Supports:
 * - Single files (.md / .markdown)
 * - Directories (e.g. '.' or 'docs')
 * - Quoted glob patterns (e.g. "**\/*.md")
 * - Spaces in paths
 * - Deduplication
 * - Stable, deterministic sorting
 *
 * @param {string|string[]} patterns
 * @param {object} [options]
 * @param {string} [options.cwd=process.cwd()] - Current working directory
 * @returns {string[]} Sorted array of resolved file paths
 */
export function discoverMarkdownFiles(patterns, options = {}) {
  const cwd = path.resolve(options.cwd || process.cwd());
  const inputList = Array.isArray(patterns) ? patterns : [patterns];
  const matchedFiles = new Set();

  for (const rawTarget of inputList) {
    if (!rawTarget || typeof rawTarget !== 'string') continue;

    const trimmed = rawTarget.trim();
    if (!trimmed) continue;

    // Check if it's a glob pattern
    if (isGlob(trimmed)) {
      const globRegex = globToRegex(trimmed);
      // Find base search directory before glob starts
      const normalized = trimmed.replace(/\\/g, '/');
      const firstWildcard = normalized.search(/[*?[\]{}]/);
      let baseDir = '.';
      if (firstWildcard !== -1) {
        const prefix = normalized.slice(0, firstWildcard);
        const lastSlash = prefix.lastIndexOf('/');
        if (lastSlash !== -1) {
          baseDir = prefix.slice(0, lastSlash);
        }
      }

      const searchRoot = path.resolve(cwd, baseDir);
      if (fs.existsSync(searchRoot)) {
        const allFiles = walkDirectory(searchRoot);
        for (const filePath of allFiles) {
          if (!isMarkdownFile(filePath)) continue;

          const relPath = path.relative(cwd, filePath).replace(/\\/g, '/');
          if (globRegex.test(relPath) || globRegex.test(filePath.replace(/\\/g, '/'))) {
            matchedFiles.add(path.resolve(filePath));
          }
        }
      }
      continue;
    }

    // Direct path (file or directory)
    const resolvedPath = path.resolve(cwd, trimmed);

    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`File or directory not found: ${trimmed}`);
    }

    const stat = fs.statSync(resolvedPath);
    if (stat.isDirectory()) {
      const dirFiles = walkDirectory(resolvedPath);
      for (const filePath of dirFiles) {
        if (isMarkdownFile(filePath)) {
          matchedFiles.add(path.resolve(filePath));
        }
      }
    } else if (stat.isFile()) {
      matchedFiles.add(resolvedPath);
    }
  }

  // Stable, deterministic sorted output
  return Array.from(matchedFiles).sort();
}
