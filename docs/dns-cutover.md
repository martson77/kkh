# DNS-cutover for kammarkorenhogalid.se

Nedan text kan skickas vidare till den person som andrar DNS.

## Handoff-text

Vi migrerar `kammarkorenhogalid.se` fran Webflow till Cloudflare Pages. Gor andringen i denna ordning for att minimera risk:

1. Bekrafta att nya sajten ar godkand pa Cloudflare Pages preview-url.
2. Lagg till custom domains i Cloudflare Pages:
   - `www.kammarkorenhogalid.se`
   - `kammarkorenhogalid.se`
3. Om Cloudflare redan hanterar DNS-zonen:
   - Godkann de DNS-poster som Pages foreslar i dashboarden.
   - Skapa en 301 redirect rule fran `kammarkorenhogalid.se` till `https://www.kammarkorenhogalid.se${uri}`.
4. Om extern DNS-leverantor fortfarande hanterar zonen:
   - Satt `www` som `CNAME` till det `*.pages.dev`-mal som visas i Cloudflare Pages.
   - Satt apex (`@`) enligt det verifierings- eller aliasmal som Cloudflare Pages visar for root-domanen.
   - Om apex inte kan aliasas, behall apex som redirect/forward till `https://www.kammarkorenhogalid.se/`.
5. Lat Webflow-poster ligga kvar tills `www.kammarkorenhogalid.se` svarar korrekt fran nya hostingen.
6. Nar den nya sajten ar verifierad i produktion, ta bort gamla Webflow-DNS-poster.

## Slutkontroll efter switch

- `https://www.kammarkorenhogalid.se/` svarar med ny sajten
- `https://kammarkorenhogalid.se/` redirectar till `https://www.kammarkorenhogalid.se/`
- Startsida, Om oss, Dirigenten och Konserter laddar utan fel
- Tickster, Svenska kyrkans formular, Facebook, Instagram och e-postlank fungerar
