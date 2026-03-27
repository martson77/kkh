import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import {
  aboutPage,
  choirFacts,
  concerts,
  conductorPage,
  futureProjects,
  homePage,
  joinPage,
  proofCards,
  site,
} from "./site-data.mjs";

const rootDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const publicDir = path.join(rootDir, "public");
const assetVersion = "20260327-concert-images";

const imageVariantWidths = [500, 800, 1080, 1200, 1600, 2000, 2600, 3200];
const knownImageWidths = {
  [site.choirPerformanceImage]: 1600,
  [site.conductorImage]: 1280,
  "/assets/imported/concerts/palmeri-bandoneon.jpg": 2000,
  "/assets/imported/concerts/hamburg-kreuzkirche.jpg": 1800,
  "/assets/imported/concerts/hogalid-exterior.jpg": 1800,
  "/assets/imported/concerts/monteverdi-portrait.jpg": 672,
  "/assets/external/cdn.prod.website-files.com/66138d74ede779973813c4af/673f3e4497ad5ca1eb93445e_bach-juloratoriet.jpg":
    1826,
};

const now = new Date();
const upcomingConcerts = concerts
  .filter((concert) => new Date(concert.start) >= now && concert.slug)
  .sort((a, b) => new Date(a.start) - new Date(b.start));
const pastConcerts = concerts
  .filter((concert) => new Date(concert.start) < now || !concert.slug)
  .sort((a, b) => new Date(b.start) - new Date(a.start));
const nextConcert = upcomingConcerts[0];

if (!nextConcert) {
  throw new Error("Ingen kommande konsert hittades i site-data.mjs.");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat("sv-SE", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "Europe/Stockholm",
  })
    .format(new Date(value))
    .replace("kl. ", "kl ");
}

function formatDate(value) {
  return new Intl.DateTimeFormat("sv-SE", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Stockholm",
  }).format(new Date(value));
}

function formatShortDateTime(value) {
  return `${formatDate(value)} kl ${new Intl.DateTimeFormat("sv-SE", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Stockholm",
  })
    .format(new Date(value))
    .replace(":", ".")}`;
}

function absoluteUrl(urlPath) {
  return new URL(urlPath, site.baseUrl).toString();
}

