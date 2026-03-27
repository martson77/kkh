import fs from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

import { absoluteUrl, concertDetailsUrl, stockholmTimeZone } from "./editorial-utils.mjs";
import { concerts, site } from "./site-data.mjs";

const VISIT_STOCKHOLM_URL = "https://www.visitstockholm.se/event/tipsa-om-evenemang/";
const VISIT_STOCKHOLM_SUBMIT_PATH = "/api/v1/eventsubmission/";
const DEFAULT_MAIN_CATEGORY_LABEL = "Musik";
const DEFAULT_SUBCATEGORY_LABEL = "Klassiskt & Konstmusik";
const KNOWN_CLOSEST_STATIONS = new Map([["hogalidskyrkan", "Hornstull"]]);
const KNOWN_CATEGORY_FALLBACKS = [
  {
    id: "9",
    labels: ["Musik", "Music"],
    subcategories: [
      {
        id: "26",
        labels: [
          "Klassiskt & Konstmusik",
          "Klassiskt och konstmusik",
          "Classical & Art Music",
          "Classical and Art Music",
          "Classical Music & Opera",
          "Classical Music",
          "Classical",
        ],
      },
    ],
  },
];
const CHROME_PATH_CANDIDATES = [
  process.env.VISIT_STOCKHOLM_CHROME_PATH,
  process.env.CHROME_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
];

function printUsage() {
  console.log(`Usage:
  npm run visit-stockholm -- <concert-slug> --email <address> [options]

Examples:
  npm run visit-stockholm -- palmeri-misa-tango --email lindvall.martin@gmail.com --dry-run
  npm run visit-stockholm -- palmeri-misa-tango --email lindvall.martin@gmail.com

Options:
  --email <address>          Submitted-by email for Visit Stockholm
  --dry-run                  Build payload and verify page metadata without posting
  --main-category <label>    Defaults to "${DEFAULT_MAIN_CATEGORY_LABEL}"
  --subcategory <label>      Defaults to "${DEFAULT_SUBCATEGORY_LABEL}"
  --station <name>           Override closest station
  --image-url <url>          Override image URL
  --image-credit <text>      Override image credit
  --chrome-path <path>       Override Chrome/Edge binary path
  --help                     Show this help

Environment:
  VISIT_STOCKHOLM_SUBMITTED_BY_EMAIL
  VISIT_STOCKHOLM_CHROME_PATH
`);
}

function parseArgs(argv) {
  const options = {
    slug: null,
    email: process.env.VISIT_STOCKHOLM_SUBMITTED_BY_EMAIL ?? "",
    dryRun: false,
    mainCategoryLabel: DEFAULT_MAIN_CATEGORY_LABEL,
    subcategoryLabel: DEFAULT_SUBCATEGORY_LABEL,
    station: "",
    imageUrl: "",
    imageCredit: "",
    chromePath: process.env.VISIT_STOCKHOLM_CHROME_PATH ?? "",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (!arg.startsWith("--")) {
      if (options.slug) {
        throw new Error(`Unexpected extra argument: ${arg}`);
      }

      options.slug = arg;
      continue;
    }

    if (arg === "--help") {
      printUsage();
      process.exit(0);
    }

    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }

    const next = argv[index + 1];

    if (!next) {
      throw new Error(`Missing value for ${arg}`);
    }

    if (arg === "--email") {
      options.email = next;
      index += 1;
      continue;
    }

    if (arg === "--main-category") {
      options.mainCategoryLabel = next;
      index += 1;
      continue;
    }

    if (arg === "--subcategory") {
      options.subcategoryLabel = next;
      index += 1;
      continue;
    }

    if (arg === "--station") {
      options.station = next;
      index += 1;
      continue;
    }

    if (arg === "--image-url") {
      options.imageUrl = next;
      index += 1;
      continue;
    }

    if (arg === "--image-credit") {
      options.imageCredit = next;
      index += 1;
      continue;
    }

    if (arg === "--chrome-path") {
      options.chromePath = next;
      index += 1;
      continue;
    }

    throw new Error(`Unknown option: ${arg}`);
  }

  if (!options.slug) {
    throw new Error(
      `Missing concert slug. Available slugs: ${concerts.map((concert) => concert.slug).join(", ")}`,
    );
  }

  if (!options.email) {
    throw new Error("Missing submitted-by email. Pass --email or set VISIT_STOCKHOLM_SUBMITTED_BY_EMAIL.");
  }

  return options;
}

