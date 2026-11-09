# Santaishi-tei · Block 7 presentation

These are historical **Block 7** presentation materials. They describe that exercise's implementation and evidence, not the current Block 9 authentication system. For current setup, JWT/email-OTP login, permissions and account deletion, see the [application README](../README.md) and [Block 9 guide](../docs/block9-authentication.md). The slide content and speaker notes remain specific to Block 7.

A 12-slide HTML presentation about server pagination, filtering, sorting, full-text/fuzzy search and the decisions behind the restaurant application.

## Open the slides

Open `index.html` in a browser. No npm install, database connection or `.env` file is needed for the presentation. Keep this directory and its `assets` folder together when copying it to another device.

If local file opening is restricted, serve this directory with a local static server, for example:

```sh
python3 -m http.server 8087 --bind 127.0.0.1
```

Then open `http://127.0.0.1:8087`. Run that command from this presentation directory. This static server is for the slides, not the restaurant web app.

## Controls

- Right/Left arrow or Page Down/Page Up: next/previous slide.
- Home/End: first/last slide.
- Slide selector: jump directly to a topic.
- C: show or hide the navigation bar; Escape: hide it.
- Print / PDF: browser printing, with one slide per page. Enable background graphics for the Japanese scene and paper colors.
- Use the browser's full-screen mode for projection. The deck adapts to smaller windows; browser zoom can also help on a projector.

`speaker-notes.md` contains the separate presentation script, demo checklist, full decision log and evidence notes. Do not project that file. No speaker notes are embedded in the HTML.

## Contents and evidence

`index.html`, `presentation.css` and `presentation.js` provide the slides. `assets/` contains local images copied from the application and its implementation captures. No remote dependencies are required.

The deck covers the final product first, then requirements, dataset preparation, request flow, bounded SQL paging, three pagination modes, search, fuzzy-search bug fixes, UX/bookmark decisions and verification. The deck's recorded automated test results are dated 2 November 2026; historical live-database observations are explicitly dated 26 October 2026.

The [Block 6 presentation](../presentation/README.md) is retained separately. Submission ZIPs are independent snapshots and do not automatically incorporate later application or documentation changes.
