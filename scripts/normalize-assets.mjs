import { mkdirSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const publicDir = path.join(rootDir, 'public');
const assetsDir = path.join(publicDir, 'assets');

function isTextFile(filePath) {
  return /\.(?:html|css|json)$/i.test(filePath);
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

function walk(dirPath) {
  const entries = readdirSync(dirPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(fullPath));
    } else {
      files.push(fullPath);
    }
  }

  return files;
}

function ensureDir(dirPath) {
  mkdirSync(dirPath, { recursive: true });
}

function normalizeAssetFiles() {
  const files = walk(assetsDir).sort((a, b) => b.length - a.length);
  const replacements = [];

  for (const sourcePath of files) {
    const relPath = path.relative(publicDir, sourcePath);
    const safeRelPath = relPath
      .split(path.sep)
      .map((segment) => toSafeSegment(segment))
      .join(path.sep);

    if (safeRelPath === relPath) continue;

    const targetPath = path.join(publicDir, safeRelPath);
    ensureDir(path.dirname(targetPath));
    renameSync(sourcePath, targetPath);

    const fromUrl = '/' + relPath.split(path.sep).map(encodeURIComponent).join('/');
    const toUrl = '/' + safeRelPath.split(path.sep).map(encodeURIComponent).join('/');
    replacements.push([fromUrl, toUrl]);
  }

  return replacements;
}

function applyReplacements(replacements) {
  const files = walk(publicDir).filter(isTextFile);

  for (const filePath of files) {
    let contents = readFileSync(filePath, 'utf8');
    let changed = false;

    for (const [fromUrl, toUrl] of replacements) {
      if (!contents.includes(fromUrl)) continue;
      contents = contents.split(fromUrl).join(toUrl);
      changed = true;
    }

    contents = contents.replace(/\/assets\/[^"'()\s<]+/g, (assetUrl) => {
      const parts = assetUrl.split('/');
      const lastSegment = parts.pop();
      if (!lastSegment) return assetUrl;

      const decodedName = decodeURIComponent(lastSegment);
      const parsed = path.parse(decodedName);
      const safeName = `${toSafeSegment(parsed.name)}${parsed.ext.toLowerCase()}`;
      const nextUrl = [...parts, encodeURIComponent(safeName)].join('/');

      if (nextUrl !== assetUrl) {
        changed = true;
      }

      return nextUrl;
    });

    if (changed) {
      writeFileSync(filePath, contents);
    }
  }
}

const replacements = normalizeAssetFiles();
applyReplacements(replacements);

console.log(`Normalized ${replacements.length} asset paths.`);
