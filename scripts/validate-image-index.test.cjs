const test = require('node:test');
const assert = require('node:assert/strict');
const validate = require('./validate-image-index.cjs');
const entry = architecture => ({platform: {os: 'linux', architecture}, digest: `sha256:${'a'.repeat(64)}`});
test('accepts both architectures with retained attestations', () => {
  assert.equal(validate({manifests: [entry('amd64'), entry('arm64'), {
    platform: {os: 'unknown', architecture: 'unknown'},
    annotations: {'vnd.docker.reference.type': 'attestation-manifest'},
  }]}).length, 2);
});
test('rejects incomplete, duplicate and unsupported platforms', () => {
  for (const manifests of [[entry('amd64')], [entry('arm64')],
    [entry('amd64'), entry('amd64')], [entry('amd64'), entry('arm')]]) {
    assert.throws(() => validate({manifests}));
  }
});
test('rejects a single image manifest and unmarked unknown entries', () => {
  assert.throws(() => validate({config: {}}));
  assert.throws(() => validate({manifests: [entry('amd64'), entry('arm64'), entry('unknown')]}));
});
