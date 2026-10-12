# Lindel design system

Status: implemented in the application shell. The public product name remains Müəllim. Lindel is a finalist and is not legally cleared.

Date: 8 October 2026. Color, type weight, and motion were revised the same day toward a warm academic palette. Logo geometry did not change.

This file is the source of truth for the UI. Do not invent a second palette, a second radius scale, or a second motion curve. Exploration and rejected directions stay in `docs/brand/logo-exploration.md`. The product philosophy is in `docs/product/premium-ux-principles.md`. The 9 October 2026 experience audit is in `docs/product/premium-ux-audit.md`. That audit does not replace these tokens. It specifies how the next workspace pass should use them.

Core line: you do not just consume courses. You become a better developer.

Core metaphor: the distance between what you can do now and what you are about to be able to do. The short bar is now. The long bar is next.

Personality: intelligent, calm, precise, premium, modern, technical, human, confident, focused, aspirational.

## 1. Logo construction

The mark is The Step. Two bars. Shared left edge. Short bar above. Long bar below.

### Coordinate system

Origin is the top-left of a square canvas. x increases right. y increases down. One grid unit is the atomic measure. Every product size is this canvas scaled uniformly.

| Token        | Value                              |
| ------------ | ---------------------------------- |
| Canvas       | 16 × 16                            |
| Stroke       | 2                                  |
| Vertical gap | 2                                  |
| Left inset   | 2                                  |
| Short bar    | x 2, y 5, width 7, height 2        |
| Long bar     | x 2, y 9, width 12, height 2       |
| Ratio        | 7 / 12                             |
| Corners      | square (radius 0) at every UI size |

Ink bounding box: x 2, y 5, width 12, height 6. The long bar defines the width. The stack defines the height. Ink center is (8, 8), which is the canvas center.

Internal padding inside the 16 canvas, measured to the ink: left 2, right 2, top 5, bottom 5.

### Recreate it

On any size S (the rendered canvas in px):

```
unit = S / 16
short: x = 2u, y = 5u, w = 7u, h = 2u
long:  x = 2u, y = 9u, w = 12u, h = 2u
```

Do not round each edge to a different pixel grid. Scale the whole drawing. At 16, 32, 48, 64, and 128 CSS pixels the units land on integers. At 20 and 24 they do not. On a 2× or 3× screen those sizes still land on device pixels often enough. Prefer 16, 24, 32, 48, 64, 128. Use 20 only when a compact row cannot spare 24.

### Optical correction

None at 64px and below. At 128px and in print, if the lower bar looks heavier, shorten only the long bar by at most 0.25 grid units, from the right. Never change the short bar. Never apply this correction in the app UI.

### Alignment

Both bars share x = 2u. The short bar is never centered on the long bar. Centering makes a pause glyph or a stair.

### Allowed

Uniform scale. One fill for both bars. Fill is `#F3F1EA` on dark, `#20201D` on light, or `currentColor` when the surrounding text color is already one of those. The asset SVGs may still carry the earlier ink; the app mark uses `currentColor`. Horizontal lockup with the lowercase wordmark.

### Prohibited

Rotation, skew, non-uniform scale, a third bar, a gap that is not equal to the stroke, centering the short bar, swapping the bars, rounding corners in UI, gradient, shadow, glow, outline-only drawing, signal blue as the logo fill, placing the mark on a photograph, or redrawing it as a 1.5px line icon.

### Clear space and size

Minimum clear space is 2 grid units beyond the ink on every side. The 16 canvas already provides that on the left and right. Recommended clear space is 4 grid units beyond the ink.

Minimum digital size is a 16px canvas. Below that, do not draw the mark.

Minimum print size is a 12mm canvas width. Below that, use the wordmark alone.

Safe area for the app icon is the 16 canvas scaled and centered. See the app-icon file: a 64 canvas, the 16-grid scaled by 3, translated by 8. Padding from the tile edge to the long bar is 14/64, about 22%.

### Sizes the mark must survive

16, 20, 24, 32, 48, 64, 128. At 16 the stroke is 2px, the gap is 2px, and the length difference is 5px. If those three numbers become equal bars, the drawing has failed.

## 2. SVG files

Files in `docs/brand/assets/` contain no images, no scripts, and no remote URLs.

| File                           | Role                                                             |
| ------------------------------ | ---------------------------------------------------------------- |
| `lindel-symbol.svg`            | Symbol only. `currentColor`. This is the normative geometry.     |
| `lindel-symbol-on-dark.svg`    | Symbol, `#F3F4F6`                                                |
| `lindel-symbol-on-light.svg`   | Symbol, `#12141A`                                                |
| `lindel-lockup-on-dark.svg`    | Horizontal logo for dark backgrounds                             |
| `lindel-lockup-on-light.svg`   | Horizontal logo for light backgrounds                            |
| `lindel-lockup-monochrome.svg` | Horizontal logo, `currentColor`                                  |
| `lindel-favicon.svg`           | 16-grid symbol, `#12141A`, for a light browser chrome            |
| `lindel-app-icon.svg`          | 64 tile, still drawn on `#0C0D10`. Product chrome uses `#11110F` |

