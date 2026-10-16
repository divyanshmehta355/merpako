/**
 * merpako 🫧 — Mermaid diagrams, everywhere.
 * TypeScript definitions for programmatic usage.
 */

export interface EncodeOptions {
  /**
   * Mermaid theme to apply in state payload.
   * @default 'default'
   */
  theme?: string;
}

export interface EncodedMermaid {
  /** The Base64URL-encoded compressed payload */
  hash: string;
  /** The hash prefixed with `pako:` */
  pakoHash: string;
  /** Direct SVG URL from mermaid.ink */
  svgUrl: string;
  /** Interactive live editor URL from mermaid.live */
  editorUrl: string;
  /** The JSON payload object that was compressed */
  payload: {
    code: string;
    mermaid: {
      theme: string;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
}

export interface DecodedPayload {
  /** The Mermaid diagram source code */
  code: string;
  /** Mermaid configuration options */
  mermaid?: {
    theme?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface RawMermaidBlock {
  type: 'raw';
  startLine: number;
  endLine: number;
  startOffset: number;
  endOffset: number;
  indent: string;
  fenceChar: string;
  fenceLength: number;
  infoString: string;
  mermaidCode: string;
  originalText: string;
  precedingHeading: string | null;
}

export interface MerpakoGeneratedBlock {
  type: 'merpako';
  startLine: number;
  endLine: number;
  startOffset: number;
  endOffset: number;
  originalText: string;
  preservedSource: string;
  title: string;
  imageSrc: string;
  linkHref: string;
  precedingHeading: string | null;
}

export type ParsedBlock = RawMermaidBlock | MerpakoGeneratedBlock;

export interface ParseResult {
  blocks: ParsedBlock[];
  eol: string;
}

export interface ResolveTitleParams {
  nearbyHeading?: string | null;
  mermaidCode: string;
  diagramIndex?: number;
}

export interface DownloadSvgParams {
  svgUrl: string;
  markdownFilePath?: string;
  title: string;
  code: string;
  outputRoot?: string;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
}

export interface DownloadResult {
  svgFilePath: string;
  relativePath: string;
  skipped: boolean;
}

export interface GenerateFilenameParams {
  markdownFilePath?: string;
  title: string;
  code: string;
}

export interface BuildBlockParams {
  title: string;
  imageSrc: string;
  editorUrl: string;
  mermaidCode: string;
  indent?: string;
  fenceChar?: string;
  fenceLength?: number;
  eol?: string;
}

export interface TransformMarkdownParams {
  content: string;
  markdownFilePath?: string;
  mode?: 'inline' | 'download';
  outputRoot?: string;
  fetchFn?: typeof fetch;
}

export interface TransformResult {
  content: string;
  changed: boolean;
  diagramsCount: number;
  rawCount: number;
}

export interface TransformFileParams {
  filePath: string;
  mode?: 'inline' | 'download';
  outputRoot?: string;
  fetchFn?: typeof fetch;
}

export interface TransformFileResult {
  filePath: string;
  changed: boolean;
  diagramsCount: number;
  rawCount: number;
}

export interface RevertResult {
  content: string;
  changed: boolean;
  revertedCount: number;
}

export interface RevertFileResult {
  filePath: string;
  changed: boolean;
  revertedCount: number;
}

export interface DiscoverOptions {
  cwd?: string;
}

export interface WatcherParams {
  targets: string[];
  mode?: 'inline' | 'download';
  outputRoot?: string;
  debounceMs?: number;
  log?: (msg: string) => void;
}

export interface WatcherController {
  close: () => void;
}

export interface CliOptions {
  mode: 'inline' | 'download';
  download: boolean;
  outputRoot: string;
  revert: boolean;
  check: boolean;
  watch: boolean;
  help: boolean;
  version: boolean;
  targets: string[];
}

export interface CliIo {
  log?: (msg: string) => void;
  error?: (msg: string) => void;
}

/**
 * Encodes Mermaid diagram source into a pako-compressed, base64url-encoded string
 * compatible with mermaid.ink and mermaid.live.
 */
export function encodeMermaid(code: string, options?: EncodeOptions): EncodedMermaid;

/**
 * Decodes a pako-compressed hash or full URL back into the payload object.
 */
export function decodeMermaid(hashOrUrl: string): DecodedPayload;

/**
 * Constructs a mermaid.ink SVG URL from a pako hash.
 */
export function createSvgUrl(pakoHash: string): string;

/**
 * Constructs a mermaid.live interactive editor URL from a pako hash.
 */
export function createEditorUrl(pakoHash: string): string;

/**
 * Parses Markdown content identifying raw Mermaid code blocks and merpako blocks.
 */
export function parseMarkdown(markdown: string): ParseResult;

/**
 * Resolves diagram title by precedence: heading > directive > fallback.
 */
export function resolveDiagramTitle(params: ResolveTitleParams): string;

/**
 * Strips markdown formatting, heading hashes, and prefix labels from a heading.
 */
export function cleanHeadingText(heading: string): string;

/**
 * Extracts title directive from Mermaid code or frontmatter.
 */
export function extractMermaidDirectiveTitle(code: string): string | null;

/**
 * Escapes characters for safe Markdown link/image label usage.
 */
export function escapeMarkdownLabel(title: string): string;

/**
 * Escapes characters for HTML embedding.
 */
export function escapeHtml(str: string): string;

/**
 * Converts a string into a filesystem-safe slug.
 */
export function slugify(str: string): string;

/**
 * Downloads a rendered SVG from mermaid.ink and saves it to assets/diagrams/.
 */
export function downloadDiagramSvg(params: DownloadSvgParams): Promise<DownloadResult>;

/**
 * Generates a deterministic SVG filename based on file, title, and code hash.
 */
export function generateSvgFilename(params: GenerateFilenameParams): string;

/**
 * Calculates a relative forward-slash path from a Markdown file to an SVG file.
 */
export function calculateRelativeSvgPath(markdownFilePath: string, svgFilePath: string): string;

/**
 * Transforms Markdown content by converting Mermaid blocks into inline or download embeds.
 */
export function transformMarkdown(params: TransformMarkdownParams): Promise<TransformResult>;

/**
 * Transforms a Markdown file on disk atomically.
 */
export function transformFile(params: TransformFileParams): Promise<TransformFileResult>;

/**
 * Formats a single merpako Markdown block with image link and collapsible source.
 */
export function buildMerpakoBlock(params: BuildBlockParams): string;

/**
 * Reverts merpako-generated blocks in a Markdown string back to raw Mermaid fences.
 */
export function revertMarkdown(markdown: string): RevertResult;

/**
 * Reverts a Markdown file on disk back to raw Mermaid code blocks.
 */
export function revertFile(filePath: string): Promise<RevertFileResult>;

/**
 * Discovers Markdown files matching given paths, directories, or glob patterns.
 */
export function discoverMarkdownFiles(patterns: string | string[], options?: DiscoverOptions): string[];

/**
 * Converts a glob pattern string into a RegExp.
 */
export function globToRegex(glob: string): RegExp;

/**
 * Checks if a pattern contains wildcard glob characters.
 */
export function isGlob(str: string): boolean;

/**
 * Checks if a file path has a Markdown extension (.md or .markdown).
 */
export function isMarkdownFile(filePath: string): boolean;

/**
 * Starts watching directories or files for Markdown changes and auto-transforms diagrams.
 */
export function startWatcher(params: WatcherParams): WatcherController;

/**
 * Main CLI runner.
 */
export function runCli(args?: string[], io?: CliIo): Promise<number>;

/**
 * Parses CLI command-line arguments.
 */
export function parseArgs(args: string[]): CliOptions;

/**
 * Validates CLI options against conflicting flags.
 */
export function validateOptions(options: CliOptions): void;

/**
 * Gets package version from package.json.
 */
export function getPackageVersion(): string;

/**
 * Formatted CLI help message.
 */
export const HELP_TEXT: string;
