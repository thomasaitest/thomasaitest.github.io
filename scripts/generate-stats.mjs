#!/usr/bin/env node
// Genererer public/stats.json ved å klone appenes offentlige repoer (kun lesing),
// kjøre tester med dekning, bygge, og kjøre npm audit. Ingen token kreves.
//
// Bruk: node scripts/generate-stats.mjs [--only id] [--out fil] [--cache mappe] [--keep]
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { countCommits } from './classify.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const only = opt('only');
const outFile = path.resolve(root, opt('out', 'public/stats.json'));
const cacheDir = path.resolve(root, opt('cache', '.cache'));
const cloneBase = process.env.CLONE_BASE || 'https://github.com';

const config = JSON.parse(fs.readFileSync(path.join(root, 'apps.config.json'), 'utf8'));
const CODE_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.css', '.html', '.vue', '.svelte']);
const TEST_FILE = /\.(test|spec)\.[cm]?[jt]sx?$|(^|\/)(__tests__|tests?)\//;

// Appenes kode kjøres (build/test) med minimalt miljø: ingen tokens eller hemmeligheter videreføres.
function cleanEnv(extra = {}) {
  const keep = ['PATH', 'HOME', 'TMPDIR', 'LANG', 'LC_ALL', 'NODE_OPTIONS', 'npm_config_cache', 'NPM_CONFIG_CACHE', 'SSL_CERT_FILE', 'HTTPS_PROXY', 'HTTP_PROXY', 'NO_PROXY'];
  const env = Object.fromEntries(keep.filter((k) => process.env[k]).map((k) => [k, process.env[k]]));
  return { ...env, CI: '1', ...extra };
}

function run(cmd, cmdArgs, cwd, extra = {}) {
  const r = spawnSync(cmd, cmdArgs, {
    cwd,
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
    env: cleanEnv(extra.env),
  });
  return { code: r.status, out: r.stdout || '', err: r.stderr || '' };
}
const log = (...m) => console.error('[stats]', ...m);

function countLines(text) {
  return text.split('\n').filter((l) => l.trim() !== '').length;
}

function gitStats(dir) {
  const raw = execFileSync('git', ['log', '--no-color', '--format=%cI%x1f%s'], { cwd: dir, encoding: 'utf8' });
  const rows = raw.split('\n').filter(Boolean).map((l) => l.split('\x1f'));
  const subjects = rows.map((r) => r[1]);
  const { bugs, security } = countCommits(subjects);
  return {
    commits: { count: rows.length, lastUpdate: rows[0]?.[0] ?? null, firstCommit: rows.at(-1)?.[0] ?? null },
    fixes: { bugs, security },
  };
}

function locStats(dir, paths) {
  const files = execFileSync('git', ['ls-files'], { cwd: dir, encoding: 'utf8' }).split('\n').filter(Boolean);
  let source = 0;
  let test = 0;
  let fileCount = 0;
  for (const f of files) {
    if (!paths.some((p) => f === p || f.startsWith(p.endsWith('/') ? p : `${p}/`))) continue;
    if (!CODE_EXT.has(path.extname(f))) continue;
    if (f.endsWith('.d.ts')) continue;
    const n = countLines(fs.readFileSync(path.join(dir, f), 'utf8'));
    fileCount++;
    if (TEST_FILE.test(f)) test += n;
    else source += n;
  }
  return { source, test, total: source + test, files: fileCount };
}

function vulnCounts(meta) {
  const v = meta?.vulnerabilities;
  if (!v) return null;
  return { info: v.info ?? 0, low: v.low ?? 0, moderate: v.moderate ?? 0, high: v.high ?? 0, critical: v.critical ?? 0, total: v.total ?? 0 };
}

function auditStats(dir) {
  const parse = (extraArgs) => {
    const r = run('npm', ['audit', '--json', ...extraArgs], dir);
    try {
      return vulnCounts(JSON.parse(r.out).metadata);
    } catch {
      return null;
    }
  };
  return { all: parse([]), prod: parse(['--omit=dev']) };
}

function dirSize(dir) {
  let raw = 0;
  let gzip = 0;
  let files = 0;
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name !== '.nojekyll') {
        const buf = fs.readFileSync(p);
        raw += buf.length;
        gzip += zlib.gzipSync(buf, { level: 9 }).length;
        files++;
      }
    }
  };
  walk(dir);
  return { rawBytes: raw, gzipBytes: gzip, files };
}

function testAndCoverage(dir, tmp) {
  const result = {};
  const errors = [];
  // Dekningsmotoren installeres kun i den klonede kopien (--no-save). Appens repo endres aldri.
  let vitestVersion = null;
  try {
    vitestVersion = JSON.parse(fs.readFileSync(path.join(dir, 'node_modules/vitest/package.json'), 'utf8')).version;
  } catch { /* ingen vitest */ }
  if (!vitestVersion) return { tests: null, coverage: null, errors: ['vitest er ikke installert i appen'] };

  const inst = run('npm', ['install', '--no-save', '--no-audit', '--no-fund', '--ignore-scripts', `@vitest/coverage-v8@${vitestVersion}`], dir);
  const haveCoverage = inst.code === 0;
  if (!haveCoverage) errors.push('kunne ikke installere @vitest/coverage-v8');

  const jsonOut = path.join(tmp, 'vitest.json');
  const covDir = path.join(tmp, 'coverage');
  const vargs = ['vitest', 'run', '--reporter=json', `--outputFile=${jsonOut}`];
  if (haveCoverage) {
    vargs.push('--coverage.enabled=true', '--coverage.provider=v8', '--coverage.reporter=json-summary',
      `--coverage.reportsDirectory=${covDir}`, '--coverage.include=src/**/*.{ts,tsx}',
      '--coverage.exclude=**/*.test.*', '--coverage.exclude=**/*.d.ts', '--coverage.exclude=src/test/**');
  }
  const r = run('npx', ['--no-install', ...vargs], dir);
  try {
    const j = JSON.parse(fs.readFileSync(jsonOut, 'utf8'));
    result.tests = { total: j.numTotalTests, passed: j.numPassedTests, failed: j.numFailedTests, suites: j.numTotalTestSuites };
  } catch {
    result.tests = null;
    errors.push(`vitest feilet (exit ${r.code})`);
  }
  try {
    const c = JSON.parse(fs.readFileSync(path.join(covDir, 'coverage-summary.json'), 'utf8')).total;
    const pick = (k) => ({ pct: c[k].pct, covered: c[k].covered, total: c[k].total });
    result.coverage = { lines: pick('lines'), statements: pick('statements'), branches: pick('branches'), functions: pick('functions') };
  } catch {
    result.coverage = null;
    if (haveCoverage) errors.push('fant ikke dekningsrapport');
  }
  return { ...result, errors };
}