The symbol rectangles are normative. The lockup wordmark is SVG text, not outlines. Inter Tight is named and not embedded. When the font is measured, trim the lockup viewBox so the right padding is 2 grid units past the final stem. Do not restretch the text to fit.

When the symbol sits beside the word “Lindel” or `lindel`, the SVG is decorative (`aria-hidden="true"`). When the symbol is alone, the control needs `aria-label="Lindel"`.

## 3. Wordmark

The word is `lindel`. Six letters: l, i, n, d, e, l. Lowercase only in the logo. It is not spelled Lindell. There is no `ll` digraph to kern.

| Property           | Value                                                           |
| ------------------ | --------------------------------------------------------------- |
| Face               | Inter Tight                                                     |
| Fallback           | Inter, then the UI sans                                         |
| Weight             | 500                                                             |
| Case               | lowercase                                                       |
| Tracking           | 0.012em, applied evenly                                         |
| Local adjustment   | If `e` crowds the final `l`, add 0.015em between that pair only |
| Size in the lockup | 10 units on the 16-unit icon canvas (0.625 × canvas height)     |
| Color              | Same fill as the bars. Never signal blue                        |

Why Inter Tight: it is a modern grotesk with even stems, it sits in the same family as the UI face, and it stays quiet at navbar size. Inter at the same weight is acceptable if Tight is not yet available. A third display family is not approved. Do not outline, warp, or custom-draw the letters in the first implementation.

`i` uses the font’s own dot. Do not swap in a square dot unless the wordmark is later redrawn as outlines.

Vertical alignment: the center of the lowercase x-height aligns to the ink center, y = 8 on the icon canvas. In the reference SVG the baseline is y = 11.6 at font-size 10. That is an approximation of Inter Tight’s x-height. After the font is loaded, nudge the baseline so the x-height center, not the em-box center, sits on y = 8.

Ink-to-word gap: the long bar ends at x = 14. The first stem starts at x = 18. That is 4 grid units, the recommended gap. Minimum gap is 2 grid units (stem at x = 16).

### Lockup checks

| Icon canvas | Word                    | Use               |
| ----------- | ----------------------- | ----------------- |
| 16px        | Omit                    | Favicon, dense UI |
| 20px        | Only if the row is wide | Compact mobile    |
| 24px        | Yes                     | Navbar            |
| 32px        | Yes                     | Default lockup    |
| 48px        | Yes                     | Marketing, hero   |

The word should look understated. Weight 500, not 600. No all-caps tracking. No title case in the logo.

## 4. Lockups

| Lockup               | Drawing                                          | Use                                                                                                       |
| -------------------- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| A. Symbol only       | Two bars                                         | Favicon, social avatar, app icon, mobile header when the screen title is already visible, loading mark    |
| B. Symbol + wordmark | Bars, 4-unit gap, `lindel`                       | Navbar on tablet and desktop, marketing header, documents                                                 |
| C. Wordmark only     | `lindel`                                         | Footer legal line, places smaller than 16px, co-branding where the symbol would collide with another mark |
| D. Compact           | Symbol at 20px plus wordmark, minimum 2-unit gap | Mobile header only when no separate screen title exists                                                   |
| E. Favicon           | Symbol, 16 and 32                                | Browser tab. Light chrome uses `#12141A`. Dark chrome uses `#F3F4F6`                                      |
| F. App icon          | Symbol centered in the square tile               | Stores, home screen, PWA. Dark tile is the primary. No wordmark inside the tile                           |

Navbar: B.
Mobile: A, or D if the header has no title.
Favicon: E.
Marketing: B.
Social: A inside F’s tile.

## 5. Color

Warm paper and warm ink, with one academic indigo. Status hues are muted. Learning states reuse those hues. They do not get their own bright spectrum. Electric blue, neon, and pure cold black are not the product language.

Approved anchors:

| Role                 | Hex       |
| -------------------- | --------- |
| Dark canvas          | `#11110F` |
| Dark logo            | `#F3F1EA` |
| Light canvas         | `#F7F6F2` |
| Light logo           | `#20201D` |
| Indigo fill on dark  | `#5865D8` |
| Indigo text on dark  | `#AAB1FF` |
| Indigo fill on light | `#4F59C8` |

`#FFFFFF` on `#5865D8` is about 4.93:1. `#FFFFFF` on `#4F59C8` is about 5.80:1. Both are the filled-button pairs. `#AAB1FF` is accent text and the focus ring on dark. `#C77A7A` as a fill takes dark text `#11110F` (about 5.7:1), not white. Light error, success, and attention text are darkened past the decorative swatches so normal text stays at least 4.5:1 on `#F7F6F2`.

### Semantic tokens, dark

Dark is the primary theme.

