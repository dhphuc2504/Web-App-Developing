# Santaishi-tei — Block 6 presentation

Open `index.html` directly in a browser. No application server, database, internet connection or credentials are required. Keep the whole folder together when copying or moving it.

## Presenting

The toolbar is visible by default, with a slide selector for jumping directly to any topic. Press **C** to show or hide it, or **Escape** to hide it. Arrow keys work with the toolbar hidden.

- Arrow keys, Page Up/Down or the arrow buttons: previous/next slide.
- Home / End: first/last slide.
- Slide selector: jump to a topic.
- Presenter script: `speaker-notes.md` is separate from the projected HTML. Use a second device or printed copy; do not open it on the projected screen.
- Print / PDF: print all 14 slides in landscape format. Enable background graphics in the browser print dialog. Print the script separately if needed.

Suggested length: 12–15 minutes including a three-minute live demo. Prepare the application and designated demo accounts separately. No credentials are included in these materials.

## Contents and evidence

The product review comes before architecture and backend details. Slides cover the development timeline, SSR/CSR workflows, MVC responsibilities, REST response contract, three error layers, loading and navigation, data relationships, permissions, decision log and demonstration sequence.

Screenshots are copied from the project's existing `docs` evidence. Directory and exterior images are project artwork and are labeled accordingly. Screenshots show previously captured states, not a fresh production session. The reported 38 passing tests and successful temporary Storage check refer to the completed implementation verification on 19 October 2026; the presentation does not imply a new test run.

Technical content was checked against `src/routes/index.js`, `prisma/schema.prisma`, project rules, and the documented implementation history. Diagrams are editable HTML/CSS. All assets, scripts and styles are local, with no CDN or external font dependency.

## Editing

Edit slide content in `index.html` and the separate speaking script in `speaker-notes.md`. The HTML contains no speaker notes or links to the speaking script. Styling is in `presentation.css`, and navigation is in `presentation.js`. `assets/` contains only copied presentation images.
