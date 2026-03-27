# Visit Stockholm

Use `scripts/submit-visit-stockholm.mjs` to send a concert from `scripts/site-data.mjs` to Visit Stockholm without filling the web form manually.

## Usage

```bash
npm run visit-stockholm -- <concert-slug> --email <address> --dry-run
npm run visit-stockholm -- <concert-slug> --email <address>
```

Example:

```bash
npm run visit-stockholm -- palmeri-misa-tango --email lindvall.martin@gmail.com --dry-run
npm run visit-stockholm -- palmeri-misa-tango --email lindvall.martin@gmail.com
```

## What the script does

- reads concert title, venue, dates, descriptions, image, and concert URL from `scripts/site-data.mjs`
- opens the current Visit Stockholm submission page in a temporary headless browser
- resolves category IDs from the live page when available and falls back to the known classical-music IDs used for choir concerts
- generates the required reCAPTCHA token in the page context
- fetches the concert image from the public site and posts the submission to Visit Stockholm

## Defaults

- Main category: `Musik`
- Subcategory: `Klassiskt & Konstmusik`
- Closest station: inferred from venue data or `transport`, with a fallback for `Högalidskyrkan -> Hornstull`

## Useful flags

- `--dry-run` prints the final payload without posting
- `--main-category <label>` overrides the Visit Stockholm main category label
- `--subcategory <label>` overrides the Visit Stockholm subcategory label
- `--station <name>` overrides the closest station
- `--image-url <url>` overrides the image URL
- `--image-credit <text>` overrides the image credit
- `--chrome-path <path>` points to a specific Chrome/Edge binary

## Environment variables

- `VISIT_STOCKHOLM_SUBMITTED_BY_EMAIL`
- `VISIT_STOCKHOLM_CHROME_PATH`

## Notes

- Run `--dry-run` first if you want to inspect the generated English and Swedish descriptions before posting.
- The dry-run output includes `categoryResolution` so you can see whether categories were resolved live or via fallback.
- The script assumes the event should appear in Visit Stockholm's event calendar and is therefore most suitable for Stockholm concerts, not touring dates outside the region.
- Visit Stockholm still decides whether and how the event is published after submission.
