import {
  automationSettings,
  joinPage,
  recruitment,
  site,
} from "./site-data.mjs";
import {
  concertCalendarUrl,
  concertDetailsUrl,
  formatDate,
  formatDateTime,
  formatVoicesWanted,
  getNextConcert,
  writeGeneratedFile,
} from "./editorial-utils.mjs";

const now = new Date();
const nextConcert = getNextConcert(now);

if (!nextConcert) {
  throw new Error("Ingen kommande konsert hittades. Lägg till en kommande konsert i site-data.mjs.");
}

function concertCallToAction(concert) {
  return concert.ticketUrl
    ? `Köp biljett: ${concert.ticketUrl}`
    : `Läs mer och spara datumet: ${concertDetailsUrl(concert)}`;
}

function renderNextConcertCampaign(concert) {
  const detailsUrl = concertDetailsUrl(concert);
  const calendarUrl = concertCalendarUrl(concert);
  const ticketLine = concert.ticketUrl
    ? `Biljettlänk: ${concert.ticketUrl}`
    : "Biljettinformation publiceras snart.";
  const dateLine = `${formatDateTime(concert.start)} · ${concert.venue}`;
  const linkBundle = `${detailsUrl}\nKalender: ${calendarUrl}`;

  return `# Nästa konsertkampanj

Updated: ${now.toISOString()}
Rekommenderad kampanjrytm: ${automationSettings.campaignLeadDays.join(", ")} dagar före konserten

## Konsertöversikt

- Titel: ${concert.title}
- Datum: ${dateLine}
- Plats: ${concert.venue}
- Sammanfattning: ${concert.summary}
- ${ticketLine}

## Länkar att använda

- Concert page: ${detailsUrl}
- Calendar file: ${calendarUrl}
- Google Kalender-länken finns på konsertsidan

## Socialt inlägg 1

${concert.title} i ${concert.venue} ${formatDate(concert.start)}.
${concert.teaser} ${concert.summary}
${concertCallToAction(concert)}

## Socialt inlägg 2

Spara nästa konsert med Kammarkören Högalid redan nu.
${concert.title}
${formatDateTime(concert.start)}
${concert.summary}
${linkBundle}

## Socialt inlägg 3

Vad händer härnäst i Högalid?
${concert.title} ${formatDate(concert.start)}.
${concert.description?.[0] || concert.summary}
${concertCallToAction(concert)}

## Nyhetsbrevsutkast

Ämnesrad: Nästa konsert: ${concert.title} ${formatDate(concert.start)}

Brödtext:

Hej,

Varmt välkommen till nästa konsert med ${site.name}.

${concert.title}
${dateLine}

${concert.description?.[0] || concert.summary}

${ticketLine}
Mer information: ${detailsUrl}
Spara i kalendern: ${calendarUrl}

## Delningstext för korister

Hej! Jag sjunger i ${site.name} och vill gärna tipsa om vår nästa konsert:
${concert.title}, ${dateLine}.
${concert.summary}
${concertCallToAction(concert)}

## Affischtext

Rubrik:
${concert.title}

Underrad:
${formatDateTime(concert.start)} · ${concert.venue}

Brödtext:
${concert.teaser} ${concert.summary}
`;
}

function renderRecruitmentCampaign() {
  const voices = formatVoicesWanted(recruitment.voicesWanted);
  const seasonLabel = recruitment.season ? `${recruitment.season}` : "Aktuell period";

  return `# Rekryteringskampanj

Updated: ${now.toISOString()}

## Rekryteringsöversikt

- Säsong: ${seasonLabel}
- Status: ${recruitment.statusLabel}
- Vi välkomnar: ${voices}
- Körsida: ${new URL("/sjung-med-oss/", site.baseUrl).toString()}
- Intresseanmälan: ${joinPage.formUrl}

## Socialt inlägg

${recruitment.shortPitch}
Just nu välkomnar vi ${voices}.
Vi repeterar torsdagar 18.30–21.30 i Högalids församlingshus.
Läs mer och skicka intresseanmälan: ${new URL("/sjung-med-oss/", site.baseUrl).toString()}

## Nyhetsbrevsutkast

Ämnesrad: Sjung med oss i Kammarkören Högalid

Brödtext:

Hej,

${recruitment.shortPitch}

Just nu välkomnar vi ${voices}.
Hos oss får du arbeta med:
- ${recruitment.campaignAngles.join("\n- ")}

Praktiskt:
- ${joinPage.practicals.join("\n- ")}

Skicka intresseanmälan: ${joinPage.formUrl}
${recruitment.responseNote}

## Delningstext för korister

Jag sjunger i ${site.name} och vi välkomnar just nu ${voices}.
${recruitment.shortPitch}
Tipsa gärna någon som borde höra av sig:
${joinPage.formUrl}

## Snabb checklista

- Uppdatera \`voicesWanted\` i \`scripts/site-data.mjs\` om behovet ändras
- Kontrollera att copy på \`Sjung med oss\` fortfarande matchar aktuell termin
- Håll länken till intresseanmälan uppdaterad
`;
}

const nextConcertPath = await writeGeneratedFile(
  "campaigns/next-concert.md",
  renderNextConcertCampaign(nextConcert)
);

const recruitmentPath = await writeGeneratedFile(
  "campaigns/recruitment.md",
  renderRecruitmentCampaign()
);

console.log(`Genererade kampanjutkast:
- ${nextConcertPath}
- ${recruitmentPath}`);
