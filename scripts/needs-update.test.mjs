import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { decide } from './needs-update.mjs';

// Test against the apps in the real config, so adding an app does not break the tests.
const ids = JSON.parse(readFileSync(new URL('../apps.config.json', import.meta.url), 'utf8')).apps.map((a) => a.id);
const sameShas = (sha = 'a') => Object.fromEntries(ids.map((id) => [id, sha]));

const now = Date.parse('2026-10-27T12:00:00Z');
const live = (h = 1, shas = sameShas()) => ({
  generatedAt: new Date(now - h * 3600000).toISOString(),
  apps: Object.entries(shas).map(([id, commitSha]) => ({ id, commitSha })),
});
const heads = (first = 'a') => ids.map((id, i) => [id, i === 0 ? first : 'a']);

test('ingen live -> oppdater', () => assert.equal(decide({ live: null, heads: heads(), now }).needed, true));
test('ferske, uendrede data -> hopp over', () => assert.equal(decide({ live: live(), heads: heads(), now }).needed, false));
test('ny commit -> oppdater', () => assert.equal(decide({ live: live(), heads: heads('x'), now }).needed, true));
test('gammel stats -> oppdater', () => assert.equal(decide({ live: live(30), heads: heads(), now }).needed, true));
test('API-feil -> oppdater', () => assert.equal(decide({ live: live(), heads: heads(null), now }).needed, true));
test('ny app i config -> oppdater', () => assert.equal(decide({ live: live(1, { [ids[0]]: 'a' }), heads: heads(), now }).needed, true));