function getConcertBySlug(slug) {
  const concert = concerts.find((entry) => entry.slug === slug);

  if (!concert) {
    throw new Error(`No concert found for slug "${slug}".`);
  }

  return concert;
}

function normalizeWhitespace(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function trimToLength(value, maxLength) {
  const text = normalizeWhitespace(value);

  if (text.length <= maxLength) {
    return text;
  }

  const shortened = text.slice(0, maxLength).replace(/\s+\S*$/, "").trim();
  return shortened.endsWith(".") ? shortened : `${shortened}.`;
}

function ensureDescriptionLength(value, fallbackSentence) {
  let text = normalizeWhitespace(value);

  if (text.length < 100 && fallbackSentence) {
    text = normalizeWhitespace(`${text} ${fallbackSentence}`);
  }

  text = trimToLength(text, 500);

  if (text.length < 100) {
    throw new Error(
      `Generated description is too short (${text.length} chars). Add richer source copy in scripts/site-data.mjs.`,
    );
  }

  return text;
}

function formatEnglishDateTime(value) {
  const date = new Date(value);
  const datePart = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: stockholmTimeZone,
  }).format(date);
  const timePart = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: stockholmTimeZone,
  }).format(date);

  return `${datePart} at ${timePart}`;
}

function listToEnglishSentence(items) {
  const values = items.filter(Boolean).map((item) => normalizeWhitespace(item));

  if (values.length === 0) {
    return "";
  }

  if (values.length === 1) {
    return values[0];
  }

  if (values.length === 2) {
    return `${values[0]} and ${values[1]}`;
  }

  return `${values.slice(0, -1).join(", ")}, and ${values[values.length - 1]}`;
}

function buildSwedishDescription(concert) {
  const source = concert.description?.length
    ? concert.description.join(" ")
    : [concert.summary, concert.teaser, concert.program?.length ? `Program: ${concert.program.join(", ")}.` : ""]
        .filter(Boolean)
        .join(" ");

  return ensureDescriptionLength(
    source,
    "Konserten ges av Kammarkören Högalid i Stockholm och vänder sig till publik som vill uppleva körmusik på hög nivå.",
  );
}

function buildEnglishDescription(concert, city) {
  const programLine = concert.program?.length ? `Program: ${concert.program.join(", ")}.` : "";
  const performersLine = concert.performers?.length
    ? `Performers: ${listToEnglishSentence(concert.performers.slice(0, 4))}.`
    : "Presented by Kammarkören Högalid.";
  const base = [
    `${concert.title} at ${concert.venue} in ${city} on ${formatEnglishDateTime(concert.start)}.`,
    programLine,
    performersLine,
    "Presented by Kammarkören Högalid for listeners interested in classical choral music in Stockholm.",
  ]
    .filter(Boolean)
    .join(" ");

  return ensureDescriptionLength(
    base,
    "The concert brings together choir, instrumental forces, and a focused classical programme.",
  );
}

function parseAddress(address) {
  const normalized = normalizeWhitespace(address);
  const match = normalized.match(/^(.*?),\s*(\d{3}\s?\d{2})\s+([^,]+)$/);

  if (!match) {
    return {
      addressLine: normalized,
      zipCode: "",
      city: "",
    };
  }

  return {
    addressLine: normalizeWhitespace(match[1]),
    zipCode: match[2].replace(/\s+/g, " ").trim(),
    city: normalizeWhitespace(match[3]),
  };
}

