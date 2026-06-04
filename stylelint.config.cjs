module.exports = {
  plugins: ["./tools/stylelint/git-peek-design.cjs"],
  rules: {
    "git-peek/design-guidelines": [
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
