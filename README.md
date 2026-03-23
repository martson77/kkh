# Kammarkoren Hogalid

Detta repo innehaller en statisk kopia av `kammarkorenhogalid.se`, genererad fran den publika sajten utan beroende till Webflows hosting for egna filer.

## Struktur

- `public/` innehaller den deploybara sajten.
- `scripts/mirror-site.mjs` hamtar om de publicerade sidorna och lokala assets.
- `docs/deploy-cloudflare-pages.md` beskriver deploy och Pages-installning.
- `docs/dns-cutover.md` innehaller en handoff-text for DNS-andringen.

## Vanliga kommandon

```bash
npm run mirror
npm run serve
```

`npm run mirror` uppdaterar snapshotten fran den publika sajten.

`npm run serve` startar en lokal server pa `http://127.0.0.1:4173`.

## Cloudflare Pages

Anvand Git-integration utan build-steg.

- Build command: lamnas tomt
- Build output directory: `public`

Detaljerade steg finns i [docs/deploy-cloudflare-pages.md](docs/deploy-cloudflare-pages.md).
