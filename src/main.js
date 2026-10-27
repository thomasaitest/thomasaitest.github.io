import './style.css';
import { num, kb, pct, date, dateTime, ago, sevText } from './format.js';

const $ = (id) => document.getElementById(id);

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

function tile(label, value, sub) {
  const t = el('div', 'tile');
  t.append(el('div', 'tile-value', value), el('div', 'tile-label', label));
  if (sub) t.append(el('div', 'tile-sub', sub));
  return t;
}

function stat(label, value, cls) {
  const d = el('div', 'stat');
  d.append(el('dt', null, label), el('dd', cls, value));
  return d;
}

function vulnClass(v) {
  if (!v) return '';
  if (v.critical > 0 || v.high > 0) return 'bad';
  if (v.total > 0) return 'warn';
  return 'good';
}

function renderTotals(t, apps) {
  const box = $('totals');
  box.replaceChildren(
    tile('Kodelinjer', num(t.loc.source), `+ ${num(t.loc.test)} i tester`),
    tile('Tester', num(t.tests.total), t.tests.failed ? `${t.tests.failed} feiler` : 'alle grønne'),
    tile('Testdekning', pct(t.coverage.lines?.pct), 'linjer'),
    tile('Bugs rettet', num(t.fixes.bugs)),
    tile('Sikkerhet rettet', num(t.fixes.security)),
    tile('Commits', num(t.commits.count)),
    tile('Appstørrelse', kb(t.size.gzipBytes), 'gzip, alle apper'),
    tile('Åpne sårbarheter', num(t.vulnerabilities.total), openProd(apps)),
  );
}

function openProd(apps) {
  const prod = apps.reduce((a, x) => a + (x.vulnerabilities?.prod?.total ?? 0), 0);
  return prod === 0 ? '0 i produksjon' : `${prod} i produksjon`;
}

function card(a) {
  const c = el('article', 'card');
  const head = el('div', 'card-head');
  const emoji = a.emoji ? el('span', 'emoji', a.emoji) : null;
  if (emoji) emoji.setAttribute('aria-hidden', 'true');
  const titles = el('div');
  titles.append(el('h3', null, a.name));
  if (a.tags?.length) {
    const tags = el('div', 'tags');
    for (const t of a.tags) tags.append(el('span', 'tag', t));
    titles.append(tags);
  }
  head.append(...(emoji ? [emoji] : []), titles);
  c.append(head);
  if (a.description) c.append(el('p', 'desc', a.description));

  const open = el('a', 'btn', 'Åpne appen');
  open.href = a.url;
  open.target = '_blank';
  open.rel = 'noopener';
  open.append(el('span', 'arrow', '→'));
  const src = el('a', 'link', 'Kildekode');
  src.href = `https://github.com/${a.repo}`;
  src.target = '_blank';
  src.rel = 'noopener';
  const actions = el('div', 'actions');
  actions.append(open, src);
  c.append(actions);

  if (!a.loc) {
    c.append(el('p', 'warn-box', 'Statistikk mangler for denne appen akkurat nå.'));
    return c;
  }

  const v = a.vulnerabilities;
  const dl = el('dl', 'stats');
  dl.append(
    stat('Kodelinjer', num(a.loc.source)),
    stat('Tester', a.tests ? num(a.tests.total) : '–'),
    stat('Dekning', pct(a.coverage?.lines?.pct)),
    stat('Bugs rettet', num(a.fixes.bugs)),
    stat('Sikkerhet rettet', num(a.fixes.security)),
    stat('Commits', num(a.commits.count)),
    stat('Størrelse', a.size ? `${kb(a.size.gzipBytes)} gzip` : '–'),
    stat('Sist oppdatert', date(a.commits.lastUpdate)),
  );
  c.append(dl);

  if (a.coverage?.lines) {
    const bar = el('div', 'bar');
    bar.setAttribute('role', 'img');
    bar.setAttribute('aria-label', `Linjedekning ${pct(a.coverage.lines.pct)}`);
    const fill = el('div', 'bar-fill');
    fill.style.width = `${Math.min(100, a.coverage.lines.pct)}%`;
    bar.append(fill);
    c.append(bar);
  }

  const vuln = el('div', `vuln ${vulnClass(v?.prod)}`);
  vuln.append(
    el('strong', null, 'Sårbarheter (npm audit)'),
    el('span', null, `Produksjon: ${sevText(v?.prod)}`),
    el('span', 'muted', `Alle, inkl. utviklingsverktøy: ${sevText(v?.all)}`),
  );
  c.append(vuln);
  return c;
}

async function main() {
  const res = await fetch('./stats.json', { cache: 'no-cache' });
  if (!res.ok) throw new Error(`stats.json: ${res.status}`);
  const stats = await res.json();

  if (stats.site) {
    $('title').textContent = stats.site.title;
    $('subtitle').textContent = stats.site.subtitle;
    document.title = stats.site.title;
  }
  const apps = stats.apps;

  renderTotals(stats.totals, apps);
  $('apps').replaceChildren(...apps.map(card));
  $('updated').textContent = `Statistikk oppdatert ${dateTime(stats.generatedAt)} (${ago(stats.generatedAt)}).`;
  $('status').remove();
}

main().catch((e) => {
  console.error(e);
  $('status').textContent = 'Kunne ikke laste statistikken. Prøv igjen litt senere.';
});
