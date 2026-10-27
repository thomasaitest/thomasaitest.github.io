// Klassifiserer commit-meldinger. Reglene er dokumentert i README.md.
// En commit telles høyst én gang: sikkerhet går foran bug.

const SECURITY_PREFIX = /^(security|sec)(\([^)]*\))?!?:/i;
const BUG_PREFIX = /^(fix|bugfix|hotfix)(\([^)]*\))?!?:/i;
// Eldre commits uten prefiks:
const SECURITY_WORDS = /\b(vulnerabilit\w*|vuln\w*|cve-\d+|xss|csrf|audit)\b/i;
const SECURITY_WITH_VERB = /\b(security|secure|sanitiz\w*|harden\w*)\b.*\b(fix\w*|patch\w*|resolv\w*|close[sd]?)\b|\b(fix\w*|patch\w*|resolv\w*|close[sd]?)\b.*\b(security|sanitiz\w*)\b/i;
const BUG_WORDS = /\b(fix(e[sd])?|bug(s|fix(es)?)?|hotfix|regression|patch(e[sd])?)\b/i;

export function isMerge(subject) {
  return /^Merge (branch|pull request|remote-tracking)/i.test(subject);
}

/** @returns {'security'|'bug'|null} */
export function classify(subject) {
  const s = subject.trim();
  if (!s || isMerge(s)) return null;
  if (SECURITY_PREFIX.test(s)) return 'security';
  if (BUG_PREFIX.test(s)) return 'bug';
  if (SECURITY_WORDS.test(s) || SECURITY_WITH_VERB.test(s)) return 'security';
  if (BUG_WORDS.test(s)) return 'bug';
  return null;
}

export function countCommits(subjects) {
  let bugs = 0;
  let security = 0;
  for (const s of subjects) {
    const k = classify(s);
    if (k === 'bug') bugs++;
    else if (k === 'security') security++;
  }
  return { bugs, security };
}
