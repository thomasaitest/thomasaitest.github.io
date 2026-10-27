#!/usr/bin/env node
// Bestemmer om statistikken må regenereres, uten token (offentlige API-kall).
// Ja hvis: (a) publisert stats.json mangler eller er eldre enn MAX_AGE_HOURS,
//          (b) en app har nye commits på standardgrenen siden forrige generering.
// Skriver needed=true|false til $GITHUB_OUTPUT (og stdout).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const config = JSON.parse(fs.readFileSync(path.join(root, 'apps.config.json'), 'utf8'));
const liveUrl = process.env.STATS_URL || 'https://thomasaitest.github.io/stats.json';
const apiBase = process.env.API_BASE || 'https://api.github.com';
const maxAgeMs = Number(process.env.MAX_AGE_HOURS || 24) * 3600 * 1000;

export function decide({ live, heads, now = Date.now(), maxAge = maxAgeMs }) {
  if (!live) return { needed: true, reason: 'ingen publisert stats.json' };
  const age = now - new Date(live.generatedAt).getTime();
  if (!(age < maxAge)) return { needed: true, reason: `stats.json er ${Math.round(age / 3600000)} t gammel` };
  const known = new Map(live.apps.map((a) => [a.id, a.commitSha]));
  for (const [id, sha] of heads) {
    if (!sha) return { needed: true, reason: `kunne ikke lese HEAD for ${id}` };
    if (known.get(id) !== sha) return { needed: true, reason: `ny commit i ${id}` };
  }
  const configIds = config.apps.map((a) => a.id).sort().join();
  if (live.apps.map((a) => a.id).sort().join() !== configIds) return { needed: true, reason: 'app-listen er endret' };
  return { needed: false, reason: 'ingen endringer' };
}

async function getJson(url, headers = {}) {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'app-hub', ...headers } });
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const live = await getJson(liveUrl, { 'Cache-Control': 'no-cache' });
  const heads = [];
  for (const app of config.apps) {
    const repo = await getJson(`${apiBase}/repos/${app.repo}`);
    const branch = repo?.default_branch;
    const c = branch ? await getJson(`${apiBase}/repos/${app.repo}/commits/${branch}`) : null;
    heads.push([app.id, c?.sha ?? null]);
  }
  const d = decide({ live, heads });
  console.log(`needed=${d.needed} (${d.reason})`);
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `needed=${d.needed}\n`);
}
