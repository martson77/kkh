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
- `join_choir`