function localAssetPath(urlPath) {
  return path.join(publicDir, urlPath.replace(/^\//, ""));
}

function getImageCandidates(src) {
  if (!src || /^https?:\/\//.test(src)) {
    return [];
  }

  const ext = path.extname(src);
  const stem = src.slice(0, -ext.length);
  const candidates = [];
  const originalWidth = knownImageWidths[src] || Infinity;

  for (const width of imageVariantWidths) {
    if (width > originalWidth) {
      continue;
    }

    for (const variantPath of [`${stem}-p-${width}${ext}`, `${stem}-${width}${ext}`]) {
      if (existsSync(localAssetPath(variantPath))) {
        candidates.push({ src: variantPath, width });
        break;
      }
    }
  }

  if (knownImageWidths[src]) {
    candidates.push({ src, width: knownImageWidths[src] });
  }

  return candidates
    .sort((a, b) => a.width - b.width)
    .filter((candidate, index, array) => index === array.findIndex((item) => item.src === candidate.src));
}

function buildImageAttrs({ src, sizes }) {
  const candidates = getImageCandidates(src);
  if (!candidates.length) {
    return "";
  }

  const srcset = candidates.map((candidate) => `${candidate.src} ${candidate.width}w`).join(", ");
  return ` srcset="${srcset}"${sizes ? ` sizes="${sizes}"` : ""}`;
}

function renderImage({
  src,
  alt,
  className,
  sizes,
  eager = false,
}) {
  return `<img src="${src}" alt="${escapeHtml(alt)}" class="${className}"${buildImageAttrs({
    src,
    sizes,
  })} loading="${eager ? "eager" : "lazy"}" decoding="${eager ? "sync" : "async"}"${
    eager ? ' fetchpriority="high"' : ""
  }/>`;
}

function concertPosterPath(concert) {
  return concert.slug ? `/affischer/${concert.slug}.pdf` : "";
}

function hasPoster(concert) {
  return Boolean(concert.slug && existsSync(localAssetPath(concertPosterPath(concert))));
}

function navLink(label, href, currentPath) {
  const isCurrent = href === currentPath;
  return `<a href="${href}"${
    isCurrent ? ' aria-current="page"' : ""
  } class="navigation-item w-nav-link${isCurrent ? " w--current" : ""}">${label}</a>`;
}

function renderNavigation(currentPath) {
  return `<div data-collapse="medium" data-animation="default" data-duration="400" data-easing="ease" data-easing2="ease" role="banner" class="navigation w-nav">
  <div class="navigation-wrap">
    <div class="menu">
      <a href="/" class="logo-link w-nav-brand${currentPath === "/" ? " w--current" : ""}"${
        currentPath === "/" ? ' aria-current="page"' : ""
      }>
        <img src="${site.logo}" width="Auto" height="70" alt="Kammarkören Högalid" class="logo-image"/>
      </a>
      <nav role="navigation" class="navigation-items w-nav-menu">
        ${navLink("Nästa konsert", `/konserter/${nextConcert.slug}/`, currentPath)}
        ${navLink("Konserter", "/konserter/", currentPath)}
        ${navLink("Sjung med oss", "/sjung-med-oss/", currentPath)}
        ${navLink("Om kören", "/om-oss/", currentPath)}
        ${navLink("Dirigenten", "/dirigenten/", currentPath)}
      </nav>
      <button type="button" class="menu-button w-nav-button" aria-label="Öppna meny">
        <span class="menu-button-lines" aria-hidden="true">
          <span></span>
          <span></span>
          <span></span>
        </span>
      </button>
    </div>
  </div>
</div>`;
}

function renderFooter() {
  return `<footer class="site-footer">
  <div class="site-container footer-grid">
    <div>
      <p class="footer-heading">${site.name}</p>
      <p class="footer-copy">${site.shortDescription}</p>
    </div>
    <div>
      <p class="footer-heading">Följ oss</p>
      <p class="footer-copy"><a href="${site.facebook}" target="_blank" rel="noreferrer">Facebook</a> · <a href="${site.instagram}" target="_blank" rel="noreferrer">Instagram</a></p>
    </div>
    <div>
      <p class="footer-heading">Kontakt</p>
      <p class="footer-copy"><a href="mailto:${site.email}">${site.email}</a></p>
    </div>
  </div>
</footer>`;
}

function renderHead({
  pageTitle,
  description,
  urlPath,
  image = site.choirImageSocial,
  ogTitle = pageTitle,
  ogDescription = description,
  jsonLd,
  preloadImage,
}) {
  const canonical = absoluteUrl(urlPath);
  const preloadImageAttrs = preloadImage?.src
    ? buildImageAttrs({
        src: preloadImage.src,
        sizes: preloadImage.sizes,
      })
    : "";
  return `<meta charset="utf-8"/>
<title>${escapeHtml(pageTitle)}</title>
<meta content="${escapeHtml(description)}" name="description"/>
<meta content="width=device-width, initial-scale=1" name="viewport"/>
<meta content="${site.googleVerification}" name="google-site-verification"/>
<link rel="canonical" href="${canonical}"/>
<meta property="og:title" content="${escapeHtml(ogTitle)}"/>
<meta property="og:description" content="${escapeHtml(ogDescription)}"/>
<meta property="og:type" content="website"/>
<meta property="og:url" content="${canonical}"/>
<meta property="og:image" content="${absoluteUrl(image)}"/>
<meta property="twitter:title" content="${escapeHtml(ogTitle)}"/>
<meta property="twitter:description" content="${escapeHtml(ogDescription)}"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:image" content="${absoluteUrl(image)}"/>
${preloadImage?.src ? `<link rel="preload" as="image" href="${preloadImage.src}"${preloadImageAttrs}/>` : ""}
<link href="/assets/external/cdn.prod.website-files.com/66138d74ede779973813c4af/css/kammarkoren-hogalid.webflow.shared.32559a67a.min.css" rel="stylesheet" type="text/css"/>
<link href="/assets/app.css?v=${assetVersion}" rel="stylesheet" type="text/css"/>
<link href="https://fonts.googleapis.com" rel="preconnect"/>
<link href="https://fonts.gstatic.com" rel="preconnect"/>
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@100..900&display=swap" rel="stylesheet"/>
<script type="text/javascript">!function(o,c){var n=c.documentElement,t=" w-mod-";n.className+=t+"js",("ontouchstart"in o||o.DocumentTouch&&c instanceof DocumentTouch)&&(n.className+=t+"touch")}(window,document);</script>
<link href="${site.favicon}" rel="icon" type="${site.faviconType || "image/x-icon"}"/>
<link href="${site.favicon}" rel="shortcut icon" type="${site.faviconType || "image/x-icon"}"/>
<link href="${site.appleTouchIcon}" rel="apple-touch-icon"/>
<script async="" src="https://www.googletagmanager.com/gtag/js?id=${site.gaId}"></script>
<script type="text/javascript">window.dataLayer = window.dataLayer || [];function gtag(){dataLayer.push(arguments);}gtag("set","developer_id.dZGVlNj",true);gtag("js",new Date());gtag("config","${site.gaId}");</script>
${jsonLd ? `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>` : ""}`;
}

function renderLayout({
  pageTitle,
  description,
  urlPath,
  currentPath,
  image,
  ogTitle,
  ogDescription,
  pageType,
  jsonLd,
  body,
  preloadImage,
}) {
  return `<!DOCTYPE html>
<html lang="sv">
<head>
${renderHead({
  pageTitle,
  description,
  urlPath,
  image,
  ogTitle,
  ogDescription,
  jsonLd,
  preloadImage,
})}
</head>
<body data-page-type="${pageType}">
${renderNavigation(currentPath)}
${body}
${renderFooter()}
<script src="/assets/site.js?v=${assetVersion}" defer></script>
</body>
</html>`;
}

function button({
  href,
  label,
  variant = "primary",
  track,
  location,
  newTab = false,
  download = false,
}) {
  return `<a href="${href}" class="cta-button cta-button--${variant}"${
    track ? ` data-track="${track}"` : ""
  }${location ? ` data-track-location="${location}"` : ""}${
    newTab ? ' target="_blank" rel="noreferrer"' : ""
  }${
    download ? ' download=""' : ""
  }>${label}</a>`;
}

function renderImageCredit(credit, className = "media-card-credit") {
  if (!credit) {
    return "";
  }

  return `<p class="${className}">Bild: ${escapeHtml(credit)}</p>`;
}

function hasTicketLink(concert) {
  return Boolean(concert.ticketUrl);
}

function hasTicketAlert(concert) {
  return Boolean(!concert.ticketUrl && concert.slug && concert.ticketAlert !== false);
}

function concertTicketAlertUrl(concert) {
  const subject = `Biljettbesked: ${concert.title}`;
  const body = `Hej!\n\nJag vill gärna få besked när biljettlänken för ${concert.title} publiceras.\n\nNamn:\n`;
  return `mailto:${site.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function concertCalendarDetails(concert) {
  const detailsUrl = absoluteUrl(
    concert.slug ? `/konserter/${concert.slug}/` : "/konserter/"
  );
  const ticketLine = hasTicketLink(concert)
    ? `Biljetter: ${concert.ticketUrl}`
    : "Biljettlänk publiceras på konsertsidan senare.";

  return `${concert.summary}\n\n${ticketLine}\nMer info: ${detailsUrl}`;
}

function concertGoogleCalendarUrl(concert) {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: concert.title,
    dates: `${toGoogleDate(concert.start)}/${toGoogleDate(concert.end || concert.start)}`,
    location: `${concert.venue}, ${concert.address || ""}`.trim(),
    details: concertCalendarDetails(concert),
    ctz: "Europe/Stockholm",
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function toGoogleDate(value) {
  const date = new Date(value);
  const pad = (number) => String(number).padStart(2, "0");
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(
    date.getUTCDate()
  )}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(
    date.getUTCSeconds()
  )}Z`;
}

function renderPastConcertCard(concert) {
  return `<article class="concert-card concert-card--past">
  ${
    concert.image
      ? renderImage({
          src: concert.image,
          alt: concert.imageAlt || concert.title,
          className: "concert-card-image",
          sizes: "(max-width: 991px) 100vw, 46vw",
        })
      : ""
  }
  <div class="concert-card-body">
    <p class="concert-card-kicker">Tidigare konsert</p>
    <h3 class="concert-card-title">${concert.title}</h3>
    <p class="concert-card-meta">${formatDate(concert.start)} · ${concert.venue}</p>
    <p class="concert-card-copy">${concert.summary}</p>
    ${
      concert.ticketUrl
        ? button({
            href: concert.ticketUrl,
            label: "Se biljettlänk",
            variant: "ghost",
            track: "buy_ticket_archive",
            location: "concert_archive",
            newTab: true,
          })
        : ""
    }
  </div>
</article>`;
}

function renderHomePage() {
  const latestPastConcert = pastConcerts[0];
  const featuredProject = futureProjects[0];
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "MusicGroup",
    name: site.name,
    description: site.description,
    email: site.email,
    url: site.baseUrl,
    image: absoluteUrl(site.choirImageSocial),
    sameAs: [site.facebook, site.instagram],
    event: {
      "@type": "MusicEvent",
      name: nextConcert.title,
      startDate: nextConcert.start,
      endDate: nextConcert.end,
      location: {
        "@type": "Place",
        name: nextConcert.venue,
        address: nextConcert.address,
      },
      image: [absoluteUrl(nextConcert.socialImage)],
      description: nextConcert.summary,
      performer: nextConcert.performers.map((performer) => ({
        "@type": "PerformingGroup",
        name: performer,
      })),
    },
  };

  if (hasTicketLink(nextConcert)) {
    jsonLd.event.offers = {
      "@type": "Offer",
      url: nextConcert.ticketUrl,
      price: "150",
      priceCurrency: "SEK",
      availability: "https://schema.org/InStock",
    };
  }

  const body = `<main>
  <section class="hero hero--home">
    <div class="site-container hero-grid hero-grid--home">
      <div class="hero-copy">
        <p class="eyebrow">${homePage.hero.eyebrow}</p>
        <h1 class="hero-title">${homePage.hero.title}</h1>
        <p class="hero-lead">${homePage.hero.lead}</p>
        <div class="hero-actions">
          ${button({
            href: `/konserter/${nextConcert.slug}/`,
            label: "Se nästa konsert",
            location: "home_hero",
          })}
          ${button({
            href: "/sjung-med-oss/",
            label: "Sjung med oss",
            variant: "secondary",
            track: "join_choir",
            location: "home_hero",
          })}
          ${button({
            href: "/om-oss/",
            label: "Om kören",
            variant: "ghost",
          })}
        </div>
        <ul class="inline-list">
          ${homePage.hero.highlights.map((item) => `<li>${item}</li>`).join("")}
        </ul>
      </div>
      <div class="hero-media">
        ${renderImage({
          src: site.choirPerformanceImage,
          alt: site.choirPerformanceImageAlt,
          className: "hero-image",
          sizes: "(max-width: 991px) 100vw, 44vw",
          eager: true,
        })}
        <aside class="highlight-panel">
          <p class="highlight-panel-kicker">${homePage.nextConcertPanel.eyebrow}</p>
          <h2 class="highlight-panel-title">${nextConcert.title}</h2>
          <p class="highlight-panel-meta">${formatDateTime(nextConcert.start)} · ${nextConcert.venue}</p>
          <p class="highlight-panel-copy">${
            hasTicketLink(nextConcert)
              ? homePage.nextConcertPanel.withTicketTitle
              : homePage.nextConcertPanel.withoutTicketTitle
          } ${nextConcert.teaser}</p>
          <div class="highlight-panel-actions">
            ${
              hasTicketLink(nextConcert)
                ? button({
                    href: nextConcert.ticketUrl,
                    label: "Köp biljett",
                    track: "buy_ticket",
                    location: "home_panel",
                    newTab: true,
                  })
                : button({
                    href: `/konserter/${nextConcert.slug}/`,
                    label: "Se konsertinfo",
                    variant: "secondary",
                    location: "home_panel",
                  })
            }
            ${
              hasTicketAlert(nextConcert)
                ? button({
                    href: concertTicketAlertUrl(nextConcert),
                    label: "Få besked om biljetter",
                    variant: "ghost",
                    track: "ticket_alert_interest",
                    location: "home_panel",
                  })
                : ""
            }
            ${button({
              href: `/kalender/${nextConcert.slug}.ics`,
              label: "Spara i kalendern",
              variant: "ghost",
              track: "add_to_calendar",
              location: "home_panel",
            })}
          </div>
        </aside>
        <p class="hero-media-credit">${escapeHtml(site.choirPerformanceImageCredit)}</p>
      </div>
    </div>
  </section>
  <section class="section-block">
    <div class="site-container section-grid">
      <div>
        <p class="eyebrow">${homePage.about.eyebrow}</p>
        <h2 class="section-title">${homePage.about.title}</h2>
        <p class="section-copy">${aboutPage.intro}</p>
        <p class="section-copy">${aboutPage.paragraphs[0]}</p>
        <div class="section-actions">
          ${button({ href: "/om-oss/", label: "Läs mer om kören", variant: "secondary" })}
        </div>
      </div>
      <aside class="info-panel">
        <h3>Fakta om kören</h3>
        <ul class="bullet-list">
          ${choirFacts
            .map((fact) => `<li><strong>${fact.value}</strong> ${fact.label}</li>`)
            .join("")}
        </ul>
      </aside>
    </div>
  </section>
  <section class="section-block section-block--muted">
    <div class="site-container section-grid">
      <div>
        <p class="eyebrow">${homePage.join.eyebrow}</p>
        <h2 class="section-title">${homePage.join.title}</h2>
        <p class="section-copy">${joinPage.intro}</p>
        <p class="section-copy">${joinPage.paragraphs[0]}</p>
        <div class="section-actions">
          ${button({
            href: "/sjung-med-oss/",
            label: "Läs om provsjungning",
            track: "join_choir",
            location: "home_join",
            variant: "secondary",
          })}
          ${button({
            href: joinPage.formUrl,
            label: "Skicka intresseanmälan",
            track: "join_choir",
            location: "home_join",
            newTab: true,
          })}
        </div>
      </div>
      <div class="info-panel">
        <h3>Detta gäller</h3>
        <ul class="bullet-list">
          ${joinPage.practicals.map((item) => `<li>${item}</li>`).join("")}
        </ul>
      </div>
    </div>
  </section>
  <section class="section-block">
    <div class="site-container section-grid section-grid--reverse">
      <div class="media-card media-card--portrait">
        ${renderImage({
          src: site.conductorImage,
          alt: site.conductorImageAlt,
          className: "media-card-image",
          sizes: "(max-width: 991px) 100vw, 44vw",
        })}
      </div>
      <div>
        <p class="eyebrow">${homePage.conductor.eyebrow}</p>
        <h2 class="section-title">${homePage.conductor.title}</h2>
        <p class="section-copy">${conductorPage.intro}</p>
        <p class="section-copy">${conductorPage.paragraphs[0]}</p>
        <div class="section-actions">
          ${button({ href: "/dirigenten/", label: "Läs mer om Benedikt", variant: "secondary" })}
        </div>
      </div>
    </div>
  </section>
  <section class="section-block section-block--muted">
    <div class="site-container">
      <div class="section-heading">
        <p class="eyebrow">${homePage.archive.eyebrow}</p>
        <h2 class="section-title">${homePage.archive.title}</h2>
        <p class="section-copy">${homePage.archive.lead}</p>
      </div>
      <div class="section-grid home-story-grid">
        ${latestPastConcert ? renderPastConcertCard(latestPastConcert) : ""}
        <aside class="info-panel home-project-panel">
          <p class="eyebrow">Kommande projekt</p>
          <h3>${featuredProject.title}</h3>
          <p class="section-copy">${featuredProject.summary}</p>
          <ul class="bullet-list">
            ${featuredProject.bullets.map((item) => `<li>${item}</li>`).join("")}
          </ul>
          <div class="section-actions">
            ${button({ href: "/konserter/", label: "Se alla konserter", variant: "secondary" })}
          </div>
        </aside>
      </div>
    </div>
  </section>
</main>`;

  return renderLayout({
    pageTitle: `${site.name} | Konserter, körliv och provsjungning`,
    description:
      "Upptäck nästa konsert, lär känna Kammarkören Högalid och se hur du kan sjunga med oss i Högalid.",
    urlPath: "/",
    currentPath: "/",
    image: site.choirPerformanceImage,
    ogTitle: `${site.name} | Konserter och körliv i Högalid`,
    ogDescription:
      "Nästa konsert, körens profil och vägen in i en aktiv ensemble på avancerad nivå i Högalid.",
    pageType: "home",
    jsonLd,
    body,
    preloadImage: {
      src: site.choirPerformanceImage,
      sizes: "(max-width: 991px) 100vw, 44vw",
    },
  });
}

function renderConcertsPage() {
  const upcomingSectionTitle =
    upcomingConcerts.length > 1 ? "Kommande konserter" : "Nästa konsert";
  const upcomingSectionEyebrow =
    upcomingConcerts.length > 1 ? "Kommande konserter" : "Aktuell konsert";
  const body = `<main>
  <section class="page-header">
    <div class="site-container page-header-grid">
      <div>
        <p class="eyebrow">Konserter</p>
        <h1 class="page-title">Aktuella konserter och tidigare program</h1>
        <p class="page-lead">Här finns information om kommande konserter samt ett urval av tidigare program.</p>
      </div>
      <aside class="calendar-panel">
        <p class="calendar-panel-kicker">Kalender</p>
        <h2 class="calendar-panel-title">Lägg till kommande konserter i kalendern.</h2>
        <p class="calendar-panel-copy">Du kan spara kalenderfilen manuellt eller prenumerera på kalendern.</p>
        <div class="calendar-panel-actions">
          ${button({
            href: "/kalender/kammarkoren-hogalid.ics",
            label: "Spara hela konsertkalendern",
            track: "add_to_calendar",
            location: "concerts_feed",
            variant: "secondary",
          })}
          ${button({
            href: "webcal://www.kammarkorenhogalid.se/kalender/kammarkoren-hogalid.ics",
            label: "Prenumerera automatiskt",
            track: "add_to_calendar_feed",
            location: "concerts_feed",
            variant: "ghost",
          })}
        </div>
      </aside>
    </div>
  </section>
  <section class="section-block">
    <div class="site-container">
      <div class="section-heading">
        <p class="eyebrow">${upcomingSectionEyebrow}</p>
        <h2 class="section-title">${upcomingSectionTitle}</h2>
      </div>
      <div class="concert-list">
        ${upcomingConcerts
          .map(
            (concert, index) => `<article class="concert-card concert-card--upcoming">
          ${renderImage({
            src: concert.heroImage,
            alt: concert.heroImageAlt,
            className: "concert-card-image",
            sizes: "(max-width: 991px) 100vw, 42vw",
          })}
          <div class="concert-card-body">
            <p class="concert-card-kicker">${index === 0 ? "Nästa konsert" : "Kommande konsert"}</p>
            <h3 class="concert-card-title">${concert.title}</h3>
            <p class="concert-card-meta">${formatDateTime(concert.start)} · ${concert.venue}</p>
            <p class="concert-card-copy">${concert.summary}</p>
            ${renderImageCredit(concert.imageCredit, "concert-card-credit")}
            <div class="concert-card-actions">
              ${
                hasTicketLink(concert)
                  ? button({
                      href: concert.ticketUrl,
                      label: "Köp biljett",
                      track: "buy_ticket",
                      location: "concerts_upcoming",
                      newTab: true,
                    })
                  : ""
              }
              ${
                hasTicketAlert(concert)
                  ? button({
                      href: concertTicketAlertUrl(concert),
                      label: "Få besked om biljetter",
                      track: "ticket_alert_interest",
                      location: "concerts_upcoming",
                      variant: "ghost",
                    })
                  : ""
              }
              ${button({
                href: `/konserter/${concert.slug}/`,
                label: "Se konsertinfo",
                variant: "secondary",
              })}
              ${button({
                href: `/kalender/${concert.slug}.ics`,
                label: "Spara i kalendern",
                track: "add_to_calendar",
                location: "concerts_upcoming",
                variant: "ghost",
              })}
            </div>
          </div>
        </article>`
          )
          .join("")}
      </div>
    </div>
  </section>
  <section class="section-block section-block--muted">
    <div class="site-container">
      <div class="section-heading">
        <p class="eyebrow">Tidigare program</p>
        <h2 class="section-title">Här kan du se vad vi har framfört tidigare.</h2>
      </div>
      <div class="archive-grid">
        ${pastConcerts.map((concert) => renderPastConcertCard(concert)).join("")}
      </div>
    </div>
  </section>
  <section class="section-block">
    <div class="site-container section-grid">
      <div>
        <p class="eyebrow">Kommande projekt</p>
        <h2 class="section-title">${futureProjects[0].title}</h2>
        <p class="section-copy">${futureProjects[0].summary}</p>
        ${futureProjects[0].paragraphs
          .map((paragraph) => `<p class="section-copy">${paragraph}</p>`)
          .join("")}
      </div>
      <aside class="info-panel">
        <h3>Bekräftat hittills</h3>
        <ul class="bullet-list">
          ${futureProjects[0].bullets.map((item) => `<li>${item}</li>`).join("")}
        </ul>
      </aside>
    </div>
  </section>
</main>`;

  return renderLayout({
    pageTitle: `Konserter | ${site.name}`,
    description:
      "Se nästa konsert med Kammarkören Högalid, spara datumet i kalendern och bläddra bland tidigare program.",
    urlPath: "/konserter/",
    currentPath: "/konserter/",
    image: nextConcert.socialImage,
    ogTitle: `Konserter | ${site.name}`,
    ogDescription:
      "Se nästa konsert, spara datumet i kalendern och upptäck tidigare program från Kammarkören Högalid.",
    pageType: "concerts",
    body,
    preloadImage: {
      src: nextConcert.heroImage,
      sizes: "(max-width: 991px) 100vw, 42vw",
    },
  });
}

function renderConcertDetailPage(concert) {
  const detailEyebrow = concert.slug === nextConcert.slug ? "Nästa konsert" : "Kommande konsert";
  const ticketActionsTitle = hasTicketLink(concert)
    ? "Boka eller spara"
    : hasTicketAlert(concert)
      ? "Få biljettbesked eller spara"
      : "Spara konserten";
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "MusicEvent",
    name: concert.title,
    startDate: concert.start,
    endDate: concert.end,
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    eventStatus: "https://schema.org/EventScheduled",
    description: concert.summary,
    image: [absoluteUrl(concert.socialImage)],
    location: {
      "@type": "Place",
      name: concert.venue,
      address: concert.address,
    },
    organizer: {
      "@type": "Organization",
      name: site.name,
      url: site.baseUrl,
    },
    performer: concert.performers.map((performer) => ({
      "@type": "PerformingGroup",
      name: performer,
    })),
  };

  if (hasTicketLink(concert)) {
    jsonLd.offers = {
      "@type": "Offer",
      url: concert.ticketUrl,
      price: "150",
      priceCurrency: "SEK",
      availability: "https://schema.org/InStock",
      validFrom: concert.start,
    };
  }

  const body = `<main>
  <section class="page-header page-header--event">
    <div class="site-container page-header-grid">
      <div>
        <p class="eyebrow">${detailEyebrow}</p>
        <h1 class="page-title">${concert.title}</h1>
        <p class="page-lead">${concert.teaser} ${concert.summary}</p>
        <p class="event-meta">${formatDateTime(concert.start)} · ${concert.venue}</p>
      </div>
      <div class="media-card">
        ${renderImage({
          src: concert.heroImage,
          alt: concert.heroImageAlt,
          className: "media-card-image",
          sizes: "(max-width: 991px) 100vw, 44vw",
          eager: true,
        })}
        ${renderImageCredit(concert.imageCredit)}
      </div>
    </div>
  </section>
  <section class="section-block">
    <div class="site-container detail-layout">
      <div class="detail-main">
        ${concert.description
          .map((paragraph) => `<p class="section-copy">${paragraph}</p>`)
          .join("")}
        <section class="detail-section">
          <h2>Program</h2>
          <ul class="bullet-list">
            ${concert.program.map((item) => `<li>${item}</li>`).join("")}
          </ul>
        </section>
        <section class="detail-section">
          <h2>Medverkande</h2>
          <ul class="bullet-list">
            ${concert.performers.map((item) => `<li>${item}</li>`).join("")}
          </ul>
        </section>
        <section class="detail-section">
          <h2>Planera ditt besök</h2>
          <div class="visit-grid">
            ${concert.planVisit
              .map(
                (item) => `<article class="visit-card">
              <h3>${item.title}</h3>
              <p>${item.body}</p>
            </article>`
              )
              .join("")}
          </div>
        </section>
      </div>
      <aside class="detail-aside">
        <div class="aside-card">
          <p class="aside-label">Tid och plats</p>
          <h2>${concert.venue}</h2>
          <p>${formatDateTime(concert.start)}</p>
          <p>${concert.address}</p>
        </div>
        <div class="aside-card">
          <p class="aside-label">${ticketActionsTitle}</p>
          <div class="stack-actions">
            ${
              hasTicketLink(concert)
                ? button({
                    href: concert.ticketUrl,
                    label: "Köp biljett",
                    track: "buy_ticket",
                    location: "concert_detail_sidebar",
                    newTab: true,
                  })
                : ""
            }
            ${
              hasTicketAlert(concert)
                ? button({
                    href: concertTicketAlertUrl(concert),
                    label: "Få besked om biljetter",
                    track: "ticket_alert_interest",
                    location: "concert_detail_sidebar",
                  })
                : ""
            }
            ${button({
              href: `/kalender/${concert.slug}.ics`,
              label: "Lägg till i Apple/Outlook",
              track: "add_to_calendar",
              location: "concert_detail_sidebar",
              variant: "secondary",
            })}
            ${button({
              href: concertGoogleCalendarUrl(concert),
              label: "Lägg till i Google Kalender",
              track: "add_to_calendar",
              location: "concert_detail_sidebar",
              variant: "secondary",
              newTab: true,
            })}
            ${
              hasPoster(concert)
                ? button({
                    href: concertPosterPath(concert),
                    label: "Ladda ner affisch (PDF)",
                    track: "download_poster",
                    location: "concert_detail_sidebar",
                    variant: "ghost",
                    download: true,
                  })
                : ""
            }
          </div>
        </div>
        <div class="aside-card">
          <p class="aside-label">Dela konserten</p>
          <div class="stack-actions">
            <button class="cta-button cta-button--ghost" data-share data-share-title="${escapeHtml(
              concert.title
            )}" data-share-text="${escapeHtml(
              `${concert.title} i ${concert.venue} ${formatDate(concert.start)}.`
            )}" data-track="share_concert" data-track-location="concert_detail_sidebar">Dela på mobilen</button>
            <button class="cta-button cta-button--ghost" data-copy-url data-track="copy_link" data-track-location="concert_detail_sidebar">Kopiera länk</button>
          </div>
        </div>
        <div class="aside-card">
          <p class="aside-label">Håll koll på fler datum</p>
          ${button({
            href: "/kalender/kammarkoren-hogalid.ics",
            label: "Hämta säsongens .ics-feed",
            track: "add_to_calendar_feed",
            location: "concert_detail_sidebar",
            variant: "ghost",
          })}
        </div>
      </aside>
    </div>
  </section>
</main>`;

  return renderLayout({
    pageTitle: `${concert.title} | ${formatDate(concert.start)} | ${site.name}`,
    description: `${concert.title} i ${concert.venue} ${formatShortDateTime(
      concert.start
    )}. Läs mer, lägg i kalendern och planera ditt besök.`,
    urlPath: `/konserter/${concert.slug}/`,
    currentPath: `/konserter/${concert.slug}/`,
    image: concert.socialImage,
    ogTitle: `${concert.title} | ${site.name}`,
    ogDescription: concert.summary,
    pageType: "concert_detail",
    jsonLd,
    body,
    preloadImage: {
      src: concert.heroImage,
      sizes: "(max-width: 991px) 100vw, 44vw",
    },
  });
}

