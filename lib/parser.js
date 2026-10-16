/**
 * Represents a parsed code fence or merpako block in a Markdown document.
 *
 * @typedef {object} RawMermaidBlock
 * @property {'raw'} type
 * @property {number} startLine
 * @property {number} endLine
 * @property {number} startOffset
 * @property {number} endOffset
 * @property {string} indent
 * @property {string} fenceChar
 * @property {number} fenceLength
 * @property {string} infoString
 * @property {string} mermaidCode
 * @property {string} originalText
 * @property {string|null} precedingHeading
 *
 * @typedef {object} MerpakoGeneratedBlock
 * @property {'merpako'} type
 * @property {number} startLine
 * @property {number} endLine
 * @property {number} startOffset
 * @property {number} endOffset
 * @property {string} originalText
 * @property {string} preservedSource
 * @property {string} title
 * @property {string} imageSrc
 * @property {string} linkHref
 * @property {string|null} precedingHeading
 *
 * @typedef {RawMermaidBlock | MerpakoGeneratedBlock} ParsedBlock
 */

/**
 * Parses a Markdown document and identifies all raw Mermaid code blocks and
 * already-generated merpako blocks.
 *
 * Adheres to CommonMark fence rules (0-3 space indent, 3+ backticks or tildes,
 * language info string, matching closing fence length).
 * Safely skips non-Mermaid code blocks so mermaid-like strings inside code fences
 * are never falsely recognized.
 *
 * @param {string} markdown - The raw markdown content.
 * @returns {{ blocks: ParsedBlock[], eol: string }}
 */
export function parseMarkdown(markdown) {
  if (typeof markdown !== 'string') {
    throw new TypeError('Expected markdown content to be a string');
  }

  const eol = markdown.includes('\r\n') ? '\r\n' : '\n';
  const lines = markdown.split(/\r?\n/);
  const blocks = [];

  // Pre-calculate line offsets in the original text
  const lineOffsets = [];
  let currentOffset = 0;
  for (let idx = 0; idx < lines.length; idx++) {
    lineOffsets.push(currentOffset);
    // Find the actual length of the newline at this boundary
    const afterLine = currentOffset + lines[idx].length;
    if (markdown.slice(afterLine, afterLine + 2) === '\r\n') {
      currentOffset += lines[idx].length + 2;
    } else if (markdown.slice(afterLine, afterLine + 1) === '\n' || markdown.slice(afterLine, afterLine + 1) === '\r') {
      currentOffset += lines[idx].length + 1;
    } else {
      currentOffset += lines[idx].length;
    }
  }

  let currentHeading = null;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Check for Markdown ATX heading: 0-3 spaces followed by 1-6 '#'
    const headingMatch = line.match(/^[ ]{0,3}(#{1,6}\s+.+)$/);
    if (headingMatch) {
      currentHeading = headingMatch[1];
      i++;
      continue;
    }

    // Check for merpako block start marker
    if (line.includes('<!-- merpako:start -->')) {
      const startLine = i;
      const startOffset = lineOffsets[startLine];
      let endLine = -1;

      // Scan until merpako end marker
      for (let j = i; j < lines.length; j++) {
        if (lines[j].includes('<!-- merpako:end -->')) {
          endLine = j;
          break;
        }
      }

      if (endLine !== -1) {
        const endLineLength = lines[endLine].length;
        const endOffset = lineOffsets[endLine] + endLineLength;
        const blockText = markdown.slice(startOffset, endOffset);

        // Extract title, image source, and link from [![Title](imageSrc)](linkHref)
        let title = '';
        let imageSrc = '';
        let linkHref = '';

        const imageLinkMatch = blockText.match(/\[!\[(.*?)\]\((.*?)\)\]\((.*?)\)/);
        if (imageLinkMatch) {
          title = imageLinkMatch[1].replace(/\\([\[\]])/g, '$1'); // unescape \[ and \]
          imageSrc = imageLinkMatch[2];
          linkHref = imageLinkMatch[3];
        } else {
          const simpleImageMatch = blockText.match(/!\[(.*?)\]\((.*?)\)/);
          if (simpleImageMatch) {
            title = simpleImageMatch[1].replace(/\\([\[\]])/g, '$1');
            imageSrc = simpleImageMatch[2];
          }
        }

        // Extract preserved source from inside <details>...</details>
        let preservedSource = '';
        const detailsMatch = blockText.match(/<details[\s\S]*?<\/details>/i);
        if (detailsMatch) {
          const detailsContent = detailsMatch[0];
          // Find mermaid code fence inside details
          const innerFenceMatch = detailsContent.match(/(?:```|~~~)mermaid\s*[\r\n]+([\s\S]*?)[\r\n]+(?:```|~~~)/i);
          if (innerFenceMatch) {
            preservedSource = innerFenceMatch[1];
          } else {
            // Fallback: extract content after </summary> and before </details>
            const summaryEndMatch = detailsContent.match(/<\/summary>([\s\S]*?)<\/details>/i);
            if (summaryEndMatch) {
              preservedSource = summaryEndMatch[1].trim();
            }
          }
        }

        blocks.push({
          type: 'merpako',
          startLine,
          endLine,
          startOffset,
          endOffset,
          originalText: blockText,
          preservedSource,
          title,
          imageSrc,
          linkHref,
          precedingHeading: currentHeading
        });

        i = endLine + 1;
        continue;
      }
    }

    // Check for fenced code block start: 0-3 spaces, 3+ backticks or tildes
    const fenceMatch = line.match(/^([ ]{0,3})(`{3,}|~{3,})(.*)$/);
    if (fenceMatch) {
      const indent = fenceMatch[1];
      const fenceChars = fenceMatch[2];
      const fenceChar = fenceChars[0];
      const fenceLength = fenceChars.length;
      const infoString = fenceMatch[3].trim();
      const firstWord = infoString.split(/\s+/)[0].toLowerCase();

      // Check if closing fence matches this opening fence
      const isClosingFence = (testLine) => {
        const closeRegex = new RegExp(`^[ ]{0,3}\\${fenceChar}{${fenceLength},}\\s*$`);
        return closeRegex.test(testLine);
      };

      if (firstWord === 'mermaid') {
        // Raw unprocessed Mermaid diagram block
        const startLine = i;
        const startOffset = lineOffsets[startLine];
        let endLine = -1;

        for (let j = i + 1; j < lines.length; j++) {
          if (isClosingFence(lines[j])) {
            endLine = j;
            break;
          }
        }

        if (endLine !== -1) {
          const endLineLength = lines[endLine].length;
          const endOffset = lineOffsets[endLine] + endLineLength;
          const originalText = markdown.slice(startOffset, endOffset);
          const mermaidLines = lines.slice(startLine + 1, endLine);
          const mermaidCode = mermaidLines.join(eol);

          blocks.push({
            type: 'raw',
            startLine,
            endLine,
            startOffset,
            endOffset,
            indent,
            fenceChar,
            fenceLength,
            infoString,
            mermaidCode,
            originalText,
            precedingHeading: currentHeading
          });

          i = endLine + 1;
          continue;
        }
      } else {
        // Non-Mermaid fenced code block: skip to its closing fence
        for (let j = i + 1; j < lines.length; j++) {
          if (isClosingFence(lines[j])) {
            i = j;
            break;
          }
        }
        i++;
        continue;
      }
    }

    i++;
  }

  return { blocks, eol };
}
