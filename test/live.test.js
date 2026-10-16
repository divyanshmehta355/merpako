import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { encodeMermaid } from '../lib/encoder.js';

describe('Live Service Compatibility (mermaid.ink & mermaid.live)', () => {
  const isLiveTestEnabled = Boolean(process.env.MERPAKO_LIVE_TEST);

  it('fetches live SVG from mermaid.ink and confirms valid SVG rendering', { skip: !isLiveTestEnabled }, async () => {
    const code = 'graph TD;\n  A[merpako] --> B[mermaid.ink];\n  B --> C[Instant SVG];';
    const { pakoHash, svgUrl } = encodeMermaid(code);

    const response = await fetch(svgUrl, {
      headers: {
        'User-Agent': 'merpako-integration-test'
      }
    });

    assert.equal(response.status, 200, `Expected HTTP 200 from ${svgUrl}`);
    const contentType = response.headers.get('content-type') || '';
    assert.ok(
      contentType.includes('image/svg+xml') || contentType.includes('svg'),
      `Expected svg content type, got: ${contentType}`
    );

    const svgBody = await response.text();
    assert.ok(svgBody.includes('<svg'), 'Response must contain <svg tag');
    assert.ok(svgBody.includes('</svg>'), 'Response must contain </svg> closing tag');
  });

  it('reports live service test status', () => {
    if (!isLiveTestEnabled) {
      console.log('ℹ  Live service integration tests skipped by default (set MERPAKO_LIVE_TEST=1 to run against live mermaid.ink)');
    }
  });
});
