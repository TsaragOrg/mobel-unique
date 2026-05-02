# Admin Interface Visual System

## Context

The public homepage now has a refined, product-first visual direction. The protected admin pages still use early foundation styling. The admin interface has grown into a real catalog preparation tool with lists, forms, uploads, workflow tabs, render matrices, drawers, dialogs, candidate previews, and publication actions.

The next admin work should not begin by restyling one complex page in isolation. It needs a small visual system that can be applied consistently across the protected admin route map.

## Decision

Use a restrained operational visual system for admin pages.

The admin UI should feel related to the public homepage through typography discipline, monochrome restraint, sharp spacing, and quiet surfaces. It should not copy the public homepage hero style, oversized editorial layout, or decorative composition.

The system will be implemented in phases:

1. Admin shell, tokens, navigation, and base controls.
2. Login and dashboard.
3. Sofas, fabrics, and tags list pages.
4. Create and edit form pages.
5. Sofa edit workflow tabs.
6. Drawers, modals, previews, render matrix, and mobile matrix views.
7. Final responsive and accessibility QA.

## Visual Direction

### Tone

- Quiet, utilitarian, and work-focused.
- Dense enough for repeated operations.
- Clear enough for occasional mobile use.
- Premium through restraint, not decoration.

### Layout

- Admin pages use a consistent shell with top-level navigation.
- Page headers show title, context, and primary actions in predictable positions.
- Repeated records use rows, compact cards, or tables depending on data density.
- Panels are used for genuinely grouped controls, not decorative page sections.
- Drawers and modals are used for focused secondary actions.

### Color

Use a neutral foundation with status accents:

- paper/background;
- surface;
- raised surface;
- text primary;
- text secondary;
- muted text;
- border/subtle divider;
- focus;
- success;
- warning;
- danger;
- info;
- neutral status.

Avoid a one-note dark slate, beige, brown, or purple palette. Use status color only for status meaning.

### Typography

- Admin copy stays compact and readable.
- Headings should be smaller than public hero headings.
- Labels, metadata, helper text, and status text need distinct sizes and weights.
- Do not use viewport-scaled font sizes.
- Letter spacing should be reserved for brand text or very short labels only.

### Spacing And Radius

- Use a small spacing scale suited to operational screens.
- Keep cards, panels, inputs, and dialogs at 8px radius or less unless a specific component needs otherwise.
- Avoid nested cards.
- Avoid floating decorative sections.

### Controls

- Use consistent variants:
  - primary action;
  - secondary action;
  - quiet action;
  - danger action;
  - inline link action.
- Use familiar icons for compact tool actions when a clear icon exists.
- Text buttons remain appropriate for high-stakes or domain-specific actions where labels reduce ambiguity.

### Forms

- Labels must remain visible.
- Helper text and validation errors must be predictable.
- Required fields should be clear through validation and copy, not only color.
- Disabled and loading states must preserve layout.
- Upload fields should clearly distinguish current asset, replacement action, and validation error.

### Status

Admin status chips should use consistent labels and visual hierarchy:

- Draft;
- Published;
- Archived;
- Ready;
- Missing;
- Blocked;
- Candidate;
- Generating;
- Failed;
- Current.

Status styles must not rely on color alone.

### Render Matrix

The render matrix is the highest-density admin surface. It should keep:

- desktop matrix for comparison;
- mobile grouped view by fabric;
- clear cell state labels;
- separate actions for generate, retry, review candidates, upload manual render, and use candidate;
- large preview and compare dialogs for image inspection.

## Alternatives Considered

### Restyle Each Page Independently

Rejected. It would create inconsistent controls and make the sofa edit page harder to stabilize.

### Build A Full Component Library First

Rejected for now. The current need is a focused application-specific system, not a general-purpose package.

### Create A Codex Skill Immediately

Rejected for now. A skill is useful after the system has proven patterns. The first pass should be documented as project decisions and specs.

## Consequences

- Early work should touch shared admin CSS and shared wrappers before page-specific polish.
- Tests may need updates because markup and accessible names can shift.
- The sofa edit page should be handled after simpler pages validate the shared patterns.
- A later reusable skill can be created only if the admin visual system becomes stable and repeatable.
