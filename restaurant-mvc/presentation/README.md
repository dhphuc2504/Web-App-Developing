# Santaishi-tei presentation package

This folder contains the complete presentation materials:

- `presentation.html`: 16-slide offline browser presentation with embedded images, diagrams, speaker notes and a reference appendix.
- `presentation.md`: detailed rehearsal notes, decision log, schema, endpoints and demo checklist.
- `presentation-assets/`: screenshots and artwork used by the Markdown document, plus a presentation preview.

## Presentation order

The website review comes immediately after the title: entrance and house, dining, kitchen, pantry and administrator office, then design decisions. Scope, workflow, backend, database, HTTP, roles, inventory and verification follow. The live demonstration remains at the end.

## Open in a browser

In Finder, right-click `presentation.html`, choose **Open With**, then **Safari** or **Google Chrome**. No server, database or internet connection is required.

Alternatively, from the `restaurant-mvc` directory, run:

```sh
open -a Safari presentation/presentation.html
```

Use **Left/Right** to change slides, **Home/End** to jump, **N** for notes and **F** to request fullscreen. If browser fullscreen is unavailable, use the browser's normal fullscreen control. The **Reference** button opens the appendix. Click screenshots to enlarge them.

Keep this entire folder together when sharing the Markdown version. The HTML is independently portable because its images, styles and scripts are embedded. Source-code links require the surrounding repository; slides and screenshots work without it.

The materials contain fictional sample staff/stock data. No credentials or `.env` contents are included.
