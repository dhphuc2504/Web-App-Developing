# Exercise 01 — Team Portfolio

A static portfolio website presenting one team and the individual portfolios of its three members. This project is an exercise for the **Webapp Developing** course and is intended to become a polished, deployable product.

## Project status

The project is currently in the planning stage. Product requirements, architecture, design guidance, content placeholders, and implementation tasks are documented before coding begins.

## Product scope

Visitors must be able to:

- Understand who the team is and what it does.
- See an overview of all three team members.
- Open a dedicated portfolio page for each member.
- Move between the team page and member pages without confusion.

The site will contain four pages:

- `index.html` — team portfolio and member directory.
- `members/member-1.html` — first member's portfolio.
- `members/member-2.html` — second member's portfolio.
- `members/member-3.html` — third member's portfolio.

## Technology

- Semantic HTML5
- Modern CSS3
- Vanilla JavaScript
- Static hosting, with GitHub Pages as the recommended target

No framework, package manager, build tool, database, server, or external API is required.

## Documentation

- [Requirements](docs/REQUIREMENTS.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Design specification](docs/DESIGN.md)
- [Content template](docs/CONTENT.md)
- [Implementation tasks](docs/TASKS.md)
- [Agent working agreement](AGENTS.md)

## Planned source structure

```text
exercise-01-team-portfolio/
├── index.html
├── members/
│   ├── member-1.html
│   ├── member-2.html
│   └── member-3.html
├── assets/
│   ├── css/
│   │   ├── main.css
│   │   ├── team.css
│   │   └── member.css
│   ├── js/
│   │   └── main.js
│   ├── images/
│   │   ├── team/
│   │   └── members/
│   │       ├── member-1/
│   │       ├── member-2/
│   │       └── member-3/
│   └── icons/
├── docs/
├── AGENTS.md
└── README.md
```

## Running the finished site

Because this will be a static site, it can be opened directly through `index.html`. During development, use a small local static server so nested paths and assets behave the same way they will after deployment.

## Content policy

Real team and member information must come from the project owners. Until that information is available, use clearly marked placeholders from `docs/CONTENT.md`. Do not invent achievements, employers, client work, contact details, or social links.
