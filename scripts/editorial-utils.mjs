import fs from "node:fs/promises";
import path from "node:path";
import { automationSettings, concerts, site } from "./site-data.mjs";

export const stockholmTimeZone = "Europe/Stockholm";

export function absoluteUrl(urlPath) {
  return new URL(urlPath, site.baseUrl).toString();
}

export function getUpcomingConcerts(now = new Date()) {
  return concerts
    .filter((concert) => new Date(concert.start) >= now && concert.slug)
    .sort((a, b) => new Date(a.start) - new Date(b.start));
}

export function getNextConcert(now = new Date()) {
  return getUpcomingConcerts(now)[0] || null;
}

export function formatDate(value) {
  return new Intl.DateTimeFormat("sv-SE", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: stockholmTimeZone,
  }).format(new Date(value));
}

export function formatDateTime(value) {
  return new Intl.DateTimeFormat("sv-SE", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: stockholmTimeZone,
  })
    .format(new Date(value))
    .replace("kl. ", "kl ");
}

export function formatShortDate(value) {
  return new Intl.DateTimeFormat("sv-SE", {
    day: "numeric",
    month: "short",
    timeZone: stockholmTimeZone,
  }).format(new Date(value));
}

export function concertDetailsPath(concert) {
  return concert.slug ? `/konserter/${concert.slug}/` : "/konserter/";
}

export function concertDetailsUrl(concert) {
  return absoluteUrl(concertDetailsPath(concert));
}

export function concertCalendarPath(concert) {
  return concert.slug ? `/kalender/${concert.slug}.ics` : "/kalender/kammarkoren-hogalid.ics";
}

export function concertCalendarUrl(concert) {
  return absoluteUrl(concertCalendarPath(concert));
}

export function formatVoicesWanted(voicesWanted) {
  if (!voicesWanted?.length) {
    return "nya sångare i flera stämmor";
  }

  if (voicesWanted.length === 1) {
    return voicesWanted[0];
  }

  if (voicesWanted.length === 2) {
    return `${voicesWanted[0]} och ${voicesWanted[1]}`;
  }

  return `${voicesWanted.slice(0, -1).join(", ")} och ${
    voicesWanted[voicesWanted.length - 1]
  }`;
}

export function daysUntil(value, now = new Date()) {
  const diffMs = new Date(value).getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

export async function writeGeneratedFile(relativePath, content) {
  const rootDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
  const generatedDir = path.join(rootDir, automationSettings.generatedDir);
  const target = path.join(generatedDir, relativePath);

  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, content, "utf8");

  return target;
}
