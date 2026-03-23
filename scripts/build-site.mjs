import fs from "node:fs/promises";
import path from "node:path";
import {
  aboutPage,
  choirFacts,
  concerts,
  conductorPage,
  futureProjects,
  joinPage,
  proofCards,
  site,
} from "./site-data.mjs";

const rootDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const publicDir = path.join(rootDir, "public");
const assetVersion = "20260323-aboutphoto";

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
      <div class="menu-button w-nav-button"><img src="/assets/external/cdn.prod.website-files.com/66138d74ede779973813c4af/66138d74ede779973813c51c_menu-icon.png" width="22" alt="Ikon med tre horisontella streck som symboliserar en meny." class="menu-icon"/></div>
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
}) {
  const canonical = absoluteUrl(urlPath);
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
<link href="/assets/external/cdn.prod.website-files.com/66138d74ede779973813c4af/css/kammarkoren-hogalid.webflow.shared.32559a67a.min.css" rel="stylesheet" type="text/css"/>
<link href="/assets/app.css?v=${assetVersion}" rel="stylesheet" type="text/css"/>
<link href="https://fonts.googleapis.com" rel="preconnect"/>
<link href="https://fonts.gstatic.com" rel="preconnect"/>
<script src="https://ajax.googleapis.com/ajax/libs/webfont/1.6.26/webfont.js" type="text/javascript"></script>
<script type="text/javascript">WebFont.load({google:{families:["Montserrat:100,100italic,200,200italic,300,300italic,400,400italic,500,500italic,600,600italic,700,700italic,800,800italic,900,900italic"]}});</script>
<script type="text/javascript">!function(o,c){var n=c.documentElement,t=" w-mod-";n.className+=t+"js",("ontouchstart"in o||o.DocumentTouch&&c instanceof DocumentTouch)&&(n.className+=t+"touch")}(window,document);</script>
<link href="${site.favicon}" rel="shortcut icon" type="image/x-icon"/>
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
}) {
  return `<!DOCTYPE html>
<html lang="sv">
<head>
${renderHead({ pageTitle, description, urlPath, image, ogTitle, ogDescription, jsonLd })}
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
}) {
  return `<a href="${href}" class="cta-button cta-button--${variant}"${
    track ? ` data-track="${track}"` : ""
  }${location ? ` data-track-location="${location}"` : ""}${
    newTab ? ' target="_blank" rel="noreferrer"' : ""
  }>${label}</a>`;
}

function hasTicketLink(concert) {
  return Boolean(concert.ticketUrl);
}

function ticketPanelCopy(concert) {
  if (hasTicketLink(concert)) {
    return "Biljetter via Tickster. Lägg konserten i kalendern direkt så missar du den inte.";
  }

  return "Biljettinformation publiceras snart. Lägg konserten i kalendern redan nu så missar du den inte.";
}

function concertCalendarDetails(concert) {
  const detailsUrl = absoluteUrl(
    concert.slug ? `/konserter/${concert.slug}/` : "/konserter/"
  );
  const ticketLine = hasTicketLink(concert)
    ? `Biljetter: ${concert.ticketUrl}`
    : "Biljettinformation publiceras snart.";

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

function renderFactStrip() {
  return `<section class="fact-strip">
  <div class="site-container fact-grid">
    ${choirFacts
      .map(
        (fact) => `<article class="fact-card">
      <p class="fact-value">${fact.value}</p>
      <p class="fact-label">${fact.label}</p>
    </article>`
      )
      .join("")}
  </div>
</section>`;
}

function renderPastConcertCard(concert) {
  return `<article class="concert-card concert-card--past">
  ${
    concert.image
      ? `<img src="${concert.image}" alt="${escapeHtml(
          concert.imageAlt || concert.title
        )}" class="concert-card-image"/>`
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
    <div class="site-container hero-grid">
      <div class="hero-copy">
        <p class="eyebrow">Nästa konsert i Högalidskyrkan</p>
        <h1 class="hero-title">${nextConcert.title}</h1>
        <p class="hero-meta">${formatDateTime(nextConcert.start)} · ${nextConcert.venue}</p>
        <p class="hero-lead">${nextConcert.teaser} ${nextConcert.summary}</p>
        <div class="hero-actions">
          ${
            hasTicketLink(nextConcert)
              ? button({
                  href: nextConcert.ticketUrl,
                  label: "Köp biljett",
                  track: "buy_ticket",
                  location: "home_hero",
                  newTab: true,
                })
              : ""
          }
          ${button({
            href: `/konserter/${nextConcert.slug}/`,
            label: "Se konsertinfo",
            variant: "secondary",
            location: "home_hero",
          })}
          ${button({
            href: `/kalender/${nextConcert.slug}.ics`,
            label: "Spara i kalendern",
            variant: "ghost",
            track: "add_to_calendar",
            location: "home_hero",
          })}
        </div>
        <ul class="inline-list">
          <li>${nextConcert.price}</li>
          <li>${nextConcert.venue}</li>
          <li>Spara enkelt i din kalender</li>
        </ul>
      </div>
      <div class="hero-media">
        <img src="${nextConcert.heroImage}" alt="${escapeHtml(
          nextConcert.heroImageAlt
        )}" class="hero-image"/>
        <aside class="highlight-panel">
          <p class="highlight-panel-kicker">Planera besöket</p>
          <h2 class="highlight-panel-title">${
            hasTicketLink(nextConcert)
              ? "Säkra din plats och håll datumet."
              : "Spara datumet och håll utkik."
          }</h2>
          <p class="highlight-panel-copy">${ticketPanelCopy(nextConcert)}</p>
          <div class="highlight-panel-actions">
            ${
              hasTicketLink(nextConcert)
                ? button({
                    href: nextConcert.ticketUrl,
                    label: "Till Tickster",
                    track: "buy_ticket",
                    location: "home_panel",
                    newTab: true,
                  })
                : button({
                    href: `/konserter/${nextConcert.slug}/`,
                    label: "Se konsertinfo",
                    variant: "secondary",
                  })
            }
          </div>
        </aside>
      </div>
    </div>
  </section>
  ${renderFactStrip()}
  <section class="section-block">
    <div class="site-container section-grid">
      <div>
        <p class="eyebrow">Kort om kören</p>
        <h2 class="section-title">Ambitiös körmusik med värme och närvaro.</h2>
        <p class="section-copy">${aboutPage.intro}</p>
        <p class="section-copy">${aboutPage.paragraphs[0]}</p>
        <div class="section-actions">
          ${button({ href: "/om-oss/", label: "Läs mer om kören", variant: "secondary" })}
        </div>
      </div>
      <div class="media-card">
        <img src="${site.choirImage}" alt="${escapeHtml(site.choirImageAlt)}" class="media-card-image"/>
      </div>
    </div>
  </section>
  <section class="section-block section-block--muted">
    <div class="site-container section-grid section-grid--reverse">
      <div class="media-card media-card--portrait">
        <img src="${site.conductorImage}" alt="${escapeHtml(site.conductorImageAlt)}" class="media-card-image"/>
      </div>
      <div>
        <p class="eyebrow">Vår dirigent</p>
        <h2 class="section-title">Benedikt Melichar leder kören med både upptäckarglädje och precision.</h2>
        <p class="section-copy">${conductorPage.intro}</p>
        <p class="section-copy">${conductorPage.paragraphs[0]}</p>
        <div class="section-actions">
          ${button({ href: "/dirigenten/", label: "Läs mer om Benedikt", variant: "secondary" })}
        </div>
      </div>
    </div>
  </section>
  <section class="section-block">
    <div class="site-container section-grid">
      <div>
        <p class="eyebrow">Sjung med oss</p>
        <h2 class="section-title">Nyfiken på att bli en del av Kammarkören Högalid?</h2>
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
        <h3>Det här väntar dig</h3>
        <ul class="bullet-list">
          ${joinPage.practicals.map((item) => `<li>${item}</li>`).join("")}
        </ul>
      </div>
    </div>
  </section>
  <section class="section-block section-block--muted">
    <div class="site-container">
      <div class="section-heading">
        <p class="eyebrow">Varför publiken hittar hit</p>
        <h2 class="section-title">Ett aktivt musikliv med tydlig förankring i Högalid.</h2>
      </div>
      <div class="proof-grid">
        ${proofCards
          .map(
            (card) => `<article class="proof-card">
          <h3>${card.title}</h3>
          <p>${card.body}</p>
        </article>`
          )
          .join("")}
      </div>
    </div>
  </section>