function normalizeLabel(value) {
  return normalizeWhitespace(value)
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/&/g, " och ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function extractClosestStation(transport) {
  const normalized = normalizeWhitespace(transport);
  const tunnelbanaMatch = normalized.match(/Tunnelbana till ([^,.]+)/i);

  if (tunnelbanaMatch) {
    return normalizeWhitespace(tunnelbanaMatch[1]);
  }

  const stationMatch = normalized.match(/(?:station|hallplats)\s+([^,.]+)/i);
  return stationMatch ? normalizeWhitespace(stationMatch[1]) : "";
}

function resolveVenueData(concert, venueOptions, explicitStation) {
  const parsedAddress = parseAddress(concert.address);
  const matchingVenue = venueOptions.find(
    (venueOption) => normalizeLabel(venueOption.label) === normalizeLabel(concert.venue),
  );
  const closestStation =
    explicitStation ||
    matchingVenue?.closestStation ||
    extractClosestStation(concert.transport) ||
    KNOWN_CLOSEST_STATIONS.get(normalizeLabel(concert.venue)) ||
    "";

  const addressLine = parsedAddress.addressLine || matchingVenue?.address || "";
  const zipCode = parsedAddress.zipCode || matchingVenue?.zipCode || "";
  const city = parsedAddress.city || matchingVenue?.city || "Stockholm";

  if (!addressLine || !zipCode || !city) {
    throw new Error(
      `Could not resolve full venue details for "${concert.venue}". Check address data in scripts/site-data.mjs.`,
    );
  }

  return {
    addressLine,
    zipCode,
    city,
    closestStation,
  };
}

function toAbsolutePublicUrl(value) {
  if (!value) {
    return "";
  }

  try {
    return new URL(value).toString();
  } catch {
    return absoluteUrl(value);
  }
}

function comparableAssetPath(value) {
  try {
    return new URL(value, site.baseUrl).pathname;
  } catch {
    return value;
  }
}

function resolveImageUrl(concert, overrideImageUrl) {
  const candidates = [
    overrideImageUrl,
    concert.posterImage,
    concert.socialImage,
    concert.heroImage,
    site.choirPerformanceImage,
    site.choirImageSocial,
  ]
    .filter(Boolean)
    .map((value) => toAbsolutePublicUrl(value));

  const supported = candidates.find((value) => /\.(jpe?g|png)$/i.test(new URL(value).pathname));

  if (!supported) {
    throw new Error(
      `No supported JPG/PNG image found for "${concert.slug}". Add posterImage/socialImage or pass --image-url.`,
    );
  }

  return supported;
}

function resolveImageCredit(concert, imageUrl, explicitCredit) {
  if (explicitCredit) {
    return normalizeWhitespace(explicitCredit);
  }

  if (concert.posterImageCredit) {
    return normalizeWhitespace(concert.posterImageCredit.replace(/^Foto:\s*/i, ""));
  }

  const imagePath = comparableAssetPath(imageUrl);

  if (imagePath === comparableAssetPath(site.choirPerformanceImage)) {
    return normalizeWhitespace(site.choirPerformanceImageCredit.replace(/^Foto:\s*/i, ""));
  }

  return "";
}

