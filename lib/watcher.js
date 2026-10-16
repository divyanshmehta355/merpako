import fs from 'node:fs';
import path from 'node:path';
import { isMarkdownFile } from './glob.js';
import { transformFile } from './transformer.js';

/**
 * Checks if a filename looks like an editor temporary file.
 *
 * @param {string} filename
 * @returns {boolean}
 */
export function isEditorTempFile(filename) {
  if (!filename) return true;
  const base = path.basename(filename);
  if (base.startsWith('.') || base.startsWith('~')) return true;
  if (base.endsWith('.tmp') || base.endsWith('.swp') || base.endsWith('.swo') || base.endsWith('~')) return true;
  if (/^\d{4,}$/.test(base)) return true; // Vim 4913 test files
  return false;
}

/**
 * Starts watching directories or files for Markdown changes and automatically re-transforms diagrams.
 *
 * @param {object} params
 * @param {string[]} params.targets - Directories or files to watch
 * @param {'inline' | 'download'} [params.mode='inline'] - Mode to run
 * @param {string} [params.outputRoot] - Output root for downloaded SVGs
 * @param {number} [params.debounceMs=250] - Debounce interval in ms
 * @param {(msg: string) => void} [params.log] - Logging function
 * @returns {{ close: () => void }} Controller object with close() method
 */
export function startWatcher({
  targets,
  mode = 'inline',
  outputRoot = process.cwd(),
  debounceMs = 250,
  log = console.log
}) {
  const watchers = [];
  const activeDebounceTimers = new Map();
  const recentlyWrittenFiles = new Map();

  const markFileAsSelfWritten = (filePath) => {
    recentlyWrittenFiles.set(path.resolve(filePath), Date.now());
  };

  const isRecentlyWritten = (filePath) => {
    const lastWrite = recentlyWrittenFiles.get(path.resolve(filePath));
    if (!lastWrite) return false;
    if (Date.now() - lastWrite < 2000) return true;
    recentlyWrittenFiles.delete(path.resolve(filePath));
    return false;
  };

  const processFile = async (filePath) => {
    const resolved = path.resolve(filePath);
    if (!fs.existsSync(resolved)) {
      log(`ℹ  File deleted: ${path.relative(process.cwd(), resolved)}`);
      return;
    }

    if (isRecentlyWritten(resolved)) {
      return;
    }

    try {
      markFileAsSelfWritten(resolved);
      const res = await transformFile({
        filePath: resolved,
        mode,
        outputRoot
      });

      const rel = path.relative(process.cwd(), resolved);
      if (res.changed) {
        log(`✨ Reprocessed ${rel} (${res.diagramsCount} diagrams)`);
      }
    } catch (err) {
      log(`✗  Error processing ${path.relative(process.cwd(), resolved)}: ${err.message}`);
    }
  };

  const triggerDebounced = (filePath) => {
    const resolved = path.resolve(filePath);
    if (isEditorTempFile(resolved) || !isMarkdownFile(resolved)) return;

    if (activeDebounceTimers.has(resolved)) {
      clearTimeout(activeDebounceTimers.get(resolved));
    }

    const timer = setTimeout(() => {
      activeDebounceTimers.delete(resolved);
      processFile(resolved);
    }, debounceMs);

    activeDebounceTimers.set(resolved, timer);
  };

  const watchDirRecursive = (dir) => {
    let watcher;
    try {
      watcher = fs.watch(dir, (eventType, filename) => {
        if (!filename) return;
        const fullPath = path.join(dir, filename);

        // If a new directory was created, watch it too
        try {
          if (fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()) {
            const base = path.basename(fullPath);
            if (base !== 'node_modules' && base !== '.git' && !(base === 'diagrams' && path.basename(dir) === 'assets')) {
              watchDirRecursive(fullPath);
            }
            return;
          }
        } catch {
          // ignore stat errors on rapid transient files
        }

        triggerDebounced(fullPath);
      });
      watchers.push(watcher);
    } catch (err) {
      // ignore inaccessible dirs
      return;
    }

    // Recursively attach to subdirectories for reliable cross-platform watching
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const name = entry.name;
          if (name === 'node_modules' || name === '.git' || (name === 'diagrams' && path.basename(dir) === 'assets')) {
            continue;
          }
          watchDirRecursive(path.join(dir, name));
        }
      }
    } catch {
      // ignore
    }
  };

  for (const target of targets) {
    const resolved = path.resolve(target);
    if (!fs.existsSync(resolved)) continue;

    const stat = fs.statSync(resolved);
    if (stat.isDirectory()) {
      watchDirRecursive(resolved);
    } else if (stat.isFile() && isMarkdownFile(resolved)) {
      const watcher = fs.watch(resolved, () => triggerDebounced(resolved));
      watchers.push(watcher);
    }
  }

  log(`🫧  merpako watching for changes... (Press Ctrl+C to stop)`);

  const close = () => {
    for (const timer of activeDebounceTimers.values()) {
      clearTimeout(timer);
    }
    activeDebounceTimers.clear();

    for (const watcher of watchers) {
      try {
        watcher.close();
      } catch {
        // ignore
      }
    }
    watchers.length = 0;
  };

  const onSignal = () => {
    log(`\n🫧  merpako watch stopped.`);
    close();
    process.exit(0);
  };

  process.once('SIGINT', onSignal);
  process.once('SIGTERM', onSignal);

  return { close };
}
