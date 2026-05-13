import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { automationSettings, site } from "./site-data.mjs";
import {
  formatDate,
  getUpcomingConcerts,
  stockholmTimeZone,
} from "./editorial-utils.mjs";

const execFileAsync = promisify(execFile);
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const publicDir = path.join(repoRoot, "public");
const postersDir = path.join(repoRoot, automationSettings.generatedDir, "posters");
const publicPosterDir = path.join(publicDir, "affischer");

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;

const palette = {
  paper: "#ffffff",
  header: "#a19abc",
  blush: "#f4e2d9",
  ink: "#1d1d1b",
  inkSoft: "#33302d",
  muted: "#6b625e",
};

async function detectFaceFocus(imagePath, tempDir) {
  const detectorScript = path.join(scriptDir, "poster-face-focus.swift");
  const moduleCacheDir = path.join(tempDir, "swift-module-cache");

  try {
    await fs.mkdir(moduleCacheDir, { recursive: true });
    const { stdout } = await execFileAsync(
      "swift",
      ["-module-cache-path", moduleCacheDir, detectorScript, imagePath],
      {
        env: {
          ...process.env,
          CLANG_MODULE_CACHE_PATH: moduleCacheDir,
        },
        timeout: 5000,
      }
    );
    const result = JSON.parse(stdout || "{}");

    if (
      typeof result.focusX === "number" &&
      typeof result.focusY === "number"
    ) {
      return result;
    }
  } catch {
    return null;
  }

  return null;
}

function resolvePosterFocus(concert, imageWidth, imageHeight, detectedFocus) {
  if (
    typeof concert.posterFocusX === "number" &&
    typeof concert.posterFocusY === "number"
  ) {
    return {
      focusX: concert.posterFocusX,
      focusY: concert.posterFocusY,
    };
  }

  if (typeof concert.posterFocusY === "number") {
    return {
      focusX: typeof concert.posterFocusX === "number" ? concert.posterFocusX : 0.5,
      focusY: concert.posterFocusY,
    };
  }

  if (detectedFocus) {
    return {
      focusX: detectedFocus.focusX,
      focusY: detectedFocus.focusY,
    };
  }

  if (imageHeight > imageWidth) {
    return { focusX: 0.5, focusY: 0.68 };
  }

  return { focusX: 0.5, focusY: 0.62 };
}

function formatNumber(value) {
  return Number(value).toFixed(2).replace(/\.00$/, "");
}

function hexToRgb(hex) {
  const normalized = hex.replace("#", "");
  const red = Number.parseInt(normalized.slice(0, 2), 16) / 255;
  const green = Number.parseInt(normalized.slice(2, 4), 16) / 255;
  const blue = Number.parseInt(normalized.slice(4, 6), 16) / 255;

  return `${red.toFixed(3)} ${green.toFixed(3)} ${blue.toFixed(3)}`;
}

function sanitizePdfText(value) {
  return String(value)
    .replaceAll("•", "-")
    .replaceAll("—", "-")
    .replaceAll("–", "-")
    .replaceAll("’", "'")
    .replaceAll("“", '"')
    .replaceAll("”", '"');
}

function escapePdfText(value) {
  return sanitizePdfText(value)
    .replaceAll("\\", "\\\\")
    .replaceAll("(", "\\(")
    .replaceAll(")", "\\)");
}

function capitalize(value) {
  if (!value) {
    return value;
  }

  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatPosterTime(value) {
  return new Intl.DateTimeFormat("sv-SE", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: stockholmTimeZone,
  })
    .format(new Date(value))
    .replace(":", ".");
}

function formatPosterDateLine(concert) {
  const dateLabel = capitalize(
    new Intl.DateTimeFormat("sv-SE", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: stockholmTimeZone,
    }).format(new Date(concert.start))
  );

  const startTime = formatPosterTime(concert.start);
  const endTime = concert.end ? `-${formatPosterTime(concert.end)}` : "";

  return `${dateLabel} kl ${startTime}${endTime}`;
}

function formatPosterMetaLine(concert) {
  const date = new Intl.DateTimeFormat("sv-SE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: stockholmTimeZone,
  }).format(new Date(concert.start));
  const startTime = formatPosterTime(concert.start).replace(".", ".");
  return `${concert.venue} ${date} kl ${startTime}`.toUpperCase();
}

