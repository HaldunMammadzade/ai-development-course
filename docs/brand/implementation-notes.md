# Lindel shell implementation

Date: 8 October 2026.

This is the first pass of the design system into the student app. It establishes tokens, theme, type, and the application shell. It does not redesign each learning screen and it does not change auth, APIs, or learning logic.

The public copy still uses Müəllim. The shell mark is Lindel.

## What landed

- CSS variables in `apps/web/app/globals.css` for both themes. Dark is the default.
- Theme choice in localStorage under `lindel-theme` (`dark`, `light`, or `system`). No account data is stored there.
- Inter, Inter Tight, and IBM Plex Mono through `next/font`. No new package.
- Sidebar at 240px from 1024px. Smaller widths use a top bar and a dialog sheet.
- The Step is the SVG geometry from `docs/brand/assets/lindel-symbol.svg`, rendered by `LindelMark`. Favicon is `apps/web/app/icon.svg`, copied from `lindel-favicon.svg`.
- Shared controls: button (including destructive), input, textarea, select, card, badge, sheet, dialog, dropdown, tooltip, tabs, skeleton, empty state, error state, progress.
- Mastery bars use the square progress track.
- Teacher messages use a label, the 16px mark, a 65ch measure, and a leading accent bar. Thinking no longer uses bouncing dots.

## Responsive

- Below 1024px the sidebar is not on the page. Navigation is in the sheet. Touch targets on nav, theme, and buttons are at least 44px.
- Page padding is 16px, then 24px from 768px, then 40px from 1024px.
- Content width stays with the page. The shell does not force one max width, so the editor and project workspace can still grow.

## Not done in this pass

- Individual marketing, dashboard, lesson, and project layouts were not rebuilt. They inherit the new tokens, type, and flatter surfaces.
- The Cut and Open L are not in the UI.
- Lindel is not legally cleared.
