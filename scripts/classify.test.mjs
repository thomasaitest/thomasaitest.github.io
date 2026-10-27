import test from 'node:test';
import assert from 'node:assert/strict';
import { classify, countCommits } from './classify.mjs';

test('prefix convention', () => {
  assert.equal(classify('fix: cards could be dragged twice'), 'bug');
  assert.equal(classify('fix(ui): dock overlap'), 'bug');
  assert.equal(classify('security: bump vite to fix CVE-2026-1234'), 'security');
  assert.equal(classify('security(deps): update'), 'security');
});
test('heuristics for older commits', () => {
  assert.equal(classify('Fixed collision bug in the town'), 'bug');
  assert.equal(classify('Bugfix for undo'), 'bug');
  assert.equal(classify('npm audit fix'), 'security');
  assert.equal(classify('Patch XSS in name field'), 'security');
  assert.equal(classify('Fix security issue in storage'), 'security');
  assert.equal(classify('Resolve vulnerability in dependency'), 'security');
});
test('non-fixes and merges are ignored', () => {
  assert.equal(classify('Add security headers'), null);
  assert.equal(classify('Facelift: iOS glass look'), null);
  assert.equal(classify('Merge branch fix-stuff into main'), null);
  assert.equal(classify('Smart tap instead of auto-play'), null);
  assert.equal(classify('prefix handling'), null);
});
test('each commit counts once, security wins', () => {
  assert.deepEqual(countCommits(['fix: a', 'fix security vulnerability', 'security: b', 'x']), { bugs: 1, security: 2 });
});