function measureText(text, fontSize, variant = "body") {
  const factorMap = {
    label: 0.46,
    body: 0.52,
    bold: 0.55,
    title: 0.56,
    serif: 0.54,
  };

  const factor = factorMap[variant] || factorMap.body;
  return sanitizePdfText(text).length * fontSize * factor;
}

function wrapText(text, maxWidth, fontSize, variant = "body") {
  const normalized = sanitizePdfText(text).replace(/\s+/g, " ").trim();

  if (!normalized) {
    return [];
  }

  const words = normalized.split(" ");
  const lines = [];
  let current = words.shift() || "";

  for (const word of words) {
    const candidate = `${current} ${word}`;
    if (measureText(candidate, fontSize, variant) <= maxWidth) {
      current = candidate;
      continue;
    }

    lines.push(current);
    current = word;
  }

  if (current) {
    lines.push(current);
  }

  return lines;
}

function truncateLines(lines, maxLines) {
  if (lines.length <= maxLines) {
    return lines;
  }

  const kept = lines.slice(0, maxLines);
  kept[maxLines - 1] = `${kept[maxLines - 1].replace(/[.,;:!?-]\s*$/, "")}...`;
  return kept;
}

function resolveLocalAssetPath(assetPath) {
  if (!assetPath || /^https?:\/\//.test(assetPath)) {
    return null;
  }

  return path.join(publicDir, assetPath.replace(/^\//, ""));
}

async function ensurePostersDir() {
  await fs.mkdir(postersDir, { recursive: true });
  await fs.mkdir(publicPosterDir, { recursive: true });
}

async function cleanupLegacyPosterFiles() {
  const entries = await fs.readdir(postersDir, { withFileTypes: true });

  await Promise.all(
    entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".html"))
      .map((entry) => fs.unlink(path.join(postersDir, entry.name)))
  );
}

async function prepareRasterImage(concert) {
  const candidates = [
    concert.posterImage,
    concert.heroImage,
    concert.socialImage,
    concert.image,
    site.choirImageSocial,
    site.choirPerformanceImage,
    site.choirImage,
  ]
    .map(resolveLocalAssetPath)
    .filter(Boolean);

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "kkh-poster-"));

  for (const candidate of candidates) {
    try {
      if (candidate.toLowerCase().endsWith(".avif")) {
        continue;
      }

      await fs.access(candidate);
      const outputPath = path.join(tempDir, `${concert.slug || "poster"}.jpg`);
      const detectedFocus = await detectFaceFocus(candidate, tempDir);
      await execFileAsync("sips", ["-s", "format", "jpeg", candidate, "--out", outputPath]);
      const imageBuffer = await fs.readFile(outputPath);
      const { width, height } = await readImageSize(outputPath);
      const focus = resolvePosterFocus(concert, width, height, detectedFocus);

      return { imageBuffer, width, height, tempDir, focus, colorSpace: "DeviceRGB" };
    } catch {
      continue;
    }
  }

  return {
    imageBuffer: null,
    width: 0,
    height: 0,
    tempDir,
    focus: { focusX: 0.5, focusY: 0.62 },
    colorSpace: "DeviceRGB",
  };
}

async function readImageSize(filePath) {
  const { stdout } = await execFileAsync("sips", ["-g", "pixelWidth", "-g", "pixelHeight", filePath]);
  const widthMatch = stdout.match(/pixelWidth:\s+(\d+)/);
  const heightMatch = stdout.match(/pixelHeight:\s+(\d+)/);

  if (!widthMatch || !heightMatch) {
    throw new Error(`Kunde inte läsa bildstorlek för ${filePath}`);
  }

  return {
    width: Number.parseInt(widthMatch[1], 10),
    height: Number.parseInt(heightMatch[1], 10),
  };
}

function addObject(objects, content) {
  objects.push(content);
  return objects.length;
}

function buildStream(commands) {
  return Buffer.from(commands.join("\n"), "latin1");
}

