# Post-launch GA4 checklist

Use this checklist for the new site from 23 March 2026 and forward.

## 1. Treat 23 March 2026 as the new baseline

- In GA4, compare data from `2026-03-23` and forward.
- Do not compare page performance directly with the pre-launch snapshot without noting that the site structure changed.

## 2. Register custom dimensions

Create event-scoped custom dimensions for:

- `cta_name`
- `cta_location`
- `cta_label`
- `page_type`

`destination` is sent as an event parameter too, but it will likely become high-cardinality. Only register it if you have a specific reporting need.

## 3. Mark these events as key events

The frontend now sends both a generic `cta_click` event and specific event names for each CTA.

Mark these as key events in GA4:

- `add_to_calendar`
- `add_to_calendar_feed`
- `buy_ticket`
- `download_poster`
- `join_choir`
- `share_concert`
- `copy_link`
- `ticket_alert_interest`

## 4. Build two reports

### Audience report

Use dimensions:

- `Page path + query string`
- `Page title`
- `page_type`

Use metrics:

- `Users`
- `Views`
- `Engaged sessions`
- `Key events`

### CTA report

Use dimensions:

- `Event name`
- `cta_name`
- `cta_location`
- `cta_label`

Use metrics:

- `Event count`
- `Total users`

## 5. Review after 2-4 weeks

Focus on:

- traffic to `/konserter/`
- traffic to the current concert page
- `add_to_calendar`
- `ticket_alert_interest`
- `join_choir`

## 6. Low-manual ticket alert workflow

The current site uses a low-maintenance temporary solution when no ticket link exists.

User flow:

- Visitor clicks `Få besked om biljetter`
- Their email client opens with a pre-filled subject and message
- They send the email to `kammarkorenhogalid@gmail.com`

Suggested admin workflow:

1. In Gmail, create a filter for the subject prefix `Biljettbesked:`.
2. Apply a label such as `Biljettbesked`.
3. When the ticket link is published, send one BCC email to everyone with that label.

This keeps the workflow simple until a dedicated signup form is needed.