| Token                      | Hex       | Use                                                |
| -------------------------- | --------- | -------------------------------------------------- |
| `color.bg.canvas`          | `#11110F` | Page                                               |
| `color.bg.subtle`          | `#171714` | Quiet secondary ground                             |
| `color.bg.surface`         | `#1D1D19` | Meaningful objects only                            |
| `color.bg.elevated`        | `#24241F` | Modals, menus                                      |
| `color.bg.inverse`         | `#F7F6F2` | Inverse chip                                       |
| `color.bg.sidebar`         | `#171714` | Sidebar                                            |
| `color.bg.navbar`          | `#11110F` | Top bar, separated by a border                     |
| `color.bg.input`           | `#1A1A16` | Fields                                             |
| `color.bg.code`            | `#171714` | Editor and output                                  |
| `color.bg.modal`           | `#24241F` | Dialog                                             |
| `color.bg.tooltip`         | `#24241F` | Tooltip                                            |
| `color.bg.hover`           | `#2A2A24` | Hover wash                                         |
| `color.bg.selected`        | `#262833` | Selected nav                                       |
| `color.bg.accent-subtle`   | `#262833` | Quiet indigo wash                                  |
| `color.text.primary`       | `#F3F1EA` | Body and titles                                    |
| `color.text.secondary`     | `#C9C4B8` | Supporting copy                                    |
| `color.text.muted`         | `#A39E92` | Meta, above 4.5:1 on canvas                        |
| `color.text.disabled`      | `#7A766C` | Inactive only. Not for real content                |
| `color.text.inverse`       | `#20201D` | Text on inverse surfaces and on the error fill     |
| `color.text.link`          | `#AAB1FF` | Accent text and links                              |
| `color.text.on-accent`     | `#FFFFFF` | Text on `#5865D8`                                  |
| `color.border.subtle`      | `#2E2E28` | Dividers                                           |
| `color.border.default`     | `#3A3A32` | Inputs                                             |
| `color.border.strong`      | `#524E44` | Emphasis                                           |
| `color.border.focus`       | `#AAB1FF` | Focus ring                                         |
| `color.accent.primary`     | `#AAB1FF` | Icons and accent text                              |
| `color.accent.hover`       | `#4C58C4` | Darkened primary hover so the white label holds AA |
| `color.accent.active`      | `#3C469F` | Pressed indigo                                     |
| `color.accent.fill`        | `#5865D8` | Primary button fill                                |
| `color.accent.subtle`      | `#262833` | Same as `color.bg.accent-subtle`                   |
| `color.accent.soft`        | `#AAB1FF` | Supporting indigo                                  |
| `color.status.success`     | `#75B798` | Pass, mastery text and icons                       |
| `color.status.warning`     | `#D6A85C` | Attention and revision text and icons              |
| `color.status.error`       | `#C77A7A` | Fail text and the destructive fill                 |
| `color.status.info`        | `#7FA7C9` | Developing and information                         |
| `color.status.success-bg`  | `#15241C` | Quiet success surface                              |
| `color.status.warning-bg`  | `#2A2418` | Quiet warning surface                              |
| `color.status.error-bg`    | `#2A1C1C` | Quiet error surface                                |
| `color.status.info-bg`     | `#18233A` | Quiet info surface                                 |
| `color.learning.mastery`   | `#75B798` | Alias of success                                   |
| `color.learning.progress`  | `#AAB1FF` | Alias of accent text                               |
| `color.learning.challenge` | `#D6A85C` | Alias of warning. Use rarely                       |
| `color.learning.review`    | `#A39E92` | Alias of muted                                     |
| `color.learning.weak`      | `#D6A85C` | Alias of warning                                   |

### Semantic tokens, light

Same names. Light is a designed theme, not an inversion. Surfaces step from warm-gray canvas to white. Borders are gray, not translucent white flipped.

| Token                      | Hex       |
| -------------------------- | --------- |
| `color.bg.canvas`          | `#F7F6F2` |
| `color.bg.subtle`          | `#F0EFEA` |
| `color.bg.surface`         | `#FFFFFF` |
| `color.bg.elevated`        | `#FFFFFF` |
| `color.bg.inverse`         | `#20201D` |
| `color.bg.sidebar`         | `#F7F6F2` |
| `color.bg.navbar`          | `#F7F6F2` |
| `color.bg.input`           | `#FFFFFF` |
| `color.bg.code`            | `#F0EFEA` |
| `color.bg.modal`           | `#FFFFFF` |
| `color.bg.tooltip`         | `#20201D` |
| `color.bg.hover`           | `#F0EFEA` |
| `color.bg.selected`        | `#ECEEF8` |
| `color.bg.accent-subtle`   | `#ECEEF8` |
| `color.text.primary`       | `#20201D` |
| `color.text.secondary`     | `#5E5E57` |
| `color.text.muted`         | `#5E5E57` |
| `color.text.disabled`      | `#8A8A82` |
| `color.text.inverse`       | `#F7F6F2` |
| `color.text.link`          | `#4F59C8` |
| `color.text.on-accent`     | `#FFFFFF` |
| `color.border.subtle`      | `#E4E2DA` |
| `color.border.default`     | `#D8D6CE` |
| `color.border.strong`      | `#BDBAB0` |
| `color.border.focus`       | `#4F59C8` |
| `color.accent.primary`     | `#4F59C8` |
| `color.accent.hover`       | `#4450B8` |
| `color.accent.active`      | `#3C469F` |
| `color.accent.fill`        | `#4F59C8` |
| `color.accent.subtle`      | `#ECEEF8` |
| `color.accent.soft`        | `#AAB1FF` |
| `color.status.success`     | `#3F735A` |
| `color.status.warning`     | `#8A6428` |
| `color.status.error`       | `#8F5555` |
| `color.status.info`        | `#3E6D90` |
| `color.learning.mastery`   | `#3F735A` |
| `color.learning.progress`  | `#4F59C8` |
| `color.learning.challenge` | `#8A6428` |
| `color.learning.review`    | `#5E5E57` |
| `color.learning.weak`      | `#8A6428` |

