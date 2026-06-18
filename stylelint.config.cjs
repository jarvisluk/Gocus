module.exports = {
  plugins: ["./tools/stylelint/gocus-design.cjs"],
  rules: {
    "gocus/design-guidelines": [
      true,
      {
        compactFontMaxPx: 16,
        globalFontMaxPx: 20,
        workspaceOpenAppIconMaxPx: 24,
        workspaceOpenControlMaxPx: 36,
        workspaceOpenMenuFontMaxPx: 14,
        workspaceOpenMenuRowMaxPx: 40,
        workspaceOpenMenuWidthMaxPx: 220,
      },
    ],
  },
};
