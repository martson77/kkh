# Deploy till Cloudflare Pages

## Rekommenderad setup

Anvand Cloudflare Pages med Git-integration och `public/` som output-katalog. Sajten ar helt statisk och behover inget build-steg.

## Skapa projektet

1. Ga till Cloudflare Dashboard -> Workers & Pages -> Create application -> Pages -> Connect to Git.
2. Valj detta repo.
3. Satt dessa buildvarden:
   - Framework preset: `None`
   - Build command: tomt
   - Build output directory: `public`
   - Root directory: tomt
4. Bekrafta deployen och verifiera forhandsvisningen pa `*.pages.dev`.

## Lagg till domaner

1. I Pages-projektet, ga till `Custom domains`.
2. Lagg till `www.kammarkorenhogalid.se`.
3. Lagg till `kammarkorenhogalid.se`.
4. Satt `www.kammarkorenhogalid.se` som primar doman.

## Redirect-regel for apex -> www

Efter att bada domanerna ar kopplade till projektet, skapa en Redirect Rule i Cloudflare:

- If: `Hostname equals kammarkorenhogalid.se`
- Then: `301 Static Redirect`
- Destination: `https://www.kammarkorenhogalid.se${uri}`

Detta bevarar dagens beteende dar apex skickas vidare till `www`.

## Verifiering fore DNS-cutover

Kontrollera i `*.pages.dev` att:

- `/` visar startsidan
- `/om-oss/` visar sidan om koren
- `/dirigenten/` visar dirigentsidan
- `/konserter/` visar konsertsidan
- Menyn fungerar
- Inga egna filer laddas fran Webflows CDN