Tooltip text on either theme uses `color.text.inverse` on `color.bg.tooltip`.

Rejected color alternatives, kept from exploration: dust violet (reads as generic AI purple) and moss green (reads as wellness). They are not tokens.

## 6. Dark theme surfaces

| Region               | Token                                                                    |
| -------------------- | ------------------------------------------------------------------------ |
| Page                 | `color.bg.canvas`                                                        |
| Sidebar              | `color.bg.sidebar`, right border `color.border.subtle`                   |
| Navbar               | `color.bg.navbar`, bottom border `color.border.subtle`                   |
| Card                 | `color.bg.surface`, border `color.border.subtle`                         |
| Elevated card, modal | `color.bg.elevated`, border `color.border.default`                       |
| Input                | `color.bg.input`, border `color.border.default`                          |
| Code editor          | `color.bg.code`, border `color.border.subtle`                            |
| Tooltip              | `color.bg.tooltip`                                                       |
| Hover                | `color.bg.hover`                                                         |
| Selected             | `color.bg.selected` plus a 2px leading bar in `color.accent.fill`        |
| Focus                | 2px ring `color.border.focus`, offset 2px                                |
| Primary text         | `color.text.primary`                                                     |
| Secondary text       | `color.text.secondary`                                                   |
| Muted text           | `color.text.muted`                                                       |
| Accent control       | `color.accent.fill` or `color.accent.primary` as specified per component |

Do not paint large areas pure `#000000`. Do not stack shadows to fake depth. A sidebar is a one-step shift from the canvas, not a darker black slab.

## 7. Light theme surfaces

| Region   | Token                                                                            |
| -------- | -------------------------------------------------------------------------------- |
| Page     | `color.bg.canvas`                                                                |
| Sidebar  | same canvas, right border `color.border.subtle`                                  |
| Navbar   | same canvas, bottom border `color.border.subtle`                                 |
| Card     | `color.bg.surface`, border `color.border.subtle`                                 |
| Modal    | white surface, border `color.border.default`, `shadow.md` only                   |
| Input    | white, border `color.border.default`                                             |
| Code     | `color.bg.code` so the editor is not a stark black box dropped into a light page |
| Selected | `color.bg.selected` plus the same 2px accent bar                                 |

Light code surfaces stay light. Syntax colors, when added, must meet AA on `#F0EFEA` and must stay inside the same calm set.

## 8. Typography

Three roles. Inter Tight for display and the wordmark. Inter for UI. IBM Plex Mono for code. No fourth family.

Weights: 400 regular, 500 medium for labels and buttons, 600 for headings. Do not use 700. Do not set every label in uppercase.

| Token             | Size / line | Weight | Tracking | Face          |
| ----------------- | ----------- | ------ | -------- | ------------- |
| `type.display-xl` | 40 / 48     | 600    | -0.02em  | Inter Tight   |
| `type.display-lg` | 36 / 44     | 600    | -0.02em  | Inter Tight   |
| `type.display-md` | 32 / 40     | 600    | -0.015em | Inter Tight   |
| `type.h1`         | 28 / 36     | 600    | -0.015em | Inter Tight   |
| `type.h2`         | 20 / 28     | 600    | -0.01em  | Inter         |
| `type.h3`         | 17 / 24     | 600    | 0        | Inter         |
| `type.h4`         | 16 / 24     | 600    | 0        | Inter         |
| `type.body-lg`    | 18 / 28     | 400    | 0        | Inter         |
| `type.body-md`    | 16 / 24     | 400    | 0        | Inter         |
| `type.body-sm`    | 14 / 20     | 400    | 0        | Inter         |
| `type.label`      | 13 / 18     | 500    | 0.01em   | Inter         |
| `type.caption`    | 12 / 16     | 400    | 0.01em   | Inter         |
| `type.button`     | 14 / 20     | 500    | 0        | Inter         |
| `type.navigation` | 14 / 20     | 500    | 0        | Inter         |
| `type.code-sm`    | 13 / 20     | 400    | 0        | IBM Plex Mono |
| `type.code-md`    | 14 / 22     | 400    | 0        | IBM Plex Mono |

Body default is `type.body-md`. Do not set product UI in the display sizes. Display is for marketing and the rare empty-state title.

## 9. Spacing

Base unit is 8. The scale includes the in-between steps the layout actually needs.

| Token      | px  | Use                                                    |
| ---------- | --- | ------------------------------------------------------ |
| `space.2`  | 2   | Focus offset, icon optical nudge                       |
| `space.4`  | 4   | Icon-to-label, tight stacks inside a control           |
| `space.8`  | 8   | Default inline gap                                     |
| `space.12` | 12  | Button padding inline, compact stacks                  |
| `space.16` | 16  | Form gaps, compact card padding                        |
| `space.20` | 20  | Default card padding                                   |
| `space.24` | 24  | Section padding inside a page column, sidebar item gap |
| `space.32` | 32  | Space between sections                                 |
| `space.40` | 40  | Page padding on desktop                                |
| `space.48` | 48  | Major section break                                    |
| `space.64` | 64  | Hero spacing                                           |
| `space.80` | 80  | Marketing block                                        |
| `space.96` | 96  | Large marketing separation                             |

