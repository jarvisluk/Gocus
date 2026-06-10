# Git Peek Design Guardrails

Git Peek is a compact utility surface. It should read like a narrow desktop tool, not a large content page.

## Shared UI Primitives

New forms, windows, dialogs, menus, and compact controls should start from the shared classes in `src/styles.css`:

- Page/window surface: `ui-page`, `ui-page-header`
- Form layout: `ui-form`, `ui-form-row`, `ui-label`
- Inputs: `ui-select`, `ui-input`
- Controls: `ui-button`, `ui-icon-button`, `ui-segmented`, `ui-toggle`
- Dialogs: `ui-dialog-backdrop`, `ui-dialog`, `ui-dialog-heading`, `ui-dialog-body`, `ui-dialog-actions`
- Menus/popovers: `ui-menu`, `ui-menu-item`

Component-specific classes such as `settings-*`, `action-dialog-*`, and `workspace-open-*` should only express local layout needs,
icons, or positioning. They should not redefine typography, colors, backgrounds, radii, or shadows.

## Token Layer

Global typography, spacing, control, icon, surface, and shadow values live in `:root` in `src/styles.css`.

Use tokens such as `--font-sm`, `--control-md`, `--icon-sm`, `--radius-md`, `--surface`, `--surface-hover`, and `--dialog-shadow`
instead of new hard-coded values when adding UI.

Typography should use semantic tokens layered over the compact size scale:

- Micro: `--type-micro-size` (`10px`) for dense graph labels, tiny badges, and uppercase fact labels.
- Caption/metadata: `--type-caption-size` (`11px`) for helper text, timestamps, file detail, and subdued labels.
- Body: `--type-body-size` (`12px`) for normal compact UI copy, hashes, inline values, and small controls.
- Strong body: `--type-body-strong-size` (`13px`) for stats, selected metadata, or compact rows that need emphasis.
- Heading 2: `--type-heading-2-size` (`14px`) for card titles, dialog headings, and section-level item titles.
- Heading 1: `--type-heading-1-size` (`15px`) for primary panel headings.
- Page title: `--type-page-title-size` (`16px`) for the app header or top-level page title only.
- Display: `--type-display-size` (`20px`) for empty-state headings only.

Avoid ad hoc half-pixel sizes such as `12.5px`; choose the nearest semantic role instead. UI rules should not set `font-size`
with raw `px` values or direct `--font-*` scale tokens.

## Lint-Enforced Rules

Run:

```bash
npm run lint:design
```

The Stylelint rule in `tools/stylelint/git-peek-design.cjs` enforces these hard limits:

- Global CSS `font-size` must stay at or below `20px`; large type is reserved for intentional empty-state headings.
- UI `font-size` declarations must use semantic `--type-*` tokens or `inherit`, not raw `px` values or direct `--font-*` scale tokens.
- Compact controls such as buttons, footer tools, chips, segmented controls, file rows, commit actions, and settings rows must stay at or
  below `16px`.
- Settings, action-dialog, and future non-`ui-*` `*form*`, `*window*`, or `*dialog*` selectors may not define their own `font-size`,
  `font-weight`, `color`, `background`, `border-radius`, or `box-shadow`. Use the shared `ui-*` primitives instead.
- The external-app open menu must stay compact:
  - menu text: `14px` max
  - menu row: `40px` max
  - menu width: `220px` max
  - app icon: `24px` max
  - trigger control: `36px` max

If a design needs to exceed these limits, add a narrow Stylelint disable comment with a reason near the declaration.
