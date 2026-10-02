# Architecture

## 1. Architectural decision

Use a static multi-page website with four HTML documents and shared assets.

```text
Team home page
├── Member 1 portfolio
├── Member 2 portfolio
└── Member 3 portfolio
```

This architecture matches the small product scope, provides real URLs for every portfolio, works without client-side routing, and can be deployed to any static host.

## 2. Technology decisions

| Area | Decision | Reason |
| --- | --- | --- |
| Markup | Semantic HTML5 | Native accessibility and clear document structure |
| Styling | Plain CSS3 | Small scope and no dependency overhead |
| Behavior | Vanilla JavaScript | Only lightweight progressive enhancement is needed |
| Navigation | Normal relative links | Reliable, bookmarkable, and functional without JavaScript |
| Content | Written directly in HTML | Easy to inspect and accessible without runtime rendering |
| Hosting | Static hosting | No backend or dynamic data is required |

## 3. Planned directory structure

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
│   ├── REQUIREMENTS.md
│   ├── ARCHITECTURE.md
│   ├── DESIGN.md
│   ├── CONTENT.md
│   └── TASKS.md
├── AGENTS.md
└── README.md
```

Do not create empty asset directories merely to reproduce the tree. Create them when their first real file is added.

## 4. Page responsibilities

### `index.html`

Acts as both the landing page and the general team portfolio. Its recommended section order is:

1. Skip link
2. Global header and navigation
3. Team hero
4. About the team
5. Team capabilities or skills
6. Shared work or projects, if supplied
7. Three-member directory
8. Optional contact or closing call to action
9. Global footer

### `members/member-N.html`

Each member page uses the same semantic outline:

1. Skip link
2. Global header and navigation
3. Member introduction
4. About the member
5. Skills
6. Education or experience, if supplied
7. Personal projects, if supplied
8. Approved contact links, if supplied
9. Previous/next member navigation or a link back to the team
10. Global footer

Sections without real content should be omitted unless a visible placeholder is specifically needed during development.

## 5. CSS organization

### `main.css`

Contains site-wide foundations:

- Design tokens and custom properties
- Reset or normalization rules
- Typography
- Base element styles
- Shared container and section layouts
- Header, navigation, footer, buttons, cards, tags, and project components
- Focus states and accessibility utilities
- General responsive utilities
- Reduced-motion handling

Organize the file into labeled sections rather than importing many tiny stylesheets.

### `team.css`

Contains only rules unique to the team page, such as its hero composition, team capability layout, and member-directory arrangement.

### `member.css`

Contains rules shared by all member pages, including profile heroes, skill groups, project listings, timelines, and member-to-member navigation.

Every page loads `main.css` first and at most one page-specific stylesheet second.

## 6. JavaScript organization

Use one deferred script: `assets/js/main.js`.

Permitted responsibilities:

- Open and close the mobile navigation
- Synchronize `aria-expanded` and related accessible state
- Close the mobile menu after a navigation choice
- Close it on Escape or when focus must return to the toggle
- Add small enhancements that remain optional to the core experience

Do not use JavaScript to:

- Render biographies or projects
- Fetch local JSON for essential content
- Simulate page routing
- Duplicate native link or browser behavior
- Add animation that harms usability

## 7. Path conventions

The site may be hosted below a repository path, for example:

```text
https://example.github.io/team-portfolio/
```

Therefore, do not assume that the site is hosted at the domain root.

From `index.html`, shared assets use paths such as:

```text
assets/css/main.css
members/member-1.html
```

From a page inside `members/`, paths use:

```text
../assets/css/main.css
../index.html
```

Do not use root-relative paths such as `/assets/css/main.css`.

## 8. Shared interface consistency

The header and footer markup will be repeated in each HTML document because no build process is allowed. Keep these blocks intentionally small and update all four pages whenever shared navigation changes.

The repeated markup must preserve:

- Identical link labels
- Identical destinations adjusted only for path depth
- Identical menu control attributes
- Correct `aria-current` state for each page

## 9. Enhancement strategy

The baseline experience consists of readable documents and working links. CSS adds layout and presentation. JavaScript adds convenience on small screens.

```text
HTML content and links
        ↓
CSS presentation and responsive layout
        ↓
JavaScript convenience enhancements
```

A failure at a higher layer must not remove the functionality supplied by a lower layer.

## 10. Key tradeoffs

- Repeated header and footer markup is accepted to avoid a build system or runtime content injection.
- Member content stays in HTML rather than a shared data file because there are only three pages and accessibility should not depend on JavaScript.
- Page-specific CSS files are retained to make ownership clear without fragmenting the small global stylesheet excessively.
- Framework conventions are intentionally avoided because the exercise assesses the fundamentals of HTML, CSS, and JavaScript.
