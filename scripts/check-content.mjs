import {
  automationSettings,
  joinPage,
  recruitment,
} from "./site-data.mjs";
import {
  daysUntil,
  formatDateTime,
  getNextConcert,
  getUpcomingConcerts,
  writeGeneratedFile,
} from "./editorial-utils.mjs";

const now = new Date();
const issues = [];

function addIssue(severity, title, details) {
  issues.push({ severity, title, details });
}

function validateConcert(concert) {
  const requiredFields = [
    "slug",
    "title",
    "summary",
    "start",
    "venue",
    "address",
    "heroImage",
    "socialImage",
  ];

  for (const field of requiredFields) {
    if (!concert[field]) {
      addIssue(
        "critical",
        `Missing concert field: ${field}`,
        `The next concert is missing \`${field}\`.`
      );
    }
  }

  if (!concert.description?.length) {
    addIssue(
      "warning",
      "Next concert has no descriptive paragraphs",
      "Add at least one paragraph to improve the concert detail page and campaign texts."
    );
  }

  if (!concert.program?.length) {
    addIssue(
      "warning",
      "Next concert has no program list",
      "Add at least one program line in scripts/site-data.mjs."
    );
  }

  if (!concert.performers?.length) {
    addIssue(
      "warning",
      "Next concert has no performers list",
      "Add performers so the concert detail page and event schema stay complete."
    );
  }

  const leadDays = daysUntil(concert.start, now);

  if (
    leadDays <= automationSettings.staleConcertThresholdDays &&
    !concert.ticketUrl &&
    concert.ticketAlert !== false
  ) {
    addIssue(
      "warning",
      "Ticket link missing close to concert date",
      `The next concert is ${leadDays} days away and still has no ticket URL.`
    );
  }
}

const upcomingConcerts = getUpcomingConcerts(now);
const nextConcert = getNextConcert(now);

if (!nextConcert) {
  addIssue(
    "critical",
    "No upcoming concert found",
    "Add a future concert with a slug to scripts/site-data.mjs so the homepage and campaign scripts have a primary event."
  );
} else {
  validateConcert(nextConcert);
}

if (!upcomingConcerts.length) {
  addIssue(
    "warning",
    "No upcoming concerts in the season feed",
    "The season calendar feed will be empty until at least one future concert is added."
  );
}

if (!recruitment.active) {
  addIssue(
    "warning",
    "Recruitment is marked inactive",
    "If you are currently looking for singers, set recruitment.active to true in scripts/site-data.mjs."
  );
}

if (recruitment.active && !joinPage.formUrl) {
  addIssue(
    "critical",
    "Recruitment form URL missing",
    "Recruitment is active but the join form URL is empty."
  );
}

if (!joinPage.practicals?.length) {
  addIssue(
    "warning",
    "Join page has no practical information",
    "Add rehearsal details so the recruitment page answers the main practical questions."
  );
}

const criticalCount = issues.filter((issue) => issue.severity === "critical").length;
const warningCount = issues.filter((issue) => issue.severity === "warning").length;

const report = `# Innehållskontroll

Updated: ${now.toISOString()}

## Sammanfattning

- Kritiska problem: ${criticalCount}
- Varningar: ${warningCount}
- Nästa konsert: ${
  nextConcert ? `${nextConcert.title} (${formatDateTime(nextConcert.start)})` : "Ingen"
}

## Resultat

${
  issues.length
    ? issues
        .map(
          (issue) => `### ${issue.severity.toUpperCase()}: ${issue.title}

${issue.details}`
        )
        .join("\n\n")
    : "Inga problem hittades."
}
`;

const reportPath = await writeGeneratedFile("reports/content-check.md", report);

console.log(`Innehållsrapport skriven till ${reportPath}`);

if (!issues.length) {
  console.log("Inga problem hittades.");
} else {
  for (const issue of issues) {
    const prefix = issue.severity === "critical" ? "CRITICAL" : "WARNING";
    console.log(`${prefix}: ${issue.title}`);
  }
}

if (criticalCount > 0) {
  process.exitCode = 1;
}
