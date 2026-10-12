# Implementation Tasks

This plan is ordered by dependency. An agent should complete and verify one phase before moving to the next, unless the user explicitly assigns independent phases in parallel.

## Phase 0 — Confirm inputs

### T-001: Audit content

- Read `CONTENT.md`.
- Identify which team, member, project, image, and link fields are available.
- Report missing information without inventing replacements.
- Confirm the final member names used for page titles and navigation.

**Done when:** available and missing content is clearly identified and sensitive details are not assumed to be public.

### T-002: Confirm visual direction

- Propose a small palette and typography choice consistent with `DESIGN.md`.
- Confirm whether each member should share the team accent or receive a restrained accent variation.
- Identify available portraits and team imagery.

**Done when:** the design direction can be represented through named CSS tokens and does not depend on unapproved assets.

## Phase 1 — Foundation

### T-101: Create the source structure

- Create the HTML, CSS, JavaScript, and necessary asset directories described in `ARCHITECTURE.md`.
- Create only directories that contain actual files.
- Preserve the existing documentation.

**Done when:** all planned source files exist in the correct locations and no unnecessary dependency files have been added.

### T-102: Build global CSS foundations

- Add a small reset.
- Define semantic color, typography, spacing, radius, shadow, and width tokens.
- Implement body typography, containers, sections, links, buttons, cards, skip link, and focus states.
- Add reduced-motion behavior.

**Done when:** shared primitives render correctly in isolation and the page has no horizontal overflow at 320 px.

### T-103: Build the shared header and footer

- Create semantic header, navigation, and footer markup.
- Include links to the team and all three members.
- Adapt relative paths for root and nested pages.
- Mark the current page correctly.
- Add accessible responsive-navigation markup.

**Done when:** the repeated blocks are structurally consistent across all four pages and every link resolves correctly.

### T-104: Implement navigation enhancement

- Add the mobile-menu behavior in `assets/js/main.js`.
- Keep desktop navigation usable without JavaScript.
- Synchronize `aria-expanded` state.
- Support Escape and sensible focus restoration.
- Avoid errors on pages where optional elements are absent.

**Done when:** the menu works with pointer and keyboard input, and disabling JavaScript does not block page navigation.

## Phase 2 — Team page

### T-201: Implement team-page structure

- Add metadata, skip link, shared header, main sections, and shared footer.
- Implement the team hero, about section, capabilities, shared work when supplied, and member directory.
- Keep all factual content sourced from `CONTENT.md`.

**Done when:** the page satisfies FR-01 through FR-03 and presents exactly three member cards.

### T-202: Style the team page

- Add team-specific hero and section layouts in `team.css`.
- Make member cards equally prominent.
- Ensure cards and calls to action work at small and large widths.

**Done when:** the page follows `DESIGN.md` and remains readable from 320 px upward.

## Phase 3 — Member pages

### T-301: Implement the shared member-page pattern

- Build one accessible member page using the agreed structure.
- Add profile, biography, skills, optional experience or education, projects, approved links, and portfolio navigation.
- Omit unsupported sections rather than inventing entries.

**Done when:** the first member page satisfies FR-04 and serves as a stable pattern for the remaining pages.

### T-302: Implement Member 2 and Member 3

- Reuse the structural pattern from the first member page.
- Insert each member's approved content and assets.
- Set unique metadata, headings, alternative text, and current-page navigation.

**Done when:** all three pages represent the correct person and do not contain copied details from another member.

### T-303: Style member pages

- Implement shared profile, skill, experience, project, contact, and portfolio-navigation layouts in `member.css`.
- Apply only approved accent variations.
- Support different content lengths without brittle fixed heights.

**Done when:** the pages are visibly related, individually identifiable, and stable with short or long content.

## Phase 4 — Content and asset refinement

### T-401: Integrate final assets

- Add optimized local images to their prescribed directories.
- Use clear lowercase kebab-case filenames.
- Supply image width, height, and appropriate alternative text.
- Remove superseded or unused assets.

**Done when:** all images load locally, are permitted for use, and avoid obvious layout shift.

### T-402: Perform content review

- Replace all bracketed placeholders with approved content or remove the unsupported section.
- Check names, roles, dates, spelling, tone, and link destinations.
- Ensure public contact information was intentionally supplied.

**Done when:** a search for placeholder markers returns no unintended production placeholders and every claim is supported.

## Phase 5 — Quality assurance

### T-501: Navigation and link audit

- Open all four pages from a local static server.
- Follow every internal and external link.
- Verify paths from the repository subpath.
- Check for missing assets and console errors.

**Done when:** all intended destinations work and no resource returns a missing-file error.

### T-502: Responsive visual review

- Check at minimum 320 px, 375 px, 768 px, 1024 px, and a wide desktop viewport.
- Look for overflow, overlap, poor wrapping, awkward whitespace, image distortion, and inconsistent card behavior.
- Test both short and long content where relevant.

**Done when:** every page is legible and balanced across the target widths.

### T-503: Accessibility review

- Navigate all pages with only a keyboard.
- Verify skip links, focus visibility, focus order, menu state, landmarks, headings, current-page indication, contrast, and alternative text.
- Check reduced-motion behavior and zoom at 200%.

**Done when:** no known issue prevents a keyboard or assistive-technology user from accessing the core content and navigation.

### T-504: Final cleanup

- Remove dead CSS, unused assets, debug output, misleading placeholders, and commented-out experiments.
- Re-read `REQUIREMENTS.md` and the acceptance criteria.
- Update documentation only where approved implementation decisions differ.

**Done when:** the repository contains only intentional deliverables and every acceptance criterion is met.

## Phase 6 — Deployment

### T-601: Prepare static deployment

- Confirm the entry page is `index.html`.
- Confirm paths work below a repository subpath.
- Configure the chosen static host only after the user authorizes deployment.
- Record the public URL in `README.md` after successful publication.

**Done when:** the deployed version matches the verified local version and all public links work.

## Suggested team ownership

Ownership can be divided without creating three separate visual systems:

- One contributor owns the team page and final content integration.
- Each member owns the accuracy of their personal content and page.
- One contributor owns shared CSS and navigation consistency.
- Every contributor participates in cross-page review and testing.

When multiple agents work concurrently, they should avoid editing `main.css`, shared navigation, or documentation at the same time without coordination.