function renderSimplePage({
  currentPath,
  pageTitle,
  description,
  title,
  lead,
  image,
  imageAlt,
  imageCredit,
  sections,
  pageType,
}) {
  const body = `<main>
  <section class="page-header">
    <div class="site-container page-header-grid">
      <div>
        <p class="eyebrow">${pageTitle.split(" | ")[0]}</p>
        <h1 class="page-title">${title}</h1>
        <p class="page-lead">${lead}</p>
      </div>
      ${
        image
          ? `<div class="media-card media-card--portrait">
        ${renderImage({
          src: image,
          alt: imageAlt || title,
          className: "media-card-image",
          sizes: "(max-width: 991px) 100vw, 44vw",
          eager: true,
        })}
        ${imageCredit ? `<p class="media-card-credit">${escapeHtml(imageCredit)}</p>` : ""}
      </div>`
          : ""
      }
    </div>
  </section>
  ${sections}
</main>`;

  return renderLayout({
    pageTitle,
    description,
    urlPath: currentPath,
    currentPath,
    image: image || site.choirImageSocial,
    ogTitle: pageTitle,
    ogDescription: description,
    pageType,
    body,
    preloadImage: image
      ? {
          src: image,
          sizes: "(max-width: 991px) 100vw, 44vw",
        }
      : undefined,
  });
}