function getStockholmDateTimeParts(value) {
  const formatter = new Intl.DateTimeFormat("sv-SE", {
    timeZone: stockholmTimeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(
    formatter
      .formatToParts(new Date(value))
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
  };
}

function buildDateAdmin(concert) {
  const start = getStockholmDateTimeParts(concert.start);
  const end = getStockholmDateTimeParts(concert.end ?? concert.start);

  if (start.date === end.date) {
    return [
      {
        id: randomUUID(),
        type: "single_date",
        value: {
          date: start.date,
          start_time: start.time,
          end_time: end.time,
        },
      },
    ];
  }

  return [
    {
      id: randomUUID(),
      type: "date_range",
      value: {
        start_date: start.date,
        end_date: end.date,
      },
    },
  ];
}

function isFreeConcert(concert) {
  return /fri entr[eé]|gratis/i.test(concert.price ?? "");
}

function isNumericId(value) {
  return /^\d+$/.test(normalizeWhitespace(value));
}

function labelsMatch(label, candidates) {
  const normalized = normalizeLabel(label);
  return candidates.some((candidate) => normalizeLabel(candidate) === normalized);
}

function findKnownCategoryFallback(label) {
  return KNOWN_CATEGORY_FALLBACKS.find((entry) => labelsMatch(label, entry.labels)) ?? null;
}

function formatAvailableCategoryLabels(categories) {
  const labels = categories.map((category) => category.label).filter(Boolean);
  return labels.length ? labels.join(", ") : "(none)";
}

function resolveCategoryIds(categories, mainCategoryLabel, subcategoryLabel) {
  const explicitMainCategoryId = isNumericId(mainCategoryLabel) ? normalizeWhitespace(mainCategoryLabel) : "";
  const explicitSubcategoryId =
    subcategoryLabel && isNumericId(subcategoryLabel) ? normalizeWhitespace(subcategoryLabel) : "";

  if (explicitMainCategoryId) {
    return {
      mainCategoryId: explicitMainCategoryId,
      subcategoryId: explicitSubcategoryId,
      categoryIds: [Number(explicitMainCategoryId)],
      resolutionSource: "explicit-id",
    };
  }

  const fallbackMainCategory = findKnownCategoryFallback(mainCategoryLabel);
  const mainCategoryCandidates = [
    mainCategoryLabel,
    ...(fallbackMainCategory?.labels ?? []),
  ].filter(Boolean);
  const mainCategory = categories.find((category) => labelsMatch(category.label, mainCategoryCandidates));

  if (!mainCategory) {
    if (fallbackMainCategory) {
      const fallbackSubcategory =
        subcategoryLabel && !explicitSubcategoryId
          ? fallbackMainCategory.subcategories.find((entry) => labelsMatch(subcategoryLabel, entry.labels)) ?? null
          : null;

      return {
        mainCategoryId: fallbackMainCategory.id,
        subcategoryId: explicitSubcategoryId || fallbackSubcategory?.id || "",
        categoryIds: [Number(fallbackMainCategory.id)],
        resolutionSource: "known-fallback",
      };
    }

    throw new Error(
      `Could not find Visit Stockholm main category "${mainCategoryLabel}". Live categories: ${formatAvailableCategoryLabels(categories)}`,
    );
  }

  let subcategory = null;

  if (subcategoryLabel && !explicitSubcategoryId) {
    const fallbackSubcategory =
      fallbackMainCategory?.subcategories.find((entry) => labelsMatch(subcategoryLabel, entry.labels)) ?? null;
    const subcategoryCandidates = [
      subcategoryLabel,
      ...(fallbackSubcategory?.labels ?? []),
    ].filter(Boolean);
    subcategory = (mainCategory.subcategories ?? []).find((entry) =>
      labelsMatch(entry.label, subcategoryCandidates),
    );

    if (!subcategory) {
      if (fallbackSubcategory) {
        return {
          mainCategoryId: String(mainCategory.value),
          subcategoryId: fallbackSubcategory.id,
          categoryIds: [Number(mainCategory.value)],
          resolutionSource: "mixed-live-fallback",
        };
      }

      throw new Error(
        `Could not find Visit Stockholm subcategory "${subcategoryLabel}" under "${mainCategory.label}".`,
      );
    }
  }

  return {
    mainCategoryId: String(mainCategory.value),
    subcategoryId: explicitSubcategoryId || (subcategory ? String(subcategory.value) : ""),
    categoryIds: [Number(mainCategory.value)],
    resolutionSource: "live",
  };
}

async function pathExists(value) {
  try {
    await fs.access(value);
    return true;
  } catch {
    return false;
  }
}

async function resolveChromePath(explicitPath) {
  const candidates = [explicitPath, ...CHROME_PATH_CANDIDATES].filter(Boolean);

  for (const candidate of candidates) {
    if (await pathExists(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    "Could not find a Chrome-compatible browser. Pass --chrome-path or set VISIT_STOCKHOLM_CHROME_PATH.",
  );
}

async function findFreePort() {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close((closeError) => {
        if (closeError) {
          reject(closeError);
          return;
        }

        resolve(address.port);
      });
    });
  });
}

