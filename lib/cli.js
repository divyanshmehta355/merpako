import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { discoverMarkdownFiles } from './glob.js';
import { transformFile } from './transformer.js';
import { revertFile } from './revert.js';
import { parseMarkdown } from './parser.js';
import { startWatcher } from './watcher.js';

/**
 * Reads the package version from package.json.
 *
 * @returns {string}
 */
export function getPackageVersion() {
  try {
    const currentDir = path.dirname(fileURLToPath(import.meta.url));
    const pkgPath = path.resolve(currentDir, '..', 'package.json');
    const content = fs.readFileSync(pkgPath, 'utf8');
    const pkg = JSON.parse(content);
    return pkg.version || '1.0.0';
  } catch {
    return '1.0.0';
  }
}

export const HELP_TEXT = `
merpako 🫧 — Mermaid diagrams, everywhere.

Transforms Mermaid code blocks in Markdown files into clickable SVG diagrams
using mermaid.ink and interactive editor links using mermaid.live.

USAGE:
  merpako [options] <files-or-directories...>

COMMANDS & EXAMPLES:
  merpako README.md                Transform one Markdown file (inline mode)
  merpako .                        Recursively transform Markdown files in current directory
  merpako "**/*.md"                Transform all Markdown files matching glob pattern
  merpako --inline README.md       Replace Mermaid code blocks with remote clickable SVGs
  merpako --download README.md     Download rendered SVGs locally to ./assets/diagrams/
  merpako --download ./out docs/   Save diagrams under custom root (./out/assets/diagrams/)
  merpako --revert README.md       Restore generated diagrams back to raw Mermaid fences
  merpako --check .                CI mode: fail with exit code 1 if raw diagrams exist
  merpako --watch .                Watch target directory and auto-transform on change

OPTIONS:
  -i, --inline                     Embed clickable SVG links using mermaid.ink (default)
  -d, --download [dir]             Download SVGs locally to assets/diagrams/ (or [dir])
  -o, --output <dir>               Custom output root directory for downloaded SVGs
  -r, --revert                     Revert merpako blocks back to raw Mermaid source
  -c, --check                      CI mode: check for unprocessed Mermaid diagrams
  -w, --watch                      Watch target directories and reprocess changed files
  -v, --version                    Display version number
  -h, --help                       Show this help message

EXIT CODES:
  0    Success / check passed
  1    Error encountered / unprocessed diagrams found in check mode
`.trim();

/**
 * Parses CLI arguments into an options object and target paths.
 *
 * @param {string[]} args - Process arguments (usually process.argv.slice(2))
 * @returns {{
 *   mode: 'inline' | 'download',
 *   download: boolean,
 *   outputRoot: string,
 *   revert: boolean,
 *   check: boolean,
 *   watch: boolean,
 *   help: boolean,
 *   version: boolean,
 *   targets: string[]
 * }}
 */
export function parseArgs(args) {
  const options = {
    mode: 'inline',
    download: false,
    outputRoot: process.cwd(),
    revert: false,
    check: false,
    watch: false,
    help: false,
    version: false,
    targets: []
  };

  const nonFlagTokens = [];
  let i = 0;

  while (i < args.length) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      options.help = true;
      i++;
    } else if (arg === '--version' || arg === '-v') {
      options.version = true;
      i++;
    } else if (arg === '--inline' || arg === '-i') {
      options.mode = 'inline';
      i++;
    } else if (arg === '--revert' || arg === '-r') {
      options.revert = true;
      i++;
    } else if (arg === '--check' || arg === '-c') {
      options.check = true;
      i++;
    } else if (arg === '--watch' || arg === '-w') {
      options.watch = true;
      i++;
    } else if (arg.startsWith('--download=') || arg.startsWith('-d=')) {
      options.mode = 'download';
      options.download = true;
      options.outputRoot = path.resolve(arg.split('=')[1]);
      i++;
    } else if (arg === '--download' || arg === '-d') {
      options.mode = 'download';
      options.download = true;

      // Check if the next token is an output directory rather than a target file
      const next = args[i + 1];
      if (next && !next.startsWith('-')) {
        // If there's another token after `next`, or if `next` doesn't end with .md/.markdown and is a dir or path
        const ext = path.extname(next).toLowerCase();
        const hasSubsequentTarget = args.length > i + 2;

        if (hasSubsequentTarget && ext !== '.md' && ext !== '.markdown') {
          options.outputRoot = path.resolve(next);
          i += 2;
          continue;
        }
      }
      i++;
    } else if (arg === '--output' || arg === '-o') {
      i++;
      if (!args[i] || args[i].startsWith('-')) {
        throw new Error('Option --output requires a directory path argument');
      }
      options.outputRoot = path.resolve(args[i]);
      i++;
    } else if (arg.startsWith('--output=')) {
      options.outputRoot = path.resolve(arg.split('=')[1]);
      i++;
    } else if (arg.startsWith('-')) {
      throw new Error(`Unknown option: ${arg}. Run 'merpako --help' for usage.`);
    } else {
      nonFlagTokens.push(arg);
      i++;
    }
  }

  options.targets = nonFlagTokens;
  return options;
}

/**
 * Validates option combinations and flags.
 *
 * @param {ReturnType<typeof parseArgs>} options
 */