Page padding is `space.16` on mobile, `space.24` on tablet, `space.40` on desktop. Do not invent `space.28` or `space.36`.

## 10. Radius

| Token         | px  | Use                                        |
| ------------- | --- | ------------------------------------------ |
| `radius.none` | 0   | Logo, progress tracks, tables, code blocks |
| `radius.sm`   | 4   | Buttons, inputs, menu items                |
| `radius.md`   | 6   | Cards                                      |
| `radius.lg`   | 8   | Modals, sheets                             |
| `radius.xl`   | 12  | Marketing panels only                      |
| `radius.pill` | 999 | Status labels only                         |

Cards are not pills. Progress tracks are square, because the logo is square.

## 11. Border and elevation

| Token          | Value                                                                               |
| -------------- | ----------------------------------------------------------------------------------- |
| `border.width` | 1px                                                                                 |
| `border.focus` | 2px solid `color.border.focus`, offset 2px                                          |
| `shadow.none`  | none                                                                                |
| `shadow.sm`    | `0 1px 2px rgba(17, 17, 15, 0.28)` dark, `0 1px 2px rgba(32, 32, 29, 0.06)` light   |
| `shadow.md`    | `0 8px 24px rgba(17, 17, 15, 0.32)` dark, `0 8px 24px rgba(32, 32, 29, 0.08)` light |

Cards, sidebar, and navbar use `shadow.none` and a border. Menus may use `shadow.sm`. Modals and sheets use `shadow.md`. No `shadow.lg`. No blurred glows.

Hierarchy order, before any shadow: spacing, type size, surface step, border contrast.

## 12. Motion

Motion shows progress. It does not entertain.

| Token            | Duration | Curve                        |
| ---------------- | -------- | ---------------------------- |
| `motion.instant` | 0ms      | linear                       |
| `motion.fast`    | 150ms    | `cubic-bezier(0.2, 0, 0, 1)` |
| `motion.normal`  | 180ms    | `cubic-bezier(0.2, 0, 0, 1)` |
| `motion.slow`    | 180ms    | `cubic-bezier(0.2, 0, 0, 1)` |

| Situation            | Token                          | What moves                                                        |
| -------------------- | ------------------------------ | ----------------------------------------------------------------- |
| Hover color          | `motion.fast`                  | background and border only                                        |
| Navigation selection | `motion.fast`                  | the 2px accent bar and background                                 |
| Dropdown             | `motion.fast`                  | opacity and 4px translate                                         |
| Modal                | `motion.normal`                | opacity and 8px translate                                         |
| Card press           | `motion.fast`                  | border color                                                      |
| Progress fill        | `motion.slow`                  | width of the short measure, from the left                         |
| Lesson change        | `motion.normal`                | content opacity. No horizontal slide show                         |
| Mastery update       | `motion.slow`                  | the fill lengthens once. No burst                                 |
| AI response          | `motion.fast`                  | the new block fades in. No bouncing dots as the brand             |
| Loading              | 700ms linear loop              | logo short bar between 55% and 100% of its length. Long bar still |
| Logo entrance        | 220ms then 220ms, 40ms overlap | short bar draws, then long bar draws, from the left               |

`prefers-reduced-motion`: every duration becomes `motion.instant`, including the logo. No parallax, no particle, no spring, no bounce, no gradient sweep, no idle animation.

## 13. Components

These rules describe the product shell.

### Buttons

Minimum height 44. Padding inline `space.12`. Radius `radius.sm`. Label `type.button`. One primary button per view.

| Kind        | Fill                 | Border                 | Label                                            |
| ----------- | -------------------- | ---------------------- | ------------------------------------------------ |
| Primary     | `color.accent.fill`  | none                   | `color.text.on-accent`                           |
| Secondary   | transparent          | `color.border.default` | `color.text.primary`                             |
| Ghost       | transparent          | none                   | `color.text.secondary`                           |
| Destructive | `color.status.error` | none                   | dark `#11110F` on the dark theme, white on light |

Hover: primary moves to `color.accent.hover` only if contrast of the label stays at least 4.5:1. If it does not, darken toward `color.accent.active` instead. Secondary and ghost use `color.bg.hover`. Disabled: `color.text.disabled`, no accent, `aria-disabled`, not a contrast trick.

### Inputs

Height 40. Padding inline `space.12`. Radius `radius.sm`. Background `color.bg.input`. Border `color.border.default`. Focus uses `border.focus` and does not remove the border. Error: border and helper text use `color.status.error`, plus an icon or the word “Error”. Disabled: `color.text.disabled` and no focus ring.

### Cards

Padding `space.20`. Radius `radius.md`. Border `color.border.subtle`. Shadow none.

| State       | Treatment                                                     |
| ----------- | ------------------------------------------------------------- |
| Default     | surface and subtle border                                     |
| Interactive | hover border becomes `color.border.default`                   |
| Selected    | `color.bg.selected` and a 2px leading accent bar              |
| Locked      | muted label “Locked”, no accent, not a padlock illustration   |
| Completed   | 2px leading bar in `color.learning.mastery`, label “Complete” |

