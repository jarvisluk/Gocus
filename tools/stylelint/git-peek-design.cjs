const stylelint = require("stylelint");

const ruleName = "git-peek/design-guidelines";

const messages = stylelint.utils.ruleMessages(ruleName, {
  compactFontSize: (size, max) =>
    `Compact utility UI font-size ${size}px exceeds ${max}px. ` +
    "Use a smaller design token or add a deliberate exception.",
  privateSurfaceStyle: (selector, prop) =>
    `${selector} sets ${prop} directly. ` +
    "Use the shared ui-* form/dialog classes or root design tokens instead of private form/window styling.",
  semanticFontSize: "Use semantic typography tokens for font-size, such as var(--type-body-size), or inherit.",
  globalFontSize: (size, max) =>
    `font-size ${size}px exceeds the global Git Peek ceiling of ${max}px. ` +
    "Large type is reserved for empty-state headings.",
  workspaceOpenAppIcon: (size, max) => `External app icon size ${size}px exceeds ${max}px.`,
  workspaceOpenControl: (size, max) => `External app open control size ${size}px exceeds ${max}px.`,
  workspaceOpenMenuFontSize: (size, max) => `External app menu font-size ${size}px exceeds ${max}px.`,
  workspaceOpenMenuRow: (size, max) => `External app menu row size ${size}px exceeds ${max}px.`,
  workspaceOpenMenuWidth: (size, max) => `External app menu width ${size}px exceeds ${max}px.`,
});

const compactUiSelectorPattern = new RegExp(
  [
    "\\bbutton\\b",
    "\\.branch-checkout",
    "\\.branch-pill",
    "\\.changed-toggle",
    "\\.commit-actions",
    "\\.commit-meta",
    "\\.commit-stats",
    "\\.file-row",
    "\\.footer-",
    "\\.heading-tools",
    "\\.icon-button",
    "\\.notice-line",
    "\\.ref-pill",
    "\\.repo-mark",
    "\\.segmented-control",
    "\\.settings-row",
    "\\.summary-chip",
    "\\.workspace-open",
  ].join("|"),
);

const privateSurfaceProps = new Set(["background", "background-color", "border-radius", "box-shadow", "color", "font-size", "font-weight"]);

const defaultOptions = {
  compactFontMaxPx: 16,
  globalFontMaxPx: 20,
  workspaceOpenAppIconMaxPx: 24,
  workspaceOpenControlMaxPx: 36,
  workspaceOpenMenuFontMaxPx: 14,
  workspaceOpenMenuRowMaxPx: 40,
  workspaceOpenMenuWidthMaxPx: 220,
};

function pxValues(value) {
  return [...value.matchAll(/(-?\d*\.?\d+)px/g)].map((match) => Number(match[1])).filter(Number.isFinite);
}

function maxPx(value) {
  const values = pxValues(value);
  return values.length ? Math.max(...values) : null;
}

function report(result, decl, message) {
  stylelint.utils.report({
    result,
    ruleName,
    node: decl,
    message,
  });
}

function hasSelector(decl, pattern) {
  return decl.parent?.type === "rule" && pattern.test(decl.parent.selector);
}

function isPrivateSurfaceSelector(selector) {
  if (/\.(settings-|action-dialog)/.test(selector)) return true;

  return [...selector.matchAll(/\.([A-Za-z0-9_-]*(?:form|window|dialog)[A-Za-z0-9_-]*)/g)].some((match) => !match[1].startsWith("ui-"));
}

const ruleFunction = (primary, secondaryOptions = {}) => {
  return (root, result) => {
    const validOptions = stylelint.utils.validateOptions(result, ruleName, {
      actual: primary,
      possible: [true],
    });

    if (!validOptions) return;

    const options = { ...defaultOptions, ...secondaryOptions };

    root.walkDecls((decl) => {
      const prop = decl.prop.toLowerCase();
      const value = decl.value;
      const size = maxPx(value);
      const selector = decl.parent?.type === "rule" ? decl.parent.selector : "";

      if (isPrivateSurfaceSelector(selector) && privateSurfaceProps.has(prop)) {
        report(result, decl, messages.privateSurfaceStyle(selector, prop));
      }

      if (prop === "font-size" && (size !== null || /var\(--font-/.test(value))) {
        report(result, decl, messages.semanticFontSize);
        return;
      }

      if (size === null) return;

      const isWorkspaceOpenMenuItem = hasSelector(decl, /\.workspace-open-menu-item/);
      const isWorkspaceOpenMenu = hasSelector(decl, /\.workspace-open-menu(?!-)/);
      const isWorkspaceOpenControl = hasSelector(decl, /\.workspace-open-control/);
      const isExternalAppIcon = hasSelector(decl, /\.external-app-icon/);
      const isCompactUi = hasSelector(decl, compactUiSelectorPattern);

      if (prop === "font-size") {
        if (size > options.globalFontMaxPx) {
          report(result, decl, messages.globalFontSize(size, options.globalFontMaxPx));
        } else if (isWorkspaceOpenMenuItem && size > options.workspaceOpenMenuFontMaxPx) {
          report(result, decl, messages.workspaceOpenMenuFontSize(size, options.workspaceOpenMenuFontMaxPx));
        } else if (isCompactUi && size > options.compactFontMaxPx) {
          report(result, decl, messages.compactFontSize(size, options.compactFontMaxPx));
        }
      }

      if (isWorkspaceOpenMenuItem && (prop === "height" || prop === "min-height") && size > options.workspaceOpenMenuRowMaxPx) {
        report(result, decl, messages.workspaceOpenMenuRow(size, options.workspaceOpenMenuRowMaxPx));
      }

      if (isWorkspaceOpenMenu && prop === "width" && size > options.workspaceOpenMenuWidthMaxPx) {
        report(result, decl, messages.workspaceOpenMenuWidth(size, options.workspaceOpenMenuWidthMaxPx));
      }

      if (isWorkspaceOpenControl && (prop === "height" || prop === "min-height") && size > options.workspaceOpenControlMaxPx) {
        report(result, decl, messages.workspaceOpenControl(size, options.workspaceOpenControlMaxPx));
      }

      if (isExternalAppIcon && (prop === "width" || prop === "height") && size > options.workspaceOpenAppIconMaxPx) {
        report(result, decl, messages.workspaceOpenAppIcon(size, options.workspaceOpenAppIconMaxPx));
      }
    });
  };
};

ruleFunction.ruleName = ruleName;
ruleFunction.messages = messages;
ruleFunction.meta = {
  url: "https://github.com/stylelint/stylelint/blob/main/docs/developer-guide/plugins.md",
};

module.exports = stylelint.createPlugin(ruleName, ruleFunction);
module.exports.ruleName = ruleName;
module.exports.messages = messages;