function buildTextBlock({ x, y, font, size, leading, color, lines }) {
  if (!lines.length) {
    return [];
  }

  const commands = [
    "BT",
    `${hexToRgb(color)} rg`,
    `/${font} ${formatNumber(size)} Tf`,
    `${formatNumber(leading)} TL`,
    `1 0 0 1 ${formatNumber(x)} ${formatNumber(y)} Tm`,
  ];

  lines.forEach((line, index) => {
    if (index === 0) {
      commands.push(`(${escapePdfText(line)}) Tj`);
    } else {
      commands.push(`T* (${escapePdfText(line)}) Tj`);
    }
  });

  commands.push("ET");
  return commands;
}

function drawRect({ x, y, width, height, fill, stroke = null, lineWidth = 1 }) {
  const commands = ["q"];

  if (fill) {
    commands.push(`${hexToRgb(fill)} rg`);
  }

  if (stroke) {
    commands.push(`${hexToRgb(stroke)} RG`);
    commands.push(`${formatNumber(lineWidth)} w`);
  }

  commands.push(`${formatNumber(x)} ${formatNumber(y)} ${formatNumber(width)} ${formatNumber(height)} re`);

  if (fill && stroke) {
    commands.push("B");
  } else if (fill) {
    commands.push("f");
  } else if (stroke) {
    commands.push("S");
  }

  commands.push("Q");
  return commands;
}

function drawImageCover({
  x,
  y,
  width,
  height,
  imageWidth,
  imageHeight,
  focusX = 0.5,
  focusY = 0.62,
}) {
  const scale = Math.max(width / imageWidth, height / imageHeight);
  const drawWidth = imageWidth * scale;
  const drawHeight = imageHeight * scale;
  const overflowX = Math.max(0, drawWidth - width);
  const overflowY = Math.max(0, drawHeight - height);
  const clampedFocusX = Math.min(Math.max(focusX, 0), 1);
  const clampedFocusY = Math.min(Math.max(focusY, 0), 1);
  const unclampedX = x + width / 2 - drawWidth * clampedFocusX;
  const unclampedY = y + height / 2 - drawHeight * clampedFocusY;
  const drawX = Math.min(x, Math.max(x - overflowX, unclampedX));
  const drawY = Math.min(y, Math.max(y - overflowY, unclampedY));

  return [
    "q",
    `${formatNumber(x)} ${formatNumber(y)} ${formatNumber(width)} ${formatNumber(height)} re`,
    "W",
    "n",
    `${formatNumber(drawWidth)} 0 0 ${formatNumber(drawHeight)} ${formatNumber(drawX)} ${formatNumber(
      drawY
    )} cm`,
    "/Im1 Do",
    "Q",
  ];
}

