import zlib from 'node:zlib';

/**
 * Encodes Mermaid diagram source into a pako-compressed, base64url-encoded string
 * compatible with mermaid.ink and mermaid.live.
 *
 * @param {string} code - The raw Mermaid diagram source.
 * @param {object} [options] - Optional configuration.
 * @param {string} [options.theme='default'] - Mermaid theme to apply.
 * @returns {{ hash: string, pakoHash: string, svgUrl: string, editorUrl: string, payload: object }}
 */
export function encodeMermaid(code, options = {}) {
  if (typeof code !== 'string') {
    throw new TypeError('Expected mermaid source code to be a string');
  }

  const theme = options.theme || 'default';
  const payload = {
    code,
    mermaid: {
      theme
    }
  };

  const jsonStr = JSON.stringify(payload);
  const compressed = zlib.deflateSync(Buffer.from(jsonStr, 'utf8'), { level: 9 });
  const base64url = compressed.toString('base64url');
  const pakoHash = `pako:${base64url}`;

  return {
    hash: base64url,
    pakoHash,
    svgUrl: createSvgUrl(pakoHash),
    editorUrl: createEditorUrl(pakoHash),
    payload
  };
}

/**
 * Creates the SVG image URL for mermaid.ink from a pako hash.
 *
 * @param {string} pakoHash - The hash prefixed with `pako:`.
 * @returns {string}
 */
export function createSvgUrl(pakoHash) {
  const hash = pakoHash.startsWith('pako:') ? pakoHash : `pako:${pakoHash}`;
  return `https://mermaid.ink/svg/${hash}`;
}

/**
 * Creates the interactive editor URL for mermaid.live from a pako hash.
 *
 * @param {string} pakoHash - The hash prefixed with `pako:`.
 * @returns {string}
 */
export function createEditorUrl(pakoHash) {
  const hash = pakoHash.startsWith('pako:') ? pakoHash : `pako:${pakoHash}`;
  return `https://mermaid.live/edit#${hash}`;
}

/**
 * Decodes a pako-compressed base64url hash (or URL containing a pako hash)
 * back into the original payload object.
 *
 * @param {string} hashOrUrl - Hash string or full mermaid.ink/mermaid.live URL.
 * @returns {{ code: string, mermaid: object, [key: string]: any }}
 */
export function decodeMermaid(hashOrUrl) {
  if (typeof hashOrUrl !== 'string') {
    throw new TypeError('Expected hash or URL to be a string');
  }

  // Extract hash portion if full URL is passed
  let raw = hashOrUrl;
  const pakoIndex = raw.indexOf('pako:');
  if (pakoIndex !== -1) {
    raw = raw.slice(pakoIndex + 5);
  } else if (raw.startsWith('#pako:')) {
    raw = raw.slice(6);
  }

  // Remove any query params or fragments if remaining
  raw = raw.split(/[?#]/)[0];

  const buffer = Buffer.from(raw, 'base64url');
  const decompressed = zlib.inflateSync(buffer);
  return JSON.parse(decompressed.toString('utf8'));
}