async function waitForDebugger(port, browserProcess, getStderr) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (browserProcess.exitCode !== null) {
      throw new Error(
        `Chrome exited before DevTools became available.\n${normalizeWhitespace(getStderr())}`,
      );
    }

    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`);

      if (response.ok) {
        return;
      }
    } catch {
      // Wait for the debugger endpoint to come up.
    }

    await delay(250);
  }

  throw new Error(`Timed out waiting for headless Chrome on port ${port}.`);
}

async function launchBrowser(chromePath, port) {
  const userDataDir = await fs.mkdtemp(path.join(os.tmpdir(), "visit-stockholm-"));
  let stderrOutput = "";
  const browserProcess = spawn(
    chromePath,
    [
      "--headless=new",
      "--disable-gpu",
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${userDataDir}`,
      "--no-first-run",
      "--no-default-browser-check",
      "about:blank",
    ],
    {
      stdio: ["ignore", "ignore", "pipe"],
    },
  );

  browserProcess.stderr.on("data", (chunk) => {
    stderrOutput += chunk.toString();
  });

  await waitForDebugger(port, browserProcess, () => stderrOutput);

  return {
    port,
    browserProcess,
    async close() {
      if (browserProcess.exitCode === null) {
        browserProcess.kill("SIGTERM");
        for (let attempt = 0; attempt < 20 && browserProcess.exitCode === null; attempt += 1) {
          await delay(100);
        }
      }

      if (browserProcess.exitCode === null) {
        browserProcess.kill("SIGKILL");
      }

      await fs.rm(userDataDir, { recursive: true, force: true });
    },
  };
}

async function openDebugTarget(port, url) {
  const response = await fetch(
    `http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`,
    {
      method: "PUT",
    },
  );

  if (!response.ok) {
    throw new Error(`Could not open debug target for ${url}.`);
  }

  return await response.json();
}

class CDPClient {
  constructor(webSocketDebuggerUrl) {
    this.webSocketDebuggerUrl = webSocketDebuggerUrl;
    this.messageId = 1;
    this.pending = new Map();
    this.socket = null;
  }

  async connect() {
    this.socket = new WebSocket(this.webSocketDebuggerUrl);

    await new Promise((resolve, reject) => {
      this.socket.addEventListener("open", resolve, { once: true });
      this.socket.addEventListener("error", reject, { once: true });
    });

    this.socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);

      if (!message.id || !this.pending.has(message.id)) {
        return;
      }

      const { resolve, reject } = this.pending.get(message.id);
      this.pending.delete(message.id);

      if (message.error) {
        reject(new Error(JSON.stringify(message.error)));
        return;
      }

      resolve(message);
    });
  }

  async close() {
    if (!this.socket) {
      return;
    }

    this.socket.close();
    await delay(50);
  }

  send(method, params = {}) {
    const id = this.messageId;
    this.messageId += 1;
    this.socket.send(JSON.stringify({ id, method, params }));

    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
  }

  async evaluate(expression) {
    const message = await this.send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });

    if (message.result.exceptionDetails) {
      throw new Error(JSON.stringify(message.result.exceptionDetails));
    }

    return message.result.result.value;
  }
}