function renderAboutPage() {
  const sections = `<section class="section-block">
  <div class="site-container two-column-copy">
    ${aboutPage.paragraphs.map((paragraph) => `<p class="section-copy">${paragraph}</p>`).join("")}
    <p class="section-copy">${futureProjects[0].aboutNote}</p>
  </div>
</section>
<section class="section-block section-block--muted">
  <div class="site-container section-grid">
    <div>
      <p class="eyebrow">${aboutPage.profileTitle}</p>
      <h2 class="section-title">Bred repertoar, hög nivå och varm körgemenskap.</h2>
      ${aboutPage.profileParagraphs
        .map((paragraph) => `<p class="section-copy">${paragraph}</p>`)
        .join("")}
    </div>
    <div class="info-panel">
      <h2>Kören i korthet</h2>
      <ul class="bullet-list">
        <li>Från renässans till samtida och nyskriven körmusik</li>
        <li>Både a cappella, gudstjänstmedverkan och större orkesterprojekt</li>
        <li>Musikalisk fördjupning i en engagerad och varm ensemble</li>
      </ul>
    </div>
  </div>
</section>
<section class="section-block section-block--muted">
  <div class="site-container">
    <div class="section-heading">
      <p class="eyebrow">Körens profil</p>
      <h2 class="section-title">Repertoar, arbetssätt och sammanhang</h2>
    </div>
    <div class="proof-grid">
      ${proofCards
        .map(
          (card) => `<article class="proof-card"><h3>${card.title}</h3><p>${card.body}</p></article>`
        )
        .join("")}
    </div>
  </div>
</section>`;

  return renderSimplePage({
    currentPath: "/om-oss/",
    pageTitle: `Om Kammarkören Högalid | Kör på avancerad nivå`,
    description:
      "Läs om Kammarkören Högalid, vår nivå, vår repertoar och hur kören är förankrad i Högalids församling.",
    title: "Om Kammarkören Högalid",
    lead: aboutPage.intro,
    image: site.choirPerformanceImage,
    imageAlt: site.choirPerformanceImageAlt,
    imageCredit: site.choirPerformanceImageCredit,
    sections,
    pageType: "about",
  });
}