### Navigation

Sidebar width 240 on desktop. Groups are Öyrənmə, Təcrübə, Bacarıq, and Hesab, using routes that already exist. Item height is at least 44. Radius `radius.sm`. Selected item uses `color.bg.selected` and the leading accent bar, with no glow. Icons are 16px, stroke 1.5.

Top navigation height 56. Lockup B on the left. Account and theme on the right.

Mobile navigation is a top bar of height 56 plus a list or sheet for the rest. Do not squeeze the desktop sidebar into a 16px column of mystery icons as the only mobile pattern. Icon-only rail is allowed from tablet width up, at 72px, with labels in tooltips.

### Progress

Every progress control is a long track and a short fill, left aligned, square ends, height 4px in product (2px if the row is under 32px tall). Track is `color.border.default`. Fill is `color.learning.progress`. Mastery is the fill reaching the end of the track, then the leading color may switch to `color.learning.mastery`. The number or the word is always present. Color is not the only signal.

### AI

Teacher message: a labeled block with a 2px leading accent rule and the word “Müəllim”. No bubble, no card, no avatar, no robot. The student’s answer uses the same column, labeled, without a chat alignment. Max width of the text measure is 65ch.

Hint: `color.bg.accent-subtle`, label “Hint”, collapsed until asked.

Feedback: normal text, then one status line (pass, fail, or review) with icon plus word.

Code review: comments in `type.body-sm` next to the code, not a second chatbot transcript.

Recommendation: one sentence and one action. Not a card stack of five tips.

### Code

Editor background `color.bg.code`. Font `type.code-md`. Output uses the same surface, separated by a 1px border, label “Output”. Diagnostics use status colors plus the words Error or Warning. Exercise states are the words Not started, In progress, Failed, Passed. The progress track sits above the editor, not as a game HUD.

## 14. Learning visual language

The product loop is one drawing repeated.

| Moment     | Visual                                                    |
| ---------- | --------------------------------------------------------- |
| LEARN      | Reading on the canvas. No accent flood                    |
| ANSWER     | Focused input                                             |
| CODE       | Editor surface and the track above it                     |
| FAIL       | Error text plus icon. The fill does not advance           |
| UNDERSTAND | Teacher block. The student work stays on screen           |
| RETRY      | Same exercise. Track unchanged until a pass               |
| PASS       | Fill lengthens once, `motion.slow`                        |
| CHALLENGE  | Card with `color.border.strong` and the label “Challenge” |
| REMEMBER   | Review row in muted text, label “Review”                  |
| BUILD      | Project workspace. Milestones are ticks on the track      |
| IMPROVE    | The remaining gap between fill and track stays visible    |

Skill growth is the track getting filled across lessons, not a level badge. A streak is a count and a date, set in `type.label`, with no flame icon. Milestones are square ticks on the track at the real completion points. Weak concepts use `color.learning.weak` plus the words “Needs work”. Mastery uses `color.learning.mastery` plus “Mastered”.

Do not use coins, hearts, XP bursts, cartoon badges, arcade frames, or a score that flies up the screen.

The personalized path is a short vertical list, not a grid of every lesson. It shows the current step, the next two or three steps, and a few known concepts. Each row has a visible status word (`İndi`, `Artıq bilir`, `Növbəti`, `Təkrar`) in addition to any color. The current step uses `aria-current="step"`. Upcoming steps are text. Only the current lesson is a link, at least 44px tall, with a visible focus ring. Modules stay behind a disclosure so the full curriculum is not the default view. Status changes do not animate.

A Git workflow is the same editorial column. The sequence is a short vertical list on a narrow screen and a wrapping row on a wide screen. Each step has a name, one sentence, and a status word. The page says when the check is only text and when no Git or GitHub operation ran. Testing Fundamentals uses that same column. A code sample sits in a scrollable line so the page itself does not scroll sideways.

A project workspace uses the same editorial column. The current milestone is the heading. Earlier and later phases are a text list with a status word (`Tamamlandı`, `İndi`, `Hələ açılmayıb`, `Düzəliş lazımdır`). The editor stays the existing coding surface. The mentor sits under the verification and only speaks after the student asks. Completion is a short statement and a link back to learning, with no score, bar, or celebration.

Learning milestones are a quiet reading of work the student has already finished. An earned milestone uses the check icon plus the sentence “Qazanıldı” and, when the underlying record has a time, the date. A locked milestone says “Hələ qazanılmayıb”. There is no trophy, glow, progress percent, or point total. The count, when shown, is secondary to the skill map.

The skill map is a second reading of the same curriculum: what the student can already do. Modules are disclosures separated by a rule. Concepts are rows, not a node network and not a card per concept. Each concept shows a state sentence (`Hələ yoxlanmayıb.`, `Üzərində işləmək lazımdır.`, `İnkişaf edir.`, `Möhkəmdir.`) plus an 8px square. Color never carries the state alone. When a previously learned concept is due for another check, a second sentence (`Təkrar vaxtıdır.`, `Təkrar gecikib.`, or `Bu mövzu yenicə təkrarlandı.`) sits under the mastery sentence. That sentence does not replace the mastery state. Direct prerequisites and dependents appear only in the selected concept’s detail, as a short list with a 1px left rule. The detail column is 340px from 1280px up. Below that it is a sheet closed with Escape. There is no score, badge, or aggregate percentage. Revision is a calm list on the same surfaces. The first action in that list is the filled button. Later actions are text links.

