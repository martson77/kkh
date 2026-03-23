import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const outputDir = path.join(rootDir, 'public');

const pages = ['/', '/om-oss', '/dirigenten', '/konserter'];
const siteOrigin = 'https://www.kammarkorenhogalid.se';
const assetHosts = new Set([
  'cdn.prod.website-files.com',
  'd3e54v103j8qbb.cloudfront.net',
]);

const downloadedAssets = new Map();

function ensureParentDir(filePath) {
  mkdirSync(path.dirname(filePath), { recursive: true });
}

function sanitizeSearch(search) {
  return search ? `__${Buffer.from(search).toString('hex')}` : '';
}

function decodePathSegment(segment) {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

function toSafeSegment(segment) {
  return segment
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^A-Za-z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'file';
}

function toPublicAssetPath(urlString) {
  const url = new URL(urlString);
  const decodedSegments = url.pathname
    .split('/')
    .filter(Boolean)
    .map((segment) => decodePathSegment(segment));
  const baseName = decodedSegments.pop() || 'index';
  const parsed = path.parse(baseName);
  const fileName = `${toSafeSegment(parsed.name)}${sanitizeSearch(url.search)}${parsed.ext.toLowerCase()}`;
  const filePath = path.join(
    outputDir,
    'assets',
    'external',
    url.hostname,
    ...decodedSegments.map((segment) => toSafeSegment(segment)),
    fileName,
  );

  const relativeSegments = path
    .relative(outputDir, filePath)
    .split(path.sep)
    .map((segment) => encodeURIComponent(segment));

  return {
    filePath,
    publicPath: '/' + relativeSegments.join('/'),
  };
}

function pageOutputPath(route) {
  const clean = route === '/' ? '' : route.replace(/^\/+/, '').replace(/\/+$/, '');
  return path.join(outputDir, clean, 'index.html');
}

function isSkippableUrl(value) {
  return (
    !value ||
    value.startsWith('data:') ||
    value.startsWith('mailto:') ||
    value.startsWith('tel:') ||
    value.startsWith('javascript:') ||
    value.startsWith('#')
  );
}

function parseAttrValues(html) {
  const values = new Set();
  const attrRegex = /\b(?:href|src|content)=["']([^"']+)["']/gi;
  for (const match of html.matchAll(attrRegex)) {
    values.add(match[1]);
  }
  return values;
}

function parseSrcsetValues(html) {
  const values = new Set();
  const srcsetRegex = /\bsrcset=["']([^"']+)["']/gi;
  for (const match of html.matchAll(srcsetRegex)) {
    for (const part of match[1].split(',')) {
      const candidate = part.trim().split(/\s+/)[0];
      if (candidate) values.add(candidate);
    }
  }
  return values;
}

function parseLooseUrls(text) {
  const values = new Set();
  const looseUrlRegex = /https?:\/\/[^"'\s<]+/gi;
  for (const match of text.matchAll(looseUrlRegex)) {
    values.add(match[0]);
  }
  return values;
}

function parseCssUrls(css) {
  const values = new Set();
  const cssUrlRegex = /url\(([^)]+)\)/gi;
  for (const match of css.matchAll(cssUrlRegex)) {
    const raw = match[1].trim().replace(/^['"]|['"]$/g, '');
    if (raw) values.add(raw);
  }
  return values;
}

function rewriteInternalLinks(html) {
  return html
    .replace(/href="\/om-oss"/g, 'href="/om-oss/"')
    .replace(/href="\/dirigenten"/g, 'href="/dirigenten/"')
    .replace(/href="\/konserter"/g, 'href="/konserter/"')
    .replace(/href='\/om-oss'/g, "href='/om-oss/'")
    .replace(/href='\/dirigenten'/g, "href='/dirigenten/'")
    .replace(/href='\/konserter'/g, "href='/konserter/'");
}

function stripWebflowMarkers(html) {
  return html
    .replace(/<!-- This site was created in Webflow\. https:\/\/webflow\.com -->/g, '')
    .replace(/<!-- Last Published:[\s\S]*?-->/g, '')
    .replace(/<meta content="Webflow" name="generator"\/>/g, '')
    .replace(/\n{3,}/g, '\n\n');
}

function stripIntegrityAttributes(html) {
  return html
    .replace(/\s+integrity="[^"]*"/g, '')
    .replace(/\s+crossorigin="anonymous"/g, '');
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: { 'user-agent': 'kkh-static-mirror' },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }

  return response.text();
}

async function fetchBuffer(url) {
  const response = await fetch(url, {
    headers: { 'user-agent': 'kkh-static-mirror' },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

async function downloadAsset(urlString) {
  if (downloadedAssets.has(urlString)) {
    return downloadedAssets.get(urlString);
  }

  const job = (async () => {
    const { filePath, publicPath } = toPublicAssetPath(urlString);
    const buffer = await fetchBuffer(urlString);
    ensureParentDir(filePath);
    writeFileSync(filePath, buffer);

    if (/\.css$/i.test(filePath)) {
      let css = readFileSync(filePath, 'utf8');
      const replacements = new Map();

      for (const rawValue of parseCssUrls(css)) {
        if (isSkippableUrl(rawValue)) continue;

        const resolved = new URL(rawValue, urlString);
        if (!assetHosts.has(resolved.hostname)) continue;

        const localPath = await downloadAsset(resolved.href);
        replacements.set(rawValue, localPath);
      }

      for (const [from, to] of replacements) {
        css = css.split(from).join(to);
      }

      writeFileSync(filePath, css);
    }

    return publicPath;
  })();

  downloadedAssets.set(urlString, job);
  return job;
}

async function buildHtml(route) {
  const pageUrl = new URL(route, siteOrigin).href;
  let html = await fetchText(pageUrl);
  const replacements = new Map();

  for (const rawValue of parseAttrValues(html)) {
    if (isSkippableUrl(rawValue)) continue;

    let resolved;
    try {
      resolved = new URL(rawValue, pageUrl);
    } catch {
      continue;
    }

    if (!assetHosts.has(resolved.hostname)) continue;
    replacements.set(rawValue, await downloadAsset(resolved.href));
  }

  for (const rawValue of parseSrcsetValues(html)) {
    if (isSkippableUrl(rawValue)) continue;

    let resolved;
    try {
      resolved = new URL(rawValue, pageUrl);
    } catch {
      continue;
    }

    if (!assetHosts.has(resolved.hostname)) continue;
    replacements.set(rawValue, await downloadAsset(resolved.href));
  }

  for (const rawValue of parseLooseUrls(html)) {
    let resolved;
    try {
      resolved = new URL(rawValue, pageUrl);
    } catch {
      continue;
    }

    if (!assetHosts.has(resolved.hostname)) continue;
    replacements.set(rawValue, await downloadAsset(resolved.href));
  }

  for (const [from, to] of replacements) {
    html = html.split(from).join(to);
  }

  html = stripIntegrityAttributes(
    stripWebflowMarkers(rewriteInternalLinks(html)),
  ).replace(/https:\/\/kammarkorenhogalid\.se\//g, 'https://www.kammarkorenhogalid.se/');

  return html;
}

async function main() {
  rmSync(outputDir, { recursive: true, force: true });
  mkdirSync(outputDir, { recursive: true });

  for (const route of pages) {
    const html = await buildHtml(route);
    const filePath = pageOutputPath(route);
    ensureParentDir(filePath);
    writeFileSync(filePath, html);
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    pages,
    assets: [...downloadedAssets.keys()].sort(),
  };

  writeFileSync(
    path.join(outputDir, 'mirror-manifest.json'),
    JSON.stringify(manifest, null, 2) + '\n',
  );

  console.log(`Mirrored ${pages.length} pages and ${downloadedAssets.size} assets.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
