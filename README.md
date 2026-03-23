# Kammarkoren Hogalid

This repository contains the static version of `kammarkorenhogalid.se`.

The site was originally mirrored from the public Webflow site, but it is now maintained as a local static site with a small content generator for concerts, metadata, calendar files, and key landing pages.

## Project structure

- `public/` contains the deployable site.
- `scripts/mirror-site.mjs` refreshes the original mirrored snapshot and downloads external assets.
- `scripts/build-site.mjs` rebuilds the current site pages, concert pages, and calendar files from structured content.
- `scripts/site-data.mjs` is the main content source for concerts, choir information, metadata, and CTA copy.
- `docs/deploy-cloudflare-pages.md` describes deployment to Cloudflare Pages.
- `docs/dns-cutover.md` contains DNS handoff instructions.

## Common commands

```bash
npm run build-site
npm run mirror
npm run serve
```

- `npm run build-site` rebuilds the generated pages in `public/` from `scripts/site-data.mjs`.
- `npm run mirror` refreshes the original public snapshot and local asset copies.
- `npm run serve` starts a local server at `http://127.0.0.1:4173`.

## Content workflow

Most editorial updates should now happen in `scripts/site-data.mjs`.

Typical flow:

```bash
npm run build-site
npm run serve
```

If you need to refresh the original mirrored source first:

```bash
npm run mirror
npm run build-site
```

## Deployment

Deploy with Cloudflare Pages using Git integration and no build step inside Cloudflare.

- Framework preset: `None`
- Build command: leave empty
- Build output directory: `public`

Detailed instructions are available in [docs/deploy-cloudflare-pages.md](docs/deploy-cloudflare-pages.md).
