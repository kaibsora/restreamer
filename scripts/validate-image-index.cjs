// Copyright 2026 CQComber contributors. SPDX-License-Identifier: Apache-2.0
'use strict';
const fs = require('node:fs');
function validate(index) {
  if (!Array.isArray(index.manifests)) throw new Error('Expected a multi-platform image index');
  const found = [];
  for (const entry of index.manifests) {
    if (entry.annotations?.['vnd.docker.reference.type'] === 'attestation-manifest' &&
        entry.platform?.os === 'unknown' && entry.platform?.architecture === 'unknown') continue;
    const platform = `${entry.platform?.os}/${entry.platform?.architecture}`;
    if (!['linux/amd64', 'linux/arm64'].includes(platform) || found.includes(platform)) {
      throw new Error(`Unexpected or duplicate platform: ${platform}`);
    }
    if (!/^sha256:[0-9a-f]{64}$/.test(entry.digest)) throw new Error('Invalid platform digest');
    found.push(platform);
  }
  if (found.length !== 2) throw new Error('Both linux/amd64 and linux/arm64 are required');
  return found;
}
module.exports = validate;
if (require.main === module) console.log(validate(JSON.parse(fs.readFileSync(0, 'utf8'))).join(', '));
