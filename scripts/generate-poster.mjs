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
const grayProfilePath = "/System/Library/ColorSync/Profiles/Generic Gray Gamma 2.2 Profile.icc";

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;

const palette = {
  paper: "#f6f6f3",
  panel: "#ffffff",
  line: "#a7a7a2",
  accent: "#232323",
  accentSoft: "#e2e2dc",
  accentWarm: "#d0d0c8",
  ink: "#111111",
  inkSoft: "#4d4d49",
  success: "#303030",
  successSoft: "#dfdfda",
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
      const pngPath = path.join(tempDir, `${concert.slug || "poster"}.png`);
      const grayPath = path.join(tempDir, `${concert.slug || "poster"}-gray.jpg`);
      const outputPath = path.join(tempDir, `${concert.slug || "poster"}.jpg`);
      const detectedFocus = await detectFaceFocus(candidate, tempDir);
      await execFileAsync("sips", ["-s", "format", "png", candidate, "--out", pngPath]);
      await execFileAsync("sips", ["-m", grayProfilePath, pngPath, "--out", grayPath]);
      await execFileAsync("sips", ["-s", "format", "jpeg", grayPath, "--out", outputPath]);
      const imageBuffer = await fs.readFile(outputPath);
      const { width, height } = await readImageSize(outputPath);
      const focus = resolvePosterFocus(concert, width, height, detectedFocus);

      return { imageBuffer, width, height, tempDir, focus, colorSpace: "DeviceGray" };
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
    colorSpace: "DeviceGray",
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

function sectionHeight(lineCount) {
  return 34 + lineCount * 14;
}

function wrapBulletItems(items, maxWidth, fontSize, variant = "body") {
  return items.flatMap((item) => {
    const wrapped = wrapText(item, maxWidth - 14, fontSize, variant);

    if (!wrapped.length) {
      return [];
    }

    return wrapped.map((line, index) => `${index === 0 ? "- " : "  "}${line}`);
  });
}

function renderPosterCommands(concert, hasImage, imageWidth = 0, imageHeight = 0, focus = { focusX: 0.5, focusY: 0.62 }) {
  const commands = [];

  commands.push(...drawRect({ x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT, fill: palette.paper }));
  commands.push(...drawRect({ x: -60, y: PAGE_HEIGHT - 130, width: 180, height: 180, fill: palette.accentSoft }));
  commands.push(...drawRect({ x: PAGE_WIDTH - 120, y: -40, width: 190, height: 190, fill: palette.accentWarm }));

  const heroX = 0;
  const heroY = 430;
  const heroWidth = PAGE_WIDTH;
  const heroHeight = 300;

  if (hasImage) {
    commands.push(
      ...drawImageCover({
        x: heroX,
        y: heroY,
        width: heroWidth,
        height: heroHeight,
        imageWidth,
        imageHeight,
        focusX: focus.focusX,
        focusY: focus.focusY,
      })
    );
  } else {
    commands.push(...drawRect({ x: heroX, y: heroY, width: heroWidth, height: heroHeight, fill: palette.accentSoft }));
  }

  commands.push(...drawRect({ x: 42, y: 778, width: 230, height: 46, fill: "#fffdf9", stroke: palette.line }));
  commands.push(...buildTextBlock({
    x: 58,
    y: 806,
    font: "F2",
    size: 8.5,
    leading: 10,
    color: palette.accent,
    lines: ["KOMMANDE KONSERT"],
  }));
  commands.push(...buildTextBlock({
    x: 58,
    y: 786,
    font: "F2",
    size: 15,
    leading: 16,
    color: palette.ink,
    lines: [site.name],
  }));

  const cardX = 38;
  const cardY = 82;
  const cardWidth = 519;
  const cardHeight = 454;

  commands.push(...drawRect({ x: cardX, y: cardY, width: cardWidth, height: cardHeight, fill: palette.panel, stroke: palette.line }));

  const leftX = 58;
  const leftWidth = 276;
  const rightX = 356;
  const rightWidth = 178;
  const cardTop = cardY + cardHeight;

  commands.push(...buildTextBlock({
    x: leftX,
    y: cardTop - 38,
    font: "F2",
    size: 10,
    leading: 12,
    color: palette.accent,
    lines: ["SPARA DATUMET"],
  }));

  const titleLines = truncateLines(wrapText(concert.title, leftWidth, 31, "serif"), 3);
  const titleLeading = 31;
  const titleTopY = cardTop - 72;
  commands.push(...buildTextBlock({
    x: leftX,
    y: titleTopY,
    font: "F3",
    size: 31,
    leading: titleLeading,
    color: palette.ink,
    lines: titleLines,
  }));

  let currentY = titleTopY - titleLines.length * titleLeading - 8;

  if (concert.teaser) {
    const teaserLines = truncateLines(wrapText(concert.teaser, leftWidth, 16, "bold"), 2);
    commands.push(...buildTextBlock({
      x: leftX,
      y: currentY,
      font: "F2",
      size: 16,
      leading: 18,
      color: palette.ink,
      lines: teaserLines,
    }));
    currentY -= teaserLines.length * 18 + 10;
  }

  const summaryLines = truncateLines(wrapText(concert.summary, leftWidth, 12, "body"), 6);
  commands.push(...buildTextBlock({
    x: leftX,
    y: currentY,
    font: "F1",
    size: 12,
    leading: 15,
    color: palette.inkSoft,
    lines: summaryLines,
  }));

  const infoBoxWidth = leftWidth;
  const infoBoxHeight = 68;
  const summaryBottomY = currentY - summaryLines.length * 15 + 4;
  const infoStartY = Math.max(126, Math.min(178, Math.round(summaryBottomY - 176)));

  commands.push(...drawRect({
    x: leftX,
    y: infoStartY + 72,
    width: infoBoxWidth,
    height: infoBoxHeight,
    fill: "#fffdf9",
    stroke: palette.line,
  }));
  commands.push(...buildTextBlock({
    x: leftX + 14,
    y: infoStartY + 124,
    font: "F2",
    size: 8.5,
    leading: 10,
    color: palette.accent,
    lines: ["NÄR"],
  }));
  commands.push(...buildTextBlock({
    x: leftX + 14,
    y: infoStartY + 98,
    font: "F2",
    size: 14,
    leading: 16,
    color: palette.ink,
    lines: truncateLines(wrapText(formatPosterDateLine(concert), infoBoxWidth - 28, 14, "bold"), 2),
  }));

  commands.push(...drawRect({
    x: leftX,
    y: infoStartY,
    width: infoBoxWidth,
    height: infoBoxHeight + 8,
    fill: "#fffdf9",
    stroke: palette.line,
  }));
  commands.push(...buildTextBlock({
    x: leftX + 14,
    y: infoStartY + 60,
    font: "F2",
    size: 8.5,
    leading: 10,
    color: palette.accent,
    lines: ["VAR"],
  }));
  commands.push(...buildTextBlock({
    x: leftX + 14,
    y: infoStartY + 34,
    font: "F2",
    size: 13.5,
    leading: 15,
    color: palette.ink,
    lines: truncateLines(
      wrapText(
        concert.address ? `${concert.venue} · ${concert.address}` : concert.venue,
        infoBoxWidth - 28,
        13.5,
        "bold"
      ),
      3
    ),
  }));

  let rightCursorY = cardTop - 42;

  if (concert.ticketUrl) {
    commands.push(...drawRect({
      x: rightX,
      y: cardTop - 74,
      width: rightWidth,
      height: 34,
      fill: palette.successSoft,
      stroke: null,
    }));
    commands.push(...buildTextBlock({
      x: rightX + 12,
      y: cardTop - 53,
      font: "F2",
      size: 10.5,
      leading: 12,
      color: palette.success,
      lines: ["Biljetter finns nu"],
    }));

    rightCursorY = cardTop - 122;
  }

  if (concert.program?.length) {
    const programLines = truncateLines(
      wrapBulletItems(concert.program, rightWidth - 24, 9.2, "body"),
      7
    );
    const boxHeight = sectionHeight(programLines.length);
    commands.push(...drawRect({
      x: rightX,
      y: rightCursorY - boxHeight,
      width: rightWidth,
      height: boxHeight,
      fill: "#fffdf9",
      stroke: palette.line,
    }));
    commands.push(...buildTextBlock({
      x: rightX + 12,
      y: rightCursorY - 20,
      font: "F2",
      size: 8.5,
      leading: 10,
      color: palette.accent,
      lines: ["PROGRAM"],
    }));
    commands.push(...buildTextBlock({
      x: rightX + 12,
      y: rightCursorY - 40,
      font: "F1",
      size: 9.2,
      leading: 12.2,
      color: palette.ink,
      lines: programLines,
    }));
    rightCursorY -= boxHeight + 14;
  }

  if (concert.performers?.length) {
    const performerLines = truncateLines(
      wrapBulletItems(concert.performers.slice(0, 6), rightWidth - 24, 9.2, "body"),
      12
    );
    const boxHeight = sectionHeight(performerLines.length);
    commands.push(...drawRect({
      x: rightX,
      y: rightCursorY - boxHeight,
      width: rightWidth,
      height: boxHeight,
      fill: "#fffdf9",
      stroke: palette.line,
    }));
    commands.push(...buildTextBlock({
      x: rightX + 12,
      y: rightCursorY - 20,
      font: "F2",
      size: 8.5,
      leading: 10,
      color: palette.accent,
      lines: ["MEDVERKANDE"],
    }));
    commands.push(...buildTextBlock({
      x: rightX + 12,
      y: rightCursorY - 40,
      font: "F1",
      size: 9.2,
      leading: 12.2,
      color: palette.ink,
      lines: performerLines,
    }));
    rightCursorY -= boxHeight + 14;
  }

  commands.push(...drawRect({
    x: rightX,
    y: 128,
    width: rightWidth,
    height: 104,
    fill: palette.accent,
    stroke: null,
  }));
  commands.push(...buildTextBlock({
    x: rightX + 12,
    y: 212,
    font: "F2",
    size: 8.5,
    leading: 10,
    color: "#f8e8db",
    lines: ["MER INFORMATION"],
  }));
  commands.push(...buildTextBlock({
    x: rightX + 12,
    y: 200,
    font: "F2",
    size: 11.5,
    leading: 14,
    color: "#ffffff",
    lines: truncateLines(
      wrapText("Läs mer och spara i kalendern på vår webbplats.", rightWidth - 24, 11.5, "bold"),
      4
    ),
  }));
  commands.push(...buildTextBlock({
    x: rightX + 12,
    y: 142,
    font: "F2",
    size: 10,
    leading: 12,
    color: "#fff5eb",
    lines: ["www.kammarkorenhogalid.se"],
  }));

  const footerInfoY = concert.imageCredit ? 56 : 42;

  commands.push(...buildTextBlock({
    x: 40,
    y: footerInfoY,
    font: "F1",
    size: 9.5,
    leading: 12,
    color: palette.inkSoft,
    lines: [`${site.name} · ${formatDate(concert.start)} · ${concert.venue}`],
  }));

  if (concert.imageCredit) {
    commands.push(...buildTextBlock({
      x: 40,
      y: 32,
      font: "F1",
      size: 7.2,
      leading: 9,
      color: palette.inkSoft,
      lines: truncateLines(
        wrapText(`Bild: ${concert.imageCredit}`, 320, 7.2, "body"),
        2
      ),
    }));
  }

  commands.push(...buildTextBlock({
    x: 384,
    y: 42,
    font: "F2",
    size: 10,
    leading: 12,
    color: palette.accent,
    lines: ["www.kammarkorenhogalid.se"],
  }));

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
    `/Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R /F3 ${fontSerifId} 0 R >>`,
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
