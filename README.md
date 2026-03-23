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
npm run publish-prep
npm run campaign
npm run check-content
npm run poster
npm run mirror
npm run serve
```

- `npm run build-site` rebuilds the generated pages in `public/` from `scripts/site-data.mjs`.
- `npm run publish-prep` rebuilds the site, runs a content check, generates campaign drafts, and creates PDF posters for upcoming concerts in one step.
- `npm run campaign` generates reusable concert and recruitment campaign drafts in `generated/campaigns/`.
- `npm run check-content` writes a content-health report to `generated/reports/content-check.md`.
- `npm run poster` creates A4 PDF posters for upcoming concerts in `generated/posters/` and publishes downloadable copies to `public/affischer/`.
- `npm run mirror` refreshes the original public snapshot and local asset copies.
- `npm run serve` starts a local server at `http://127.0.0.1:4173`.

## Content workflow

Most editorial updates should now happen in `scripts/site-data.mjs`.

To minimize manual work, the content file now also drives:

- the next-concert homepage content
- concert metadata and calendar links
- campaign draft generation
- a basic stale-content check

The main low-effort workflow is:

```bash
npm run publish-prep
```

That command will:

1. rebuild the site
2. check whether required content is missing or stale
3. generate ready-to-edit campaign drafts for the next concert and singer recruitment
4. export print-ready PDF posters for upcoming concerts

Generated files are written to `generated/` and are ignored by Git.

Poster generation uses built-in macOS tooling and produces PDF files directly without extra dependencies.

Typical flow:

```bash
npm run build-site
npm run serve
```

If you need to refresh the original mirrored source first:

```bash
npm run mirror
npm run publish-prep
```

## Deployment

Deploy with Cloudflare Pages using Git integration and no build step inside Cloudflare.

- Framework preset: `None`
- Build command: leave empty
- Build output directory: `public`

Detailed instructions are available in [docs/deploy-cloudflare-pages.md](docs/deploy-cloudflare-pages.md).
