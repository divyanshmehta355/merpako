/**
 * merpako 🫧 — Mermaid diagrams, everywhere.
 *
 * Transform Mermaid code blocks in Markdown files into clickable SVG diagrams
 * with interactive editor links using node:zlib and pako URL encoding.
 */

export {
  encodeMermaid,
  decodeMermaid,
  createSvgUrl,
  createEditorUrl
} from './encoder.js';

export {
  parseMarkdown
} from './parser.js';

export {
  resolveDiagramTitle,
  cleanHeadingText,
  extractMermaidDirectiveTitle,
  escapeMarkdownLabel,
  escapeHtml,
  slugify
} from './title.js';

export {
  downloadDiagramSvg,
  generateSvgFilename,
  calculateRelativeSvgPath
} from './downloader.js';

export {
  transformMarkdown,
  transformFile,
  buildMerpakoBlock
} from './transformer.js';

export {
  revertMarkdown,
  revertFile
} from './revert.js';

export {
  discoverMarkdownFiles,
  globToRegex,
  isGlob,
  isMarkdownFile
} from './glob.js';

export {
  startWatcher
} from './watcher.js';

export {
  runCli,
  parseArgs,
  validateOptions,
  getPackageVersion,
  HELP_TEXT
} from './cli.js';
