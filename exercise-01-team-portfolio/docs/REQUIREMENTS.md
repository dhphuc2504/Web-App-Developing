# Product Requirements

## 1. Product summary

Create a static portfolio website for a three-person team. The website introduces the team as a whole and gives each member a dedicated personal portfolio page.

The primary audience is a visitor who wants to understand the team's identity and inspect an individual member's background and work.

## 2. Goals

- Communicate what the team is about within the first screen or two.
- Present all three members clearly and consistently.
- Allow a visitor to reach any member's portfolio easily.
- Give each member enough space to present personal information and work.
- Produce a responsive, accessible website suitable for public static hosting.

## 3. User stories

### Team discovery

As a visitor, I want to understand the team's purpose and strengths so that I can quickly decide whether its work is relevant to me.

### Member discovery

As a visitor, I want to see who belongs to the team so that I can learn about each person's role.

### Portfolio navigation

As a visitor, I want to choose a member and open that person's portfolio so that I can review their information and projects.

### Continued browsing

As a visitor, I want to return to the team page or switch to another member so that I can explore the whole team without getting lost.

## 4. Functional requirements

### FR-01 — Team introduction

The home page must show:

- Team name
- Short team statement or tagline
- Team description
- Main skills, services, or areas of interest
- Optional team photo or visual

### FR-02 — Team portfolio

The home page must provide a section for shared projects, achievements, or areas of work. If the team has no shared project content yet, this section may use an honest "coming soon" state or be omitted with approval.

### FR-03 — Member directory

The home page must show exactly three member cards. Each card must contain, when available:

- Portrait
- Full name
- Team role or primary discipline
- Short introduction
- Link to the member's portfolio

### FR-04 — Individual portfolios

Each member must have a dedicated HTML page containing, when supplied:

- Name and portrait
- Role or professional headline
- Biography
- Skills or technologies
- Education or experience
- Personal projects
- Approved contact and social links

The three pages must share the same information structure, while allowing different amounts of content.

### FR-05 — Global navigation

Every page must provide:

- A link to the team home page
- A route to all three member portfolios
- A visually identifiable current location
- A usable navigation experience on mobile and desktop

### FR-06 — Responsive navigation

If the desktop navigation cannot fit comfortably on a narrow screen, a JavaScript-enhanced menu may be used. The control must be keyboard accessible and expose its open or closed state to assistive technology.

### FR-07 — Footer

Every page must include a consistent footer with the team name, appropriate navigation, and a non-deceptive copyright or course-project notice.

## 5. Non-functional requirements

### Accessibility

- Use semantic landmarks and logical headings.
- Support keyboard-only navigation.
- Provide visible focus indicators.
- Meet WCAG AA contrast targets for normal text and interactive controls.
- Provide useful alternative text for informative images.
- Respect reduced-motion preferences.

### Responsiveness

- The site must remain usable at widths from 320 px upward.
- Layouts must adapt without horizontal scrolling.
- Tap targets must be comfortably sized on touch devices.
- Images must scale without distortion.

### Performance

- Avoid heavy dependencies and unnecessary scripts.
- Optimize image file sizes.
- Keep JavaScript non-blocking and small.
- Prevent avoidable layout shift by defining image dimensions.

### Compatibility

Support current versions of Chrome, Firefox, Safari, and Edge. Graceful behavior is acceptable for older browsers; core content and navigation must remain available.

### Maintainability

- Shared presentation belongs in reusable CSS classes.
- All member pages follow the same structural conventions.
- Assets and files follow the organization in `ARCHITECTURE.md`.
- Names use lowercase kebab-case except conventional uppercase documentation filenames.

## 6. Out of scope

Unless requirements are changed explicitly, do not add:

- Authentication or user accounts
- Content management systems
- Databases or backend services
- Contact-form submission
- Search, filtering, or sorting
- Blog functionality
- Admin interfaces
- Analytics or tracking
- Dark mode
- Multilingual support
- Frameworks or external component libraries
- Complex animations or 3D effects

## 7. Acceptance criteria

The exercise is accepted when:

1. The home page explains the team and displays three identifiable members.
2. Each member card opens the correct personal portfolio.
3. All member pages contain the supplied personal information in a consistent structure.
4. Visitors can return home and reach the other members from every page.
5. All navigation works with a keyboard and at mobile widths.
6. No page contains false personal information or misleading placeholder claims.
7. No local link or asset is broken.
8. The site works when deployed as a static site under a repository subpath.
9. The browser console contains no errors during normal use.
10. The finished interface has been visually checked at mobile, tablet, and desktop sizes.