function renderConductorPage() {
  const sections = `<section class="section-block">
  <div class="site-container two-column-copy">
    ${conductorPage.paragraphs
      .map((paragraph) => `<p class="section-copy">${paragraph}</p>`)
      .join("")}
  </div>
</section>
<section class="section-block section-block--muted">
  <div class="site-container quote-panel">
    <p class="eyebrow">Citat</p>
    <blockquote>${conductorPage.quote}</blockquote>
  </div>
</section>`;

  return renderSimplePage({
    currentPath: "/dirigenten/",
    pageTitle: `Benedikt Melichar | Dirigent för ${site.name}`,
    description:
      "Läs mer om Benedikt Melichar, dirigent och konstnärlig ledare för Kammarkören Högalid.",
    title: "Dirigent Benedikt Melichar",
    lead: conductorPage.intro,
    image: site.conductorImage,
    imageAlt: site.conductorImageAlt,
    imageCredit: "",
    sections,
    pageType: "conductor",
  });
}

function renderJoinPage() {
  const sections = `<section class="section-block">
  <div class="site-container section-grid">
    <div>
      ${joinPage.paragraphs.map((paragraph) => `<p class="section-copy">${paragraph}</p>`).join("")}
    </div>
    <div class="info-panel">
      <h2>Praktiskt</h2>
      <ul class="bullet-list">
        ${joinPage.practicals.map((item) => `<li>${item}</li>`).join("")}
      </ul>
    </div>
  </div>
</section>
<section class="section-block section-block--muted">
  <div class="site-container section-grid">
    <div class="step-list">
      <p class="eyebrow">Så går det till</p>
      <h2 class="section-title">Provsjungning steg för steg</h2>
      <ol class="numbered-list">
        ${joinPage.auditionSteps.map((step) => `<li>${step}</li>`).join("")}
      </ol>
    </div>
    <div class="calendar-panel">
      <p class="calendar-panel-kicker">Kontakt</p>
      <h2 class="calendar-panel-title">Intresseanmälan</h2>
      <p class="calendar-panel-copy">Skicka en intresseanmälan via Svenska kyrkans formulär eller mejla kören om du vill veta mer inför nästa provsjungning.</p>
      <div class="calendar-panel-actions">
        ${button({
          href: joinPage.formUrl,
          label: "Skicka intresseanmälan",
          track: "join_choir",
          location: "join_page",
          newTab: true,
        })}
        ${button({
          href: `mailto:${site.email}`,
          label: "Mejla kören",
          track: "join_choir",
          location: "join_page",
          variant: "ghost",
        })}
      </div>
    </div>
  </div>
</section>`;

  return renderSimplePage({
    currentPath: "/sjung-med-oss/",
    pageTitle: `Sjung med oss | ${site.name}`,
    description:
      "Läs hur provsjungning går till, när vi repeterar och hur du skickar en intresseanmälan till Kammarkören Högalid.",
    title: "Sjung med oss",
    lead: joinPage.intro,
    image: site.choirImage,
    imageAlt: site.choirImageAlt,
    imageCredit: "",
    sections,
    pageType: "join",
  });
}

