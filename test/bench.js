import { transformMarkdown } from '../lib/transformer.js';
import { parseMarkdown } from '../lib/parser.js';
import { performance } from 'node:perf_hooks';

const sampleMarkdown = `# Performance Benchmark Document

Here is some documentation text describing a microservices architecture.

### Diagram: Video Processing Pipeline
\`\`\`mermaid
sequenceDiagram
  autonumber
  actor User
  participant Web as Web App
  participant API as Upload Service
  participant Worker as Transcoder Worker
  participant S3 as Storage Bucket
  User->>Web: Select video file
  Web->>API: Request presigned URL
  API-->>Web: Return URL
  Web->>S3: Direct upload binary
  S3-->>Worker: ObjectCreated event
  Worker->>Worker: Transcode to 1080p, 720p, HLS
  Worker->>S3: Save processed streams
  Worker-->>API: Notify completion
  API-->>User: Ready to stream
\`\`\`

More documentation follows with code examples:

\`\`\`javascript
function playVideo(id) {
  return fetch('/api/videos/' + id);
}
\`\`\`

### Diagram: State Transition
\`\`\`mermaid
stateDiagram-v2
  [*] --> Uploading
  Uploading --> Transcoding
  Transcoding --> Ready
  Transcoding --> Failed
  Failed --> [*]
  Ready --> [*]
\`\`\`

End of document.
`;

console.log('🫧 Running merpako benchmark...');

// 1. Benchmark parseMarkdown
const parseStart = performance.now();
const ITERATIONS = 100;
for (let i = 0; i < ITERATIONS; i++) {
  parseMarkdown(sampleMarkdown);
}
const parseEnd = performance.now();
const avgParseMs = (parseEnd - parseStart) / ITERATIONS;

// 2. Benchmark transformMarkdown (inline local processing)
const transformStart = performance.now();
for (let i = 0; i < ITERATIONS; i++) {
  await transformMarkdown({ content: sampleMarkdown, mode: 'inline' });
}
const transformEnd = performance.now();
const avgTransformMs = (transformEnd - transformStart) / ITERATIONS;

console.log(`✓ Parse speed: ${avgParseMs.toFixed(3)} ms per file (${ITERATIONS} runs)`);
console.log(`✓ Inline transform speed (2 diagrams, compression & Base64URL): ${avgTransformMs.toFixed(3)} ms per file (${ITERATIONS} runs)`);
console.log(`✓ Sub-50ms target met: ${avgTransformMs < 50 ? 'YES' : 'NO'}`);