## 15. AI visual language

The student is the primary actor. The teacher is a column or a sheet, not the page.

Desktop teacher panel: 360px, border `color.border.subtle`, background `color.bg.surface`. It does not cover the editor. Mobile: a sheet, triggered by “Teacher”, closed by default during coding so the editor is first.

No robot, no face, no generated avatar, no sparkle. The only mark allowed beside “Teacher” is the 16px Step, in the text color, and only once per panel header.

Interview feedback uses the same teacher block and the same pass/fail language as exercises. It does not become a chat product.

A streaming reply reveals text. It does not animate a personality.

## 16. Iconography

One style for UI icons. The logo is not part of that style.

| Rule           | Value                                                                              |
| -------------- | ---------------------------------------------------------------------------------- |
| Grid           | 24 × 24                                                                            |
| Stroke         | 1.5                                                                                |
| Caps and joins | round                                                                              |
| Default        | outline                                                                            |
| Active nav     | outline icon plus the selected row treatment. Do not switch to a random filled set |
| Sizes          | 16 in dense rows, 20 in navigation, 24 when alone                                  |
| Corners        | follow the chosen family. Do not mix sharp and round families                      |

Use one family with these metrics. Do not add an icon package in the specification step. Do not mix filled pictograms with outline icons. The logo’s square bars must not be rebuilt as a rounded stroke icon.

Alignment, menu, and list icons in the product must stay visually thinner than the logo so the mark is not mistaken for a control.

## 17. Accessibility

Target: WCAG 2.2 AA.

| Requirement                  | Rule                                                                                                                        |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Body text                    | at least 4.5:1. `color.text.primary`, `.secondary`, `.muted`, and `.link` meet this on canvas and on surface in both themes |
| Accent text on dark surfaces | `#AAB1FF`, not the filled indigo                                                                                            |
| Primary button label         | `#FFFFFF` on `#5865D8` in dark and on `#4F59C8` in light                                                                    |
| Non-text controls and focus  | at least 3:1                                                                                                                |
| Focus                        | visible `border.focus` ring, 2px, offset 2px, on every interactive control                                                  |
| Keyboard                     | every action that a pointer can do is reachable in order. No focus trap except a modal, which traps focus and returns it    |
| Reduced motion               | durations collapse to 0                                                                                                     |
| Touch target                 | 44 × 44 minimum, including icon buttons                                                                                     |
| Type                         | body is 16px. Do not set the app below 14px except captions                                                                 |
| Headings                     | one h1 per view, then h2 and h3 in order                                                                                    |
| Status                       | color plus a word or an icon. Never color alone                                                                             |
| Disabled text                | exempt as inactive UI. Do not use `color.text.disabled` for placeholders that the user must read                            |

## 18. Responsive system

| Name    | Width       | Token            |
| ------- | ----------- | ---------------- |
| Mobile  | 0–767       | default          |
| Tablet  | 768–1023    | `screen.tablet`  |
| Desktop | 1024–1439   | `screen.desktop` |
| Large   | 1440 and up | `screen.large`   |

Mobile is the base. Larger widths add columns. They do not shrink the mobile layout.

| Region        | Mobile                                                                | Tablet                                  | Desktop                                                                   | Large                                                             |
| ------------- | --------------------------------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Navigation    | Top bar and a menu sheet                                              | Icon rail 72px or top bar               | Sidebar 240px                                                             | Sidebar 240px                                                     |
| Page padding  | 16                                                                    | 24                                      | 40                                                                        | 40                                                                |
| Content width | fluid                                                                 | fluid                                   | max 1120 in the main column                                               | main column max 1200, editor min 560                              |
| Cards         | one column                                                            | two columns when the card is a summary  | two or three                                                              | three only for summary grids                                      |
| Lesson        | one column through 1279px: header, objective, block, answer, exercise | same                                    | same. The 240px app sidebar is already open, so the teacher stays a sheet | from 1280px the teacher is a 360px column beside the lesson stage |
| Editor        | full width under the prompt                                           | full width                              | full width of the lesson stage                                            | full width of the lesson stage, beside the teacher column         |
| Teacher       | sheet                                                                 | sheet                                   | sheet below 1280px                                                        | 360px column                                                      |
| Project       | milestones stacked, editor full width                                 | milestones beside the brief if they fit | brief, editor, checks in three zones                                      | same, wider editor                                                |

A lesson never hides the exercise behind the teacher. A project never hides the brief behind the editor. Interview and speaking views keep the prompt visible while the student answers.

## 19. Token architecture

Names are semantic. Future CSS variables drop the dots for hyphens: `color.bg.canvas` becomes `--color-bg-canvas`. Tailwind theme keys can use the same path. Components consume tokens, not raw hex, except the logo fills documented above.

Groups: `color`, `type`, `space`, `radius`, `border`, `shadow`, `motion`, `screen`.

