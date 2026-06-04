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

Component-specific classes such as `settings-*`, `action-dialog-*`, and `workspace-open-*` should only express local layout needs, icons, or positioning. They should not redefine typography, colors, backgrounds, radii, or shadows.

## Token Layer

Global typography, spacing, control, icon, surface, and shadow values live in `:root` in `src/styles.css`.

Use tokens such as `--font-sm`, `--control-md`, `--icon-sm`, `--radius-md`, `--surface`, `--surface-hover`, and `--dialog-shadow` instead of new hard-coded values when adding UI.

## Lint-Enforced Rules

Run:

```bash
npm run lint:design
```

The Stylelint rule in `tools/stylelint/git-peek-design.cjs` enforces these hard limits:

- Global CSS `font-size` must stay at or below `20px`; large type is reserved for intentional empty-state headings.
- Compact controls such as buttons, footer tools, chips, segmented controls, file rows, commit actions, and settings rows must stay at or below `16px`.
- Settings, action-dialog, and future non-`ui-*` `*form*`, `*window*`, or `*dialog*` selectors may not define their own `font-size`, `font-weight`, `color`, `background`, `border-radius`, or `box-shadow`. Use the shared `ui-*` primitives instead.
- The external-app open menu must stay compact:
  - menu text: `14px` max
  - menu row: `40px` max
  - menu width: `220px` max
  - app icon: `24px` max
  - trigger control: `36px` max

If a design needs to exceed these limits, add a narrow Stylelint disable comment with a reason near the declaration.