export function validateOptions(options) {
  const activeModes = [
    options.check && 'check',
    options.revert && 'revert',
    options.watch && 'watch'
  ].filter(Boolean);

  if (options.check && options.revert) {
    throw new Error('Cannot combine --check and --revert');
  }

  if (options.check && options.watch) {
    throw new Error('Cannot combine --check and --watch');
  }

  if (options.revert && options.download) {
    throw new Error('Cannot combine --revert and --download');
  }

  if (options.revert && options.mode === 'inline' && !options.revert) {
    throw new Error('Cannot combine --revert and --inline');
  }
}

/**
 * Main CLI runner.
 *
 * @param {string[]} args - Process arguments
 * @param {object} [io]
 * @param {(msg: string) => void} [io.log=console.log]
 * @param {(msg: string) => void} [io.error=console.error]
 * @returns {Promise<number>} Exit code (0 for success, 1 for error)
 */
export async function runCli(args = process.argv.slice(2), { log = console.log, error = console.error } = {}) {
  try {
    const options = parseArgs(args);

    if (options.help) {
      log(HELP_TEXT);
      return 0;
    }

    if (options.version) {
      log(`merpako v${getPackageVersion()}`);
      return 0;
    }

    validateOptions(options);

    // If no targets provided, display help or default to '.'
    if (options.targets.length === 0) {
      if (options.check || options.watch) {
        options.targets = ['.'];
      } else {
        log(HELP_TEXT);
        return 0;
      }
    }

    // 1. WATCH MODE
    if (options.watch) {
      startWatcher({
        targets: options.targets,
        mode: options.mode,
        outputRoot: options.outputRoot,
        log
      });
      // Watcher stays running
      return 0;
    }

    // Discover matching Markdown files
    const filePaths = discoverMarkdownFiles(options.targets);

    if (filePaths.length === 0) {
      log(`ℹ  No Markdown files found matching: ${options.targets.join(', ')}`);
      return 0;
    }

    // 2. CHECK MODE (CI)
    if (options.check) {
      let filesWithRawBlocks = 0;
      let totalRawBlocks = 0;
      const failedFiles = [];

      for (const filePath of filePaths) {
        const content = await fs.promises.readFile(filePath, 'utf8');
        const { blocks } = parseMarkdown(content);
        const rawBlocks = blocks.filter((b) => b.type === 'raw');

        if (rawBlocks.length > 0) {
          filesWithRawBlocks++;
          totalRawBlocks += rawBlocks.length;
          failedFiles.push({
            filePath,
            count: rawBlocks.length
          });
        }
      }

      if (filesWithRawBlocks > 0) {
        error(`✗ Check failed: ${filesWithRawBlocks} file(s) contain ${totalRawBlocks} unprocessed Mermaid diagram(s):`);
        for (const item of failedFiles) {
          const rel = path.relative(process.cwd(), item.filePath);
          error(`  - ${rel} (${item.count} diagram${item.count > 1 ? 's' : ''})`);
        }
        error(`\nRun 'merpako <files>' to transform them.`);
        return 1;
      }

      log(`✓ Check passed: ${filePaths.length} file(s) verified, 0 unprocessed diagrams.`);
      return 0;
    }

    // 3. REVERT MODE
    if (options.revert) {
      let revertedFilesCount = 0;
      let totalRevertedBlocks = 0;

      for (const filePath of filePaths) {
        const res = await revertFile(filePath);
        if (res.changed) {
          revertedFilesCount++;
          totalRevertedBlocks += res.revertedCount;
          const rel = path.relative(process.cwd(), filePath);
          log(`✓ Reverted ${rel} (${res.revertedCount} diagram${res.revertedCount > 1 ? 's' : ''})`);
        }
      }

      if (revertedFilesCount === 0) {
        log(`ℹ  No merpako diagrams needed reversion.`);
      } else {
        log(`\n✨ Successfully reverted ${totalRevertedBlocks} diagram(s) across ${revertedFilesCount} file(s).`);
      }
      return 0;
    }

    // 4. TRANSFORMATION MODE (Inline or Download)
    let changedFilesCount = 0;
    let totalDiagrams = 0;

    for (const filePath of filePaths) {
      const res = await transformFile({
        filePath,
        mode: options.mode,
        outputRoot: options.outputRoot
      });

      const rel = path.relative(process.cwd(), filePath);
      if (res.changed) {
        changedFilesCount++;
        totalDiagrams += res.diagramsCount;
        log(`✓ Transformed ${rel} (${res.diagramsCount} diagram${res.diagramsCount > 1 ? 's' : ''})`);
      } else if (res.diagramsCount > 0) {
        totalDiagrams += res.diagramsCount;
        log(`- Up to date: ${rel} (${res.diagramsCount} diagram${res.diagramsCount > 1 ? 's' : ''})`);
      }
    }

    if (totalDiagrams === 0) {
      log(`ℹ  No Mermaid diagrams found in scanned files.`);
    } else if (changedFilesCount > 0) {
      log(`\n✨ Processed ${totalDiagrams} diagram(s) across ${filePaths.length} file(s) (${changedFilesCount} updated).`);
    } else {
      log(`\n✓ All ${totalDiagrams} diagram(s) are already up to date.`);
    }

    return 0;
  } catch (err) {
    error(`merpako error: ${err.message}`);
    return 1;
  }
}
