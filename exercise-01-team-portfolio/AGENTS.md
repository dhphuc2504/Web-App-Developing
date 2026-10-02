# Agent Working Agreement

These instructions apply to every file inside `exercise-01-team-portfolio/`.

## Mission

Build a polished static portfolio website for one team and its three members. Favor clarity, accessibility, maintainability, and reliable deployment over unnecessary technical complexity.

Before making changes, read:

1. `README.md`
2. `docs/REQUIREMENTS.md`
3. `docs/ARCHITECTURE.md`
4. `docs/DESIGN.md`
5. `docs/CONTENT.md`
6. `docs/TASKS.md`

If documents disagree, follow this priority order:

1. The user's latest explicit instruction
2. `docs/REQUIREMENTS.md`
3. `docs/ARCHITECTURE.md`
4. `docs/DESIGN.md`
5. `docs/TASKS.md`

## Technical boundaries

- Use semantic HTML5, CSS3, and vanilla JavaScript only.
- Do not add frameworks, CSS libraries, package managers, build tools, databases, servers, or third-party APIs unless the user changes the requirements.
- Do not implement client-side routing. Every portfolio is a normal HTML page.
- Keep essential content and navigation functional without JavaScript.
- Use JavaScript only for progressive enhancements such as the responsive navigation menu and active navigation state.
- Do not generate page content from JavaScript.
- Do not duplicate shared styles when a reusable class is appropriate.
- Do not use inline CSS or inline JavaScript.
- Do not add tracking, analytics, cookies, forms, or data collection.

## Content rules

- Never invent personal information, credentials, achievements, projects, contact details, or social links.
- Use `docs/CONTENT.md` as the source of truth for supplied content.
- When content is missing, keep a conspicuous placeholder such as `[Member 1 name]`; do not disguise placeholder content as a fact.
- Do not publish private information unless the user explicitly provides and approves it.
- Give every meaningful image accurate alternative text. Use empty alternative text only for decorative images.

## HTML rules

- Use one `h1` per page and a logical heading hierarchy.
- Include `header`, `nav`, `main`, and `footer` landmarks.
- Add a skip link as the first focusable element.
- Identify the current page with `aria-current="page"` where appropriate.
- Use links for navigation and buttons for actions.
- Keep repeated navigation labels and destinations consistent across all pages.
- Use relative paths that work from both the root page and pages inside `members/`.
- Add useful page titles and descriptions.

## CSS rules

- Follow the mobile-first design in `docs/DESIGN.md`.
- Store shared tokens as custom properties in `assets/css/main.css`.
- Keep global foundations and reusable components in `main.css`.
- Keep team-page-only rules in `team.css` and member-page-only rules in `member.css`.
- Prefer Grid and Flexbox for layout.
- Avoid unexplained magic numbers and excessive selector specificity.
- Provide obvious hover, active, and keyboard focus states.
- Respect `prefers-reduced-motion`.
- Prevent horizontal overflow at narrow viewport widths.

## JavaScript rules

- Keep the script small and dependency-free.
- Load it with `defer`.
- Enhance existing HTML instead of constructing primary content.
- Ensure mobile-menu controls have accurate `aria-expanded` and accessible labels.
- Do not fail if an optional element is absent from a page.
- Avoid browser storage unless a future requirement needs it.

## Asset rules

- Put assets in the directory defined by `docs/ARCHITECTURE.md`.
- Use lowercase kebab-case filenames.
- Optimize images and prefer WebP or AVIF when practical.
- Specify image dimensions to reduce layout movement.
- Do not hotlink images from third-party websites.
- Do not add copyrighted material without permission.

## Working method

- Keep changes focused on the assigned task.
- Preserve valid work made by other contributors.
- Check existing files before changing shared styles or navigation.
- If a requirement is unclear, choose the smallest reversible implementation and document the assumption.
- Do not silently expand the product scope.
- Update relevant documentation when an approved architectural decision changes.

## Required verification

Before declaring implementation complete:

- Open all four pages and follow every navigation link.
- Check that every local image, stylesheet, and script loads without a missing-file error.
- Check mobile, tablet, and desktop widths.
- Navigate the entire site using only a keyboard.
- Confirm visible focus indicators and logical focus order.
- Confirm the mobile menu works and closes appropriately.
- Check heading order, alternative text, page titles, and landmarks.
- Confirm there is no unintended horizontal scrolling.
- Confirm the browser console has no errors.
- Confirm the site works from its intended static hosting subpath, not only from `/`.

## Definition of done

A task is done only when its implementation, responsive behavior, accessibility, and links have been verified. Completing markup without checking the rendered result is not sufficient.