async function waitForPageReady(cdp) {
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");

  for (let attempt = 0; attempt < 60; attempt += 1) {
    const state = await cdp.evaluate("document.readyState");
    const hasNextData = await cdp.evaluate("!!document.getElementById('__NEXT_DATA__')");

    if ((state === "complete" || state === "interactive") && hasNextData) {
      return;
    }

    await delay(500);
  }

  throw new Error("Visit Stockholm page never became ready.");
}

async function getPageMetadata(cdp) {
  const metadata = await cdp.evaluate(`(() => {
    const nextData = document.getElementById("__NEXT_DATA__");
    if (!nextData) {
      return null;
    }

    const pageProps = JSON.parse(nextData.textContent).props?.pageProps ?? {};

    return {
      title: document.title,
      categories: pageProps.categories ?? [],
      venueOptions: pageProps.venueOptions ?? [],
      csrf: pageProps.csrf ?? "",
    };
  })()`);

  if (!metadata) {
    throw new Error("Could not read page metadata from Visit Stockholm.");
  }

  return metadata;
}

function buildPayload(concert, options, pageMetadata) {
  const { mainCategoryId, subcategoryId, categoryIds, resolutionSource } = resolveCategoryIds(
    pageMetadata.categories,
    options.mainCategoryLabel,
    options.subcategoryLabel,
  );
  const imageUrl = resolveImageUrl(concert, options.imageUrl);
  const venue = resolveVenueData(concert, pageMetadata.venueOptions, options.station);

  return {
    endpoint: VISIT_STOCKHOLM_SUBMIT_PATH,
    imageUrl,
    imageFileName: path.basename(new URL(imageUrl).pathname),
    imageCredit: resolveImageCredit(concert, imageUrl, options.imageCredit),
    titleEn: concert.title,
    titleSv: concert.title,
    descriptionEn: buildEnglishDescription(concert, venue.city),
    descriptionSv: buildSwedishDescription(concert),
    externalWebsiteUrl: concertDetailsUrl(concert),
    address: venue.addressLine,
    venueName: concert.venue,
    zipCode: venue.zipCode,
    submittedByEmail: options.email,
    isFree: isFreeConcert(concert),
    isDigital: false,
    city: venue.city,
    closestStation: venue.closestStation,
    subcategory: subcategoryId,
    mainCategory: mainCategoryId,
    categories: categoryIds,
    dateAdmin: buildDateAdmin(concert),
    categoryResolution: resolutionSource,
  };
}

function buildPreview(concert, payload, options, pageMetadata) {
  return {
    mode: options.dryRun ? "dry-run" : "submit",
    visitStockholmTitle: pageMetadata.title,
    slug: concert.slug,
    title: concert.title,
    submittedByEmail: payload.submittedByEmail,
    address: `${payload.address}, ${payload.zipCode} ${payload.city}`,
    closestStation: payload.closestStation || "(none)",
    mainCategory: options.mainCategoryLabel,
    subcategory: options.subcategoryLabel || "(none)",
    categories: payload.categories,
    categoryResolution: payload.categoryResolution,
    imageUrl: payload.imageUrl,
    imageCredit: payload.imageCredit || "(none)",
    externalWebsiteUrl: payload.externalWebsiteUrl,
    isFree: payload.isFree,
    dateAdmin: payload.dateAdmin,
    descriptionEnLength: payload.descriptionEn.length,
    descriptionSvLength: payload.descriptionSv.length,
    descriptionEn: payload.descriptionEn,
    descriptionSv: payload.descriptionSv,
  };
}