function processApp(app) {
  const errors = [];
  const dir = path.join(cacheDir, app.id);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), `hub-${app.id}-`));
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(cacheDir, { recursive: true });
  log(app.id, 'kloner', `${cloneBase}/${app.repo}.git`);
  const cl = run('git', ['clone', '--quiet', `${cloneBase}/${app.repo}.git`, dir], root);
  if (cl.code !== 0) throw new Error(`git clone feilet: ${cl.err.trim()}`);

  const out = meta(app);
  Object.assign(out, gitStats(dir));
  out.loc = locStats(dir, app.loc?.paths ?? ['src']);
  out.commitSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: dir, encoding: 'utf8' }).trim();

  const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
  out.dependencies = { prod: Object.keys(pkg.dependencies ?? {}).length, dev: Object.keys(pkg.devDependencies ?? {}).length };

  log(app.id, 'npm ci');
  const ci = run('npm', ['ci', '--ignore-scripts', '--no-audit', '--no-fund'], dir);
  if (ci.code !== 0) {
    errors.push(`npm ci feilet: ${ci.err.split('\n').slice(0, 3).join(' ')}`);
    Object.assign(out, { tests: null, coverage: null, size: null, vulnerabilities: null });
  } else {
    log(app.id, 'npm audit');
    out.vulnerabilities = auditStats(dir);
    log(app.id, 'build');
    const b = run('npm', ['run', 'build'], dir, { env: { BASE_PATH: new URL(app.url).pathname } });
    if (b.code === 0) out.size = dirSize(path.join(dir, 'dist'));
    else { out.size = null; errors.push(`build feilet: ${(b.err || b.out).split('\n').slice(-4).join(' ')}`); }
    log(app.id, 'tester og dekning');
    const t = testAndCoverage(dir, tmp);
    out.tests = t.tests;
    out.coverage = t.coverage;
    errors.push(...t.errors);
  }
  out.errors = errors;
  fs.rmSync(tmp, { recursive: true, force: true });
  return out;
}

const meta = (app) => ({
  id: app.id, name: app.name, emoji: app.emoji, description: app.description, tags: app.tags ?? [], url: app.url, repo: app.repo,
});

const sum = (list, f) => list.reduce((a, x) => a + (f(x) ?? 0), 0);

function totals(apps) {
  const cov = (k) => {
    const covered = sum(apps, (a) => a.coverage?.[k]?.covered);
    const total = sum(apps, (a) => a.coverage?.[k]?.total);
    return total ? { pct: Math.round((covered / total) * 10000) / 100, covered, total } : null;
  };
  const sev = (k) => sum(apps, (a) => a.vulnerabilities?.all?.[k]);
  return {
    apps: apps.length,
    loc: { source: sum(apps, (a) => a.loc?.source), test: sum(apps, (a) => a.loc?.test), total: sum(apps, (a) => a.loc?.total) },
    tests: { total: sum(apps, (a) => a.tests?.total), passed: sum(apps, (a) => a.tests?.passed), failed: sum(apps, (a) => a.tests?.failed) },
    coverage: { lines: cov('lines'), statements: cov('statements'), branches: cov('branches'), functions: cov('functions') },
    fixes: { bugs: sum(apps, (a) => a.fixes?.bugs), security: sum(apps, (a) => a.fixes?.security) },
    commits: { count: sum(apps, (a) => a.commits?.count) },
    size: { rawBytes: sum(apps, (a) => a.size?.rawBytes), gzipBytes: sum(apps, (a) => a.size?.gzipBytes) },
    vulnerabilities: { info: sev('info'), low: sev('low'), moderate: sev('moderate'), high: sev('high'), critical: sev('critical'), total: sev('total') },
  };
}

const selected = config.apps.filter((a) => !only || a.id === only);
const results = [];
for (const app of selected) {
  try {
    results.push(processApp(app));
  } catch (e) {
    log(app.id, 'FEIL', e.message);
    results.push({ ...meta(app), errors: [e.message] });
  }
}

const stats = {
  generatedAt: new Date().toISOString(),
  site: config.site,
  apps: results,
  totals: totals(results),
};
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, `${JSON.stringify(stats, null, 2)}\n`);
log('skrev', path.relative(root, outFile));
if (!args.includes('--keep')) fs.rmSync(cacheDir, { recursive: true, force: true });
if (results.every((r) => !r.loc)) {
  log('ingen apper kunne leses');
  process.exit(1);
}
