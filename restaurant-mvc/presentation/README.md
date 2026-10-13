# 三太子亭 — Santaishi-tei: presentation materials

Presentation and reference material for the **Tam Thái Tử** restaurant database coursework. The materials review the completed website, explain its application workflow, and document the SSR, MVC, Prisma, PRG and role-permission implementation.

## Package contents

| File or directory | Purpose |
| --- | --- |
| [presentation.html](presentation.html) | 16-slide offline browser presentation with editable SVG diagrams, embedded screenshots, speaker notes and a reference appendix |
| [presentation.md](presentation.md) | Detailed slide text, Mermaid diagrams, decision log, field types, HTTP endpoints and demonstration notes |
| `presentation-assets/` | UI screenshots, artwork and a presentation preview used by the Markdown material |

## Presentation structure

| Slides | Subject |
| --- | --- |
| 1 | Project identity and introduction |
| 2–5 | Website review: entrance/house, dining, kitchen, pantry and administrator office |
| 6 | Design decisions and feedback |
| 7 | Application workflow for customers, chefs and administrators |
| 8 | Development workflow |
| 9–11 | Technical stack, MVC/SSR request flow and database relations |
| 12–14 | HTTP/PRG/DELETE, permissions and inventory transactions |
| 15–16 | Verification and live demonstration |

The reference appendix contains the full decision log, all database scalar fields and SQL types, endpoint tables, additional screenshots, questions and answers, and local project sources.

## Browser viewing

Open `presentation.html` in Safari, Google Chrome or another modern browser. The file embeds its styles, scripts and images, so viewing requires no server, database connection or internet access.

On macOS, Finder supports **Open With → Safari / Google Chrome**. From the presentation folder, the equivalent terminal command is:

```sh
open -a Safari presentation.html
```

| Control | Action |
| --- | --- |
| Left / Right or Previous / Next | Change slide |
| Home / End | Jump to the first / last slide |
| Slide selector | Open a specific slide |
| N or Notes | Show or hide speaker notes |
| F or Fullscreen | Request browser fullscreen |
| Reference | Open the appendix |
| Screenshot | Enlarge the complete image |
| Print | Print the slides and reference appendix |

Browser-native fullscreen remains available when the Fullscreen API is restricted. The Markdown companion provides complete rehearsal notes for printing or reading alongside the slides.

## Demonstration and assessment

Suggested duration is 10–12 minutes for the presentation and about 3 minutes for a demonstration. The demonstration covers public menu browsing, recipe editing, stock usage and ledgers, administrator permissions, and the DELETE/303/GET sequence.

A live demonstration requires the configured product application and prepared staff accounts with sample records. Saved screenshots provide an offline alternative. The package contains fictional staff and stock data rather than live account credentials.

## Portability and sources

The entire presentation folder can be moved outside `restaurant-mvc` or copied to another computer. Keep its structure intact:

```text
presentation/
├── README.md
├── presentation.html
├── presentation.md
└── presentation-assets/
```

The HTML embeds its styles, scripts, diagrams and images and works as a single file. The Markdown document uses relative links to `presentation-assets/`, so it requires that directory beside it. Mermaid diagrams require a compatible Markdown viewer. The HTML renders its SVG diagrams without additional software.

Project source references are labeled paths in the original repository, rather than links that depend on the folder's location. Application behavior and setup remain documented in `restaurant-mvc/README.md`. Artwork provenance remains documented in `restaurant-mvc/public/images/japan/ASSETS.md`.

Moving this folder does not affect the application runtime. Links to the presentation in the product README should be updated if the folder moves to a different location. A live demonstration still requires the separately configured application.

Screenshots represent the implemented UI with fictional sample records. Restaurant and food imagery is generated artwork. Credentials and runtime environment files are outside this package.