</main>`;

  return renderLayout({
    pageTitle: `${site.name} | Nästa konsert i Högalidskyrkan`,
    description: `${nextConcert.title} ${formatShortDateTime(
      nextConcert.start
    )} i ${nextConcert.venue}. Läs mer och lägg konserten i kalendern.`,
    urlPath: "/",
    currentPath: "/",
    image: nextConcert.socialImage,
    ogTitle: `${nextConcert.title} | ${site.name}`,
    ogDescription: nextConcert.summary,
    pageType: "home",
    jsonLd,
    body,
  });
}

function renderConcertsPage() {
  const body = `<main>
  <section class="page-header">
    <div class="site-container page-header-grid">
      <div>
        <p class="eyebrow">Konserter</p>
        <h1 class="page-title">Här hittar du nästa konsert med Kammarkören Högalid.</h1>
        <p class="page-lead">Se vad som spelas härnäst, läs om programmet och spara datumet direkt i din kalender. Längre ner hittar du också ett urval av tidigare konserter.</p>
      </div>
      <aside class="calendar-panel">
        <p class="calendar-panel-kicker">Missa inte nästa datum</p>
        <h2 class="calendar-panel-title">Lägg till våra kommande konserter i din kalender.</h2>
        <p class="calendar-panel-copy">Du kan antingen spara kalenderfilen själv eller prenumerera så att nya datum dyker upp automatiskt när vi lägger ut dem.</p>
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
        <p class="eyebrow">Nästa att uppleva</p>
        <h2 class="section-title">Det här är konserten du kan planera för nu.</h2>
      </div>
      <div class="concert-list">
        ${upcomingConcerts
          .map(
            (concert) => `<article class="concert-card concert-card--upcoming">
          <img src="${concert.heroImage}" alt="${escapeHtml(
              concert.heroImageAlt
            )}" class="concert-card-image"/>
          <div class="concert-card-body">
            <p class="concert-card-kicker">${
              upcomingConcerts.length === 1 ? "Nästa konsert" : "Kommande konsert"
            }</p>
            <h3 class="concert-card-title">${concert.title}</h3>
            <p class="concert-card-meta">${formatDateTime(concert.start)} · ${concert.venue}</p>
            <p class="concert-card-copy">${concert.summary}</p>
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
        <h3>Det här vet vi nu</h3>
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
  });
}

function renderConcertDetailPage(concert) {
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
        <p class="eyebrow">Nästa konsert</p>
        <h1 class="page-title">${concert.title}</h1>
        <p class="page-lead">${concert.teaser} ${concert.summary}</p>
        <p class="event-meta">${formatDateTime(concert.start)} · ${concert.venue}</p>
      </div>
      <div class="media-card">
        <img src="${concert.heroImage}" alt="${escapeHtml(
          concert.heroImageAlt
        )}" class="media-card-image"/>
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
          <p class="aside-label">${
            hasTicketLink(concert) ? "Boka eller spara" : "Spara konserten"
          }</p>
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
        <img src="${image}" alt="${escapeHtml(imageAlt || title)}" class="media-card-image"/>
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
      <h2>Det här kännetecknar kören</h2>
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
      <p class="eyebrow">Det här präglar kören</p>
      <h2 class="section-title">Klang, koncentration och gemenskap.</h2>
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
      <p class="calendar-panel-kicker">Ta kontakt</p>
      <h2 class="calendar-panel-title">Vi vill gärna höra från dig.</h2>
      <p class="calendar-panel-copy">Skicka en intresseanmälan via Svenska kyrkans formulär eller mejla oss direkt om du vill veta mer inför nästa provsjungning.</p>
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
        : `${concert.summary}\n\nBiljettinformation publiceras snart.\nMer information: ${detailsUrl}`;
      return `BEGIN:VEVENT
UID:${concert.slug || concert.title.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-")}@kammarkorenhogalid.se
DTSTAMP:${toIcsTimestamp(new Date().toISOString())}
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
}

await main();