Do not add `color.button.lesson` or other component-specific colors. A new component picks from the groups that exist.

## 20. Application examples

These are references for a later implementation. They are not screens in the app.

Landing hero. Dark canvas. Lockup B at 32px in the corner. One `type.display-lg` sentence about becoming a better developer. One primary button, one ghost button. No illustration of a robot or a graduate. A single Step mark at 64px may sit in the margin.

Dashboard. A personal learning home. Greeting, one continue action, then the path, revision, and quieter sections separated by rules. No metric-card grid. No confetti summary.

Lesson. Prompt on the left or on top. Track under the title. Editor on `color.bg.code`. Teacher collapsed or in its column.

AI teacher. Label “Teacher”, 16px mark, text at `type.body-md`, one hint disclosure, one next action. The student’s editor remains the largest region.

Code exercise. Track, editor, output, diagnostics with words. Pass lengthens the track once.

Project. Milestones as ticks on one track. Checks listed in text. The workspace is the editor plus the brief, not a trophy case.

Interview. Prompt, answer area, then feedback in the teacher block using pass, fail, and review.

Skill progress. One track per skill. “Mastered”, “In progress”, and “Needs work” are written out. Weak skills use the warning color and the words. They do not blink.

## 21. Distinctiveness

Checked on 8 October 2026 as a visual search, not a trademark clearance.

The Step is kept. The risk is real and the geometry already answers it.

ElevenLabs is three horizontal bars forming an E. past.dev is a bar system with a separated third bar. Adding a third bar is prohibited.

The two-bar left-aligned form also exists as a text-align icon (IconPark “align left two”). Those icons are thin strokes. The Step uses a stroke equal to its gap, a fixed 7/12 ratio, and the short bar on top. UI alignment icons in the product must not copy this ratio.

Mixpanel is vertical bars. DoubleSpace is two lines plus an arrow. The reference brands Linear, Vercel, Cursor, Notion, Arc, and Brilliant do not use this figure. Education marks checked around Codecademy, Pluralsight, and Devlateral are pictorial or letter-based.

No geometry change came out of the search. The distinctiveness rule is operational: two bars, never three, never a hairline icon, never an arrow.

## 22. Decisions an implementer must not reopen

- Primary mark: The Step, geometry in section 1.
- Backup mark, unused in UI: The Cut. Third, unused in UI: Open L. Both remain documented in the exploration file.
- Wordmark: lowercase `lindel`, Inter Tight 500.
- Color: warm ink, warm paper, academic indigo. No electric blue, no neon, no rainbow status set.
- Dark theme first. Light theme uses the light token table.
- Type, space, radius, shadow, and motion tables above.
- Progress is a left-aligned track. Status is color plus words.
- Teacher has no avatar.
- Logo geometry stays in `docs/brand/assets/`. The app draws that geometry in `LindelMark` and serves `apps/web/app/icon.svg` from the favicon file.

## 23. Implementation mapping

The shell now consumes this spec. Page copy still says Müəllim. Routes, APIs, and learning logic are unchanged.

| Spec token                                                              | Application                                                                                                                                         |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--color-bg-canvas` and the rest of the color names                     | `apps/web/app/globals.css` on `:root` and `.dark`                                                                                                   |
| Tailwind `bg-background`, `bg-card`, `text-primary`, `border-border`    | `@theme inline` aliases to those tokens                                                                                                             |
| `--color-success`, `--color-warning`, `--color-info`                    | theme aliases of `--success`, `--warning`, `--info` so dark mode can override the value                                                             |
| `--space-*`, `--radius-none`, `--radius-pill`, `--motion-*`, `--type-*` | same file                                                                                                                                           |
| `--radius-sm` through `--radius-xl`                                     | `@theme` literals: 4, 6, 8, 12                                                                                                                      |
| Inter, Inter Tight, IBM Plex Mono                                       | `next/font` in `apps/web/app/layout.tsx`. Existing `font-serif` headings resolve to Inter Tight                                                     |
| Dark first                                                              | `html` starts with `dark`. `themeBoot` reads `lindel-theme` from localStorage. Absent value stays dark. `system` follows the OS                     |
| Shell                                                                   | `components/app-shell/app-shell.tsx`. Sidebar 240px from 1024px. Below that, a top bar and a sheet                                                  |
| Progress                                                                | `components/ui/progress.tsx`, used by mastery bars and the dashboard path. Square, 4px, 220ms                                                       |
| Dashboard                                                               | `components/dashboard/dashboard-view.tsx`. One next action, then quieter sections. No equal card grid                                               |
| Lesson                                                                  | `components/teaching/lesson-workspace.tsx`. The next action stays in the lesson column. Teacher is a 360px panel from 1280px and a sheet below that |
| Teacher                                                                 | label, 16px Step, 65ch, no bubble, no avatar                                                                                                        |
| Focus                                                                   | 2px ring, 2px offset, in `globals.css`                                                                                                              |

Component files: `button`, `controls` (input, textarea, select), `card`, `badge`, `overlay` (sheet, dialog, dropdown, tooltip, tabs), `status` (skeleton, empty, error), `progress`, `layout/primitives`.

Details and QA notes: `docs/brand/implementation-notes.md`.