async function submitPayloadInPage(cdp, payload) {
  const expression = `(async () => {
    const data = ${JSON.stringify(payload)};
    const nextData = document.getElementById("__NEXT_DATA__");
    const pageProps = nextData ? JSON.parse(nextData.textContent).props?.pageProps ?? {} : {};
    const csrf = pageProps.csrf || "";

    for (let attempt = 0; attempt < 60; attempt += 1) {
      if (window.grecaptcha && typeof grecaptcha.execute === "function") {
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    if (!window.grecaptcha || typeof grecaptcha.execute !== "function") {
      return {
        ok: false,
        stage: "recaptcha",
        error: "reCAPTCHA is not available on the page.",
      };
    }

    const imageResponse = await fetch(data.imageUrl);

    if (!imageResponse.ok) {
      return {
        ok: false,
        stage: "image",
        status: imageResponse.status,
        error: "Could not fetch submission image.",
      };
    }

    const imageBlob = await imageResponse.blob();
    const imageFile = new File([imageBlob], data.imageFileName, {
      type: imageBlob.type || "image/jpeg",
    });
    const token = await new Promise((resolve, reject) => {
      grecaptcha.ready(() => {
        grecaptcha
          .execute("6Ld-3Q8pAAAAAKZFdmjVZqhyG3rxYh3GxpYk9ET9", { action: "submit" })
          .then(resolve)
          .catch(reject);
      });
    });
    const headers = { Accept: "application/json" };

    if (csrf) {
      headers["X-CSRFToken"] = csrf;
    }

    const formData = new FormData();
    formData.append("recaptchaToken", token);
    formData.append("imageFile", imageFile);
    formData.append("imageTitle", imageFile.name);
    formData.append("imageCredit", data.imageCredit);
    formData.append("titleEn", data.titleEn);
    formData.append("titleSv", data.titleSv);
    formData.append("descriptionEn", data.descriptionEn);
    formData.append("descriptionSv", data.descriptionSv);
    formData.append("externalWebsiteUrl", data.externalWebsiteUrl);
    formData.append("address", data.address);
    formData.append("venueName", data.venueName);
    formData.append("zipCode", data.zipCode);
    formData.append("submittedByEmail", data.submittedByEmail);
    formData.append("isFree", data.isFree);
    formData.append("isDigital", data.isDigital);
    formData.append("city", data.city);
    formData.append("closestStation", data.closestStation);
    formData.append("mainCategory", data.mainCategory);
    formData.append("categories", JSON.stringify(data.categories));
    formData.append("dateAdmin", JSON.stringify(data.dateAdmin));

    if (data.subcategory) {
      formData.append("subcategory", data.subcategory);
    }

    const response = await fetch(data.endpoint, {
      method: "POST",
      headers,
      body: formData,
    });
    const responseText = await response.text();
    let responseJson = null;

    try {
      responseJson = JSON.parse(responseText);
    } catch {
      responseJson = null;
    }

    return {
      ok: response.ok,
      status: response.status,
      tokenLength: token.length,
      responseJson,
      responseText: responseText.slice(0, 4000),
    };
  })()`;

  return await cdp.evaluate(expression);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const concert = getConcertBySlug(options.slug);
  const chromePath = await resolveChromePath(options.chromePath);
  const port = await findFreePort();
  const browser = await launchBrowser(chromePath, port);
  let cdp = null;

  try {
    const target = await openDebugTarget(port, VISIT_STOCKHOLM_URL);
    cdp = new CDPClient(target.webSocketDebuggerUrl);
    await cdp.connect();
    await waitForPageReady(cdp);

    const pageMetadata = await getPageMetadata(cdp);
    const payload = buildPayload(concert, options, pageMetadata);
    const preview = buildPreview(concert, payload, options, pageMetadata);

    if (options.dryRun) {
      console.log(JSON.stringify(preview, null, 2));
      return;
    }

    const result = await submitPayloadInPage(cdp, payload);

    if (!result.ok) {
      console.error(JSON.stringify({ preview, result }, null, 2));
      process.exit(1);
    }

    console.log(
      JSON.stringify(
        {
          submitted: true,
          status: result.status,
          slug: concert.slug,
          title: concert.title,
          submittedByEmail: payload.submittedByEmail,
          response: result.responseJson ?? result.responseText,
        },
        null,
        2,
      ),
    );
  } finally {
    if (cdp) {
      await cdp.close();
    }

    await browser.close();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