function renderPosterCommands(concert, hasImage, imageWidth = 0, imageHeight = 0, focus = { focusX: 0.5, focusY: 0.62 }) {
  const commands = [];

  const margin = 22;
  const contentWidth = PAGE_WIDTH - margin * 2;
  const headerY = 682;
  const headerHeight = 142;
  const heroY = 354;
  const heroHeight = 328;
  const infoY = 22;
  const infoHeight = 332;

  commands.push(...drawRect({ x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT, fill: palette.paper }));
  commands.push(...drawRect({ x: margin, y: headerY, width: contentWidth, height: headerHeight, fill: palette.header }));

  commands.push(...buildTextBlock({
    x: margin + 26,
    y: headerY + 84,
    font: "F1",
    size: 50,
    leading: 52,
    color: "#ffffff",
    lines: [concert.posterSeriesTitle || "Musik i"],
  }));
  commands.push(...buildTextBlock({
    x: margin + 28,
    y: headerY + 50,
    font: "F4",
    size: 31,
    leading: 33,
    color: "#ffffff",
    lines: [concert.posterSeriesSubtitle || "Högalids församling!"],
  }));

  if (hasImage) {
    commands.push(
      ...drawImageCover({
        x: margin,
        y: heroY,
        width: contentWidth,
        height: heroHeight,
        imageWidth,
        imageHeight,
        focusX: focus.focusX,
        focusY: focus.focusY,
      })
    );
  } else {
    commands.push(...drawRect({ x: margin, y: heroY, width: contentWidth, height: heroHeight, fill: palette.header }));
  }

  commands.push(...drawRect({ x: margin, y: infoY, width: contentWidth, height: infoHeight, fill: palette.blush }));

  const textX = margin + 32;
  const textWidth = contentWidth - 64;
  const metaLine = formatPosterMetaLine(concert);
  commands.push(...buildTextBlock({
    x: textX,
    y: infoY + infoHeight - 28,
    font: "F1",
    size: 17,
    leading: 20,
    color: palette.ink,
    lines: truncateLines(wrapText(metaLine, textWidth, 17, "body"), 2),
  }));

  const title = concert.posterTitle || concert.title;
  const titleLines = truncateLines(wrapText(title, textWidth, 43, "bold"), 3);
  const titleLeading = 47;
  const titleTopY = infoY + infoHeight - 66;
  commands.push(...buildTextBlock({
    x: textX,
    y: titleTopY,
    font: "F2",
    size: 43,
    leading: titleLeading,
    color: palette.ink,
    lines: titleLines,
  }));

  let currentY = titleTopY - titleLines.length * titleLeading - 12;
  const programSentence = concert.posterProgramText ||
    [concert.program?.join(". "), concert.performers?.join("; ")]
      .filter(Boolean)
      .join(". ");
  const detailsLines = truncateLines(wrapText(programSentence, textWidth, 18, "body"), 4);
  commands.push(...buildTextBlock({
    x: textX,
    y: currentY,
    font: "F1",
    size: 18,
    leading: 24,
    color: palette.ink,
    lines: detailsLines,
  }));

  currentY -= detailsLines.length * 24 + 8;
  const accessLine = concert.posterAccessText ||
    (concert.price ? `${concert.price}, bidra gärna med en gåva till musik i Högalid` : "");

  if (accessLine) {
    commands.push(...buildTextBlock({
      x: textX,
      y: Math.max(currentY, infoY + 84),
      font: "F5",
      size: 16,
      leading: 19,
      color: palette.ink,
      lines: truncateLines(wrapText(accessLine, textWidth, 16, "body"), 2),
    }));
  }

  const footerY = infoY + 18;
  commands.push(...buildTextBlock({
    x: textX,
    y: footerY + 26,
    font: "F2",
    size: 21,
    leading: 18,
    color: palette.ink,
    lines: ["Svenska", "kyrkan"],
  }));
  const footerUrl = concert.posterFooterUrl || "svenskakyrkan.se/hogalid";
  commands.push(...buildTextBlock({
    x: margin + contentWidth - 162,
    y: footerY + 7,
    font: "F2",
    size: 11,
    leading: 12,
    color: palette.ink,
    lines: [footerUrl],
  }));

  if (concert.imageCredit) {
    commands.push(...buildTextBlock({
      x: margin + 6,
      y: 8,
      font: "F1",
      size: 5.8,
      leading: 7,
      color: palette.muted,
      lines: truncateLines(wrapText(`Bild: ${concert.imageCredit}`, 300, 5.8, "body"), 1),
    }));
  }

  return commands;
}

