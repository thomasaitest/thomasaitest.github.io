# Samleside for nettapper

Statisk samleside (Vite, vanlig JS) med lenker til alle nettappene og enkel statistikk. Norsk grensesnitt,
mobil først, lys/mørk via `prefers-color-scheme`. Tallene leses fra `stats.json`, som genereres av `npm run stats`.

## Legge til en app

Legg et objekt i `apps.config.json` (`id`, `name`, `emoji`, `description`, `url`, `repo`, `tags`, `loc.paths`).
Repoet må være offentlig og være et npm-prosjekt med `npm run build`. Vitest gir tester og dekning.

## Kommandoer

```
npm ci
npm run stats      # kloner appene (kun lesing), tester, bygger, audit -> public/stats.json (ca. 30 s)
npm run dev        # lokal utvikling
npm run build      # -> dist/
npm test           # enhetstester for telleregler og oppdateringssjekk
```

`npm run stats -- --only solitaire` kjører én app. `CLONE_BASE` kan peke på en annen git-vert (for test).

## Hva som telles

| Tall | Regel |
|---|---|
| Kodelinjer | Ikke-tomme linjer i filtypene ts/tsx/js/mjs/css/html under stiene i `loc.paths` (standard `src/` og `index.html`), `.d.ts` ekskludert. Testfiler (`*.test.*`, `*.spec.*`, `test/`) telles separat. Avhengigheter og bygg telles aldri (kun git-sporede filer). |
| Tester | Antall tester fra `vitest run --reporter=json`. |
| Testdekning | Linjedekning (v8) over alle `src/**/*.ts(x)`, også filer ingen test laster. Det gir et ærlig, lavt tall for UI- og 3D-kode. |
| Bugs rettet | Commit som starter med `fix:` (også `fix(scope):`, `bugfix:`, `hotfix:`), eller hvis emnelinjen inneholder `fix/fixed/fixes`, `bug`, `bugfix`, `hotfix`, `regression` eller `patch`. |
| Sikkerhet rettet | Commit som starter med `security:` eller `sec:`, eller emnelinje med `vulnerability`, `vuln`, `CVE-…`, `XSS`, `CSRF` eller `audit`, eller `security`/`sanitize`/`harden` sammen med fix/patch/resolve/close. |
| | Hver commit telles høyst én gang; sikkerhet går foran bug. Merge-commits ignoreres. Se `scripts/classify.mjs` og testene. |
| Commits / sist oppdatert | `git log` på standardgrenen. |
| Appstørrelse | Summen av alle filer i `dist/` etter `npm run build`, ukomprimert og gzip (nivå 9). |
| Sårbarheter | `npm audit --json` totalt og med `--omit=dev` (produksjon), fordelt på alvorlighetsgrad. |

**Konvensjon framover:** bruk `fix:` og `security:` som prefiks i commit-meldinger i appene, så blir tallene presise.

## Automatisering

Se `docs/AUTOMATION.md` og `.github/workflows/pages.yml`. Ingen hemmeligheter kreves.
