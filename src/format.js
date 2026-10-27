const nf = new Intl.NumberFormat('nb-NO');
const df = new Intl.DateTimeFormat('nb-NO', { day: 'numeric', month: 'short', year: 'numeric' });
const dtf = new Intl.DateTimeFormat('nb-NO', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Oslo' });

export const num = (n) => (n == null ? '–' : nf.format(n));
export const kb = (bytes) => (bytes == null ? '–' : `${nf.format(Math.round(bytes / 1024))} KB`);
export const pct = (p) => (p == null ? '–' : `${new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 1 }).format(p)} %`);
export const date = (iso) => (iso ? df.format(new Date(iso)) : '–');
export const dateTime = (iso) => (iso ? dtf.format(new Date(iso)) : '–');

/** Hvor lenge siden, på norsk. */
export function ago(iso, now = Date.now()) {
  if (!iso) return '–';
  const mins = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
  if (mins < 1) return 'nå nettopp';
  if (mins < 60) return `${mins} min siden`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} t siden`;
  const days = Math.round(hours / 24);
  return days === 1 ? '1 dag siden' : `${days} dager siden`;
}

const SEV = [['critical', 'kritiske'], ['high', 'høye'], ['moderate', 'moderate'], ['low', 'lave'], ['info', 'info']];
/** «3 kritiske, 2 høye» eller «Ingen». */
export function sevText(v) {
  if (!v) return '–';
  const parts = SEV.filter(([k]) => v[k] > 0).map(([k, label]) => `${v[k]} ${label}`);
  return parts.length ? parts.join(', ') : 'Ingen';
}
