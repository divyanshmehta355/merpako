#!/usr/bin/env node

import { runCli } from '../lib/cli.js';

runCli().then((exitCode) => {
  if (exitCode !== 0) {
    process.exit(exitCode);
  }
}).catch((err) => {
  console.error('Fatal merpako error:', err);
  process.exit(1);
});
