// Copyright 2026 CQComber contributors. SPDX-License-Identifier: Apache-2.0
// Preserve notices from installed packages, including nested dependencies.
const fs = require('node:fs');
const path = require('node:path');
const output = path.resolve('licenses');
fs.mkdirSync(output, { recursive: true });
function collect(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) collect(file);
    else if (entry.isFile() && (/^(licen[cs]e|notice|copying|copyright)([.\-_]|$)/i.test(entry.name) || entry.name === 'package.json')) {
      const destination = path.join(output, file);
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.copyFileSync(file, destination);
    }
  }
}
collect('node_modules');
fs.copyFileSync('LICENSE', path.join(output, 'UI-LICENSE'));
