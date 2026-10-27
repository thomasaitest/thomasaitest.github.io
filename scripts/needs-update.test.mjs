import test from 'node:test';
import assert from 'node:assert/strict';
import { decide } from './needs-update.mjs';

const now = Date.parse('2026-10-27T12:00:00Z');
const live = (h = 1, shas = { solitaire: 'a', 'heddas-verden': 'b' }) => ({
  generatedAt: new Date(now - h * 3600000).toISOString(),
  apps: Object.entries(shas).map(([id, commitSha]) => ({ id, commitSha })),
});
const heads = (s = 'a', h = 'b') => [['solitaire', s], ['heddas-verden', h]];

test('ingen live -> oppdater', () => assert.equal(decide({ live: null, heads: heads(), now }).needed, true));
test('ferske, uendrede data -> hopp over', () => assert.equal(decide({ live: live(), heads: heads(), now }).needed, false));
test('ny commit -> oppdater', () => assert.equal(decide({ live: live(), heads: heads('x'), now }).needed, true));
test('gammel stats -> oppdater', () => assert.equal(decide({ live: live(30), heads: heads(), now }).needed, true));
test('API-feil -> oppdater', () => assert.equal(decide({ live: live(), heads: heads(null), now }).needed, true));
test('ny app i config -> oppdater', () => assert.equal(decide({ live: live(1, { solitaire: 'a' }), heads: heads(), now }).needed, true));