function toIcsTimestamp(value) {
  const date = new Date(value);
  const pad = (number) => String(number).padStart(2, "0");
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(
    date.getUTCDate()
  )}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(
    date.getUTCSeconds()
  )}Z`;
}

function escapeIcs(value) {
  return String(value)
    .replaceAll("\\", "\\\\")
    .replaceAll(";", "\\;")
    .replaceAll(",", "\\,")
    .replaceAll("\n", "\\n");
}

function renderIcsCalendar(items, calendarName) {
  const events = items
    .map((concert) => {
      const detailsUrl = absoluteUrl(
        concert.slug ? `/konserter/${concert.slug}/` : "/konserter/"
      );
      const description = hasTicketLink(concert)
        ? `${concert.summary}\n\nBiljetter: ${concert.ticketUrl}\nMer information: ${detailsUrl}`
        : `${concert.summary}\n\nBiljettlänk publiceras på konsertsidan senare.\nMer information: ${detailsUrl}`;
      return `BEGIN:VEVENT
UID:${concert.slug || concert.title.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-")}@kammarkorenhogalid.se
DTSTAMP:${toIcsTimestamp(concert.updatedAt || concert.start)}
DTSTART:${toIcsTimestamp(concert.start)}
DTEND:${toIcsTimestamp(concert.end || concert.start)}
SUMMARY:${escapeIcs(concert.title)}
DESCRIPTION:${escapeIcs(description)}
LOCATION:${escapeIcs(`${concert.venue}${concert.address ? `, ${concert.address}` : ""}`)}
URL:${detailsUrl}
END:VEVENT`;
    })
    .join("\n");

  return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Kammarkören Högalid//Konsertkalender//SV
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:${escapeIcs(calendarName)}
X-WR-TIMEZONE:Europe/Stockholm
${events}
END:VCALENDAR
`;
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function renderRobotsTxt() {
  return `User-agent: *
Allow: /

Sitemap: ${absoluteUrl("/sitemap.xml")}
`;
}

function renderSitemapXml() {
  const urls = [
    "/",
    "/konserter/",
    "/om-oss/",
    "/dirigenten/",
    "/sjung-med-oss/",
    ...upcomingConcerts.map((concert) => `/konserter/${concert.slug}/`),
  ];

  const entries = urls
    .map((urlPath) => `  <url>
    <loc>${escapeXml(absoluteUrl(urlPath))}</loc>
  </url>`)
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</urlset>
`;
}

async function writeFile(relativePath, content) {
  const target = path.join(publicDir, relativePath);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, content, "utf8");
}

async function main() {
  await writeFile("index.html", renderHomePage());
  await writeFile("konserter/index.html", renderConcertsPage());
  await writeFile("om-oss/index.html", renderAboutPage());
  await writeFile("dirigenten/index.html", renderConductorPage());
  await writeFile("sjung-med-oss/index.html", renderJoinPage());

  for (const concert of upcomingConcerts) {
    await writeFile(
      `konserter/${concert.slug}/index.html`,
      renderConcertDetailPage(concert)
    );
    await writeFile(
      `kalender/${concert.slug}.ics`,
      renderIcsCalendar([concert], `${concert.title} | ${site.name}`)
    );
  }

  await writeFile(
    "kalender/kammarkoren-hogalid.ics",
    renderIcsCalendar(upcomingConcerts, `${site.name} – kommande konserter`)
  );
  await writeFile("robots.txt", renderRobotsTxt());
  await writeFile("sitemap.xml", renderSitemapXml());
}

await main();
