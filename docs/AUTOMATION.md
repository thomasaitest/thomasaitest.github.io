# Automatisering av statistikk

Status: **skrevet, ikke aktivert.** Ingenting er pushet eller publisert.

## Anbefalt: ingen token, ingen hemmeligheter

Arbeidsflyten `.github/workflows/pages.yml` i hub-repoet (`thomasaitest/thomasaitest.github.io`):

1. Kjører hvert 30. minutt (`cron`). `scripts/needs-update.mjs` spør GitHub sitt offentlige API
   (uten token) om siste commit i hver app og sammenligner med `stats.json` som ligger live.
   Er det en ny commit, eller er statistikken eldre enn 24 timer, kjøres resten. Ellers stopper jobben i sekunder.
   Dette gir «ved hver deploy og daglig» uten at appene må kjenne til hub-en.
2. `npm run stats` kloner hver app anonymt fra `https://github.com/<repo>.git`, kjører `npm ci`,
   `npm audit`, bygger, og kjører Vitest med dekning. Dekningsmotoren (`@vitest/coverage-v8`) installeres
   med `--no-save` kun i den klonede kopien, så **appenes repoer endres aldri**.
3. Bygger hub-en og publiserer til GitHub Pages med det innebygde `GITHUB_TOKEN`
   (`pages: write`, `id-token: write`). Ingen PAT.
4. Kjører også ved push til `main` og manuelt (`workflow_dispatch`).

Forsinkelse etter en app-deploy: opptil ca. 30–45 minutter (GitHub kan forsinke cron). Daglig oppdatering er garantert.

### Engangsoppsett ved publisering (krever Thomas sin godkjenning)

- Opprette det offentlige repoet `thomasaitest/thomasaitest.github.io`, pushe `main`.
- Settings → Pages → Source: **GitHub Actions** (kan gjøres med `gh api -X POST repos/thomasaitest/thomasaitest.github.io/pages -f build_type=workflow`).
- Ingen secrets å lagre.

### Kjente begrensninger

- GitHub slår av planlagte kjøringer i offentlige repoer etter 60 dager uten aktivitet (commits). Hub-repoet
  får ikke egne commits av cron-jobben. Hvis statistikken står stille, kjør «Run workflow» manuelt, eller push en liten endring.
- Kun offentlige repoer støttes uten token. Et privat repo ville kreve en token (se under).

## Alternativ (ikke anbefalt): utløs hub-en direkte fra appens deploy

Gir oppdatering i løpet av ett minutt, men krever en token.

**Hemmelighet som trengs:** `HUB_DISPATCH_TOKEN`

- Type: fine-grained personal access token for kontoen `thomasaitest`.
- Repository access: *Only select repositories* → kun `thomasaitest/thomasaitest.github.io`.
- Permissions: *Contents: Read and write* (det er det `repository_dispatch` krever). Ingen andre.
- Utløpsdato: maks 90 dager, så den må fornyes.
- Lagring: Settings → Secrets and variables → Actions → *New repository secret* i **hver app-repo** (`solitaire`, `heddas-verden`).
  Aldri i kode, `.env` eller commit-meldinger. Opprettes av Thomas i GitHub-grensesnittet; den skal ikke deles i chat.

Steg som legges til i appens `deploy.yml`, som egen jobb etter `deploy`:

```yaml
  notify-hub:
    needs: deploy
    if: github.event_name != 'pull_request'
    runs-on: ubuntu-latest
    steps:
      - name: Si fra til samlesiden
        env:
          GH_TOKEN: ${{ secrets.HUB_DISPATCH_TOKEN }}
        run: |
          gh api repos/thomasaitest/thomasaitest.github.io/dispatches \
            -f event_type=app-deployed -f 'client_payload[app]=${{ github.event.repository.name }}'
```

Anbefaling: bruk den token-frie varianten. Gevinsten ved å spare noen minutter er liten sammenlignet med å forvalte en token.
