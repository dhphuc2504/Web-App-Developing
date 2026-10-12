# Design Specification

## 1. Design direction

The site should feel cohesive, modern, approachable, and credible. It is one team website—not four unrelated designs. Individual member pages may use a restrained accent variation, but typography, spacing, components, navigation, and page structure must remain consistent.

Prioritize clear content hierarchy over decorative effects.

## 2. Design principles

- **People first:** portraits, names, roles, and introductions should be easy to find.
- **One team identity:** shared components and visual rhythm connect every page.
- **Easy exploration:** the next useful navigation choice should always be visible.
- **Calm presentation:** use whitespace, limited colors, and restrained motion.
- **Accessible by default:** contrast, focus states, readable type, and touch targets are part of the design.

## 3. Design tokens

Define actual values as CSS custom properties in `main.css`. The initial implementation may refine the palette, but it should use the following semantic token structure:

```css
:root {
  --color-background: /* page background */;
  --color-surface: /* cards and elevated sections */;
  --color-text: /* primary body text */;
  --color-text-muted: /* supporting text */;
  --color-primary: /* team brand color */;
  --color-primary-strong: /* hover/active brand color */;
  --color-border: /* subtle dividers */;
  --color-focus: /* highly visible focus ring */;

  --font-body: /* readable system-oriented stack */;
  --font-heading: /* heading stack, may match body */;

  --space-1: /* smallest spacing step */;
  --space-2: /* compact spacing */;
  --space-3: /* normal spacing */;
  --space-4: /* component spacing */;
  --space-5: /* section spacing */;
  --space-6: /* large section spacing */;

  --radius-small: /* controls and tags */;
  --radius-medium: /* cards */;
  --radius-large: /* prominent panels */;
  --shadow-small: /* subtle elevation */;
  --content-width: /* maximum readable page width */;
}
```

Avoid adding colors without assigning them a clear semantic role.

## 4. Typography

- Use a readable sans-serif typeface or system font stack.
- Body text should generally remain at least `1rem`.
- Use fluid heading sizes with `clamp()` where helpful.
- Keep body-copy line length roughly between 45 and 75 characters.
- Use weight, size, and spacing—not color alone—to establish hierarchy.
- Avoid long passages in all caps.

## 5. Layout

- Start mobile-first with a single content column.
- Use a centered content container with comfortable side padding.
- Increase section spacing gradually at wider viewports.
- Use CSS Grid for card collections and Flexbox for small component alignment.
- Avoid fixed content heights.
- Do not hide meaningful content merely to simplify a narrow layout.

Suggested layout transitions, adjustable based on content:

- Small: below approximately 640 px
- Medium: approximately 640–959 px
- Large: 960 px and above

Breakpoints should respond to where the content stops fitting rather than to particular device models.

## 6. Global header and navigation

The header should contain:

- Team wordmark or text name linking to the home page
- Links for Team, Member 1, Member 2, and Member 3
- A compact menu control when the links cannot fit on small screens

Requirements:

- The current page is visually distinct and marked with `aria-current="page"`.
- Keyboard focus is obvious.
- The mobile menu does not cover content without providing a clear close action.
- The menu is usable without precise pointer control.
- Navigation labels use real names once supplied.

## 7. Team page

### Hero

The first view should establish the team name, its short statement, and a primary path to meet the members. Use one main call to action, such as “Meet the team.”

### About and capabilities

Keep the team description readable and use a compact list or set of tags for capabilities. Avoid vague claims that are not supported by the supplied content.

### Shared work

Use reusable project cards containing only available information:

- Project name
- Short problem or objective
- Team contribution
- Technologies
- Image and link, when supplied

### Member directory

Display exactly three equally prominent cards. A card should include a portrait, name, role, short introduction, and explicit portfolio link. Do not make one member appear more important unless the project owner requests it.

## 8. Member pages

### Profile hero

Pair the member's portrait with their name, role, concise introduction, and approved primary link. On small screens, stack the content in a logical reading order.

### Skills

Group skills into meaningful categories when enough information exists. Avoid progress bars or percentage ratings unless members provide a defensible measurement method.

### Experience and education

Use a simple chronological list or timeline. Do not create empty timeline entries simply for visual balance.

### Personal projects

Reuse the same project-card language as the team page. Clearly identify the member's contribution.

### Portfolio navigation

End with a clear route back to the team and, optionally, previous and next member links. The ordering must be consistent across all member pages.

## 9. Reusable components

Use shared classes for:

- Site container
- Section heading
- Primary and secondary links styled as buttons
- Member card
- Project card
- Skill tag or category
- Social/contact link list
- Previous/next navigation
- Visually hidden text
- Skip link

Component names should describe purpose rather than appearance. Prefer `.member-card` to `.white-box`.

## 10. Images

- Use consistent portrait aspect ratios across member cards.
- Preserve the natural subject framing on member hero images.
- Use `object-fit` when crops are necessary.
- Provide width and height attributes.
- Use team-owned or properly licensed images only.
- A neutral designed placeholder is acceptable during development, but it must not resemble a real unidentified person.

## 11. Interaction and motion

- Hover and focus states may adjust color, border, shadow, or position slightly.
- Keep transitions short and purposeful.
- Avoid auto-playing animation, parallax, cursor effects, and scroll-jacking.
- Disable non-essential motion when `prefers-reduced-motion: reduce` is active.
- Never rely on hover alone to reveal required information.

## 12. Accessibility details

- Maintain WCAG AA color contrast.
- Make touch targets approximately 44 by 44 CSS pixels where practical.
- Do not remove focus outlines without providing a stronger replacement.
- Do not use color as the only indication of active or error states.
- Keep DOM order consistent with visual reading order.
- Ensure zooming to 200% does not remove content or functionality.

## 13. Visual quality checklist

- All four pages look like one product.
- Spacing follows a consistent rhythm.
- Text does not collide with images or controls.
- Cards in the same collection align naturally without fixed-height text truncation.
- Portrait treatment is consistent.
- Long names, titles, and links wrap safely.
- Empty or missing content does not leave awkward gaps.
- Focus, hover, active, and current-page states are visually clear.