function buildPdf({ concert, imageBuffer, imageWidth, imageHeight, focus, colorSpace }) {
  const objects = [];
  const catalogId = addObject(objects, null);
  const pagesId = addObject(objects, null);
  const pageId = addObject(objects, null);
  const contentId = addObject(objects, null);
  const fontRegularId = addObject(
    objects,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"
  );
  const fontBoldId = addObject(
    objects,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>"
  );
  const fontSerifId = addObject(
    objects,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Times-Bold /Encoding /WinAnsiEncoding >>"
  );
  const fontSerifItalicId = addObject(
    objects,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Times-Italic /Encoding /WinAnsiEncoding >>"
  );
  const fontItalicId = addObject(
    objects,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique /Encoding /WinAnsiEncoding >>"
  );
  const imageId = imageBuffer
    ? addObject(
        objects,
        Buffer.concat([
          Buffer.from(
            `<< /Type /XObject /Subtype /Image /Width ${imageWidth} /Height ${imageHeight} /ColorSpace /${colorSpace} /BitsPerComponent 8 /Filter /DCTDecode /Length ${imageBuffer.length} >>\nstream\n`,
            "latin1"
          ),
          imageBuffer,
          Buffer.from("\nendstream", "latin1"),
        ])
      )
    : null;

  const resources = [
    `/Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R /F3 ${fontSerifId} 0 R /F4 ${fontSerifItalicId} 0 R /F5 ${fontItalicId} 0 R >>`,
  ];

  if (imageId) {
    resources.push(`/XObject << /Im1 ${imageId} 0 R >>`);
  }

  objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageId} 0 R] /Count 1 >>`;
  objects[pageId - 1] = `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${formatNumber(
    PAGE_WIDTH
  )} ${formatNumber(PAGE_HEIGHT)}] /Resources << ${resources.join(" ")} >> /Contents ${contentId} 0 R >>`;

  const contentStream = buildStream(
    renderPosterCommands(concert, Boolean(imageId), imageWidth, imageHeight, focus)
  );
  objects[contentId - 1] = Buffer.concat([
    Buffer.from(`<< /Length ${contentStream.length} >>\nstream\n`, "latin1"),
    contentStream,
    Buffer.from("\nendstream", "latin1"),
  ]);

  const header = Buffer.from("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n", "binary");
  const chunks = [header];
  const offsets = [0];
  let currentOffset = header.length;

  objects.forEach((objectContent, index) => {
    offsets.push(currentOffset);
    const objectHeader = Buffer.from(`${index + 1} 0 obj\n`, "latin1");
    const objectBody = Buffer.isBuffer(objectContent)
      ? objectContent
      : Buffer.from(objectContent, "latin1");
    const objectFooter = Buffer.from("\nendobj\n", "latin1");

    chunks.push(objectHeader, objectBody, objectFooter);
    currentOffset += objectHeader.length + objectBody.length + objectFooter.length;
  });

  const xrefStart = currentOffset;
  const xrefLines = [`xref`, `0 ${objects.length + 1}`, `0000000000 65535 f `];
  for (let index = 1; index < offsets.length; index += 1) {
    xrefLines.push(`${String(offsets[index]).padStart(10, "0")} 00000 n `);
  }

  const trailer = `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
  chunks.push(Buffer.from(`${xrefLines.join("\n")}\n${trailer}`, "latin1"));

  return Buffer.concat(chunks);
}

async function generatePoster(concert) {
  if (concert.posterPdfSource) {
    const sourcePdfPath = resolveLocalAssetPath(concert.posterPdfSource);

    if (!sourcePdfPath) {
      throw new Error(`Ogiltig källaffisch för ${concert.slug}: ${concert.posterPdfSource}`);
    }

    const generatedPdfPath = path.join(postersDir, `${concert.slug}.pdf`);
    const publicPdfPath = path.join(publicPosterDir, `${concert.slug}.pdf`);
    await fs.copyFile(sourcePdfPath, generatedPdfPath);
    await fs.copyFile(sourcePdfPath, publicPdfPath);
    await fs.rm(path.join(postersDir, `${concert.slug}.html`), { force: true });
    return { generatedPdfPath, publicPdfPath };
  }

  const { imageBuffer, width, height, tempDir, focus, colorSpace } = await prepareRasterImage(concert);

  try {
    const pdfBuffer = buildPdf({
      concert,
      imageBuffer,
      imageWidth: width,
      imageHeight: height,
      focus,
      colorSpace,
    });

    const generatedPdfPath = path.join(postersDir, `${concert.slug}.pdf`);
    const publicPdfPath = path.join(publicPosterDir, `${concert.slug}.pdf`);

    await fs.writeFile(generatedPdfPath, pdfBuffer);
    await fs.writeFile(publicPdfPath, pdfBuffer);
    await fs.rm(path.join(postersDir, `${concert.slug}.html`), { force: true });
    return { generatedPdfPath, publicPdfPath };
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

const upcomingConcerts = getUpcomingConcerts();

if (!upcomingConcerts.length) {
  console.log("Inga kommande konserter hittades. Ingen affisch skapad.");
  process.exit(0);
}

await ensurePostersDir();
await cleanupLegacyPosterFiles();

const generatedPaths = [];

for (const concert of upcomingConcerts) {
  if (!concert.slug) {
    continue;
  }

  const pdfPaths = await generatePoster(concert);
  generatedPaths.push(pdfPaths);
}

console.log("Genererade affischer:");
for (const paths of generatedPaths) {
  console.log(`- ${paths.generatedPdfPath}`);
  console.log(`- ${paths.publicPdfPath}`);
}
