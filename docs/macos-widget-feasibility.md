# macOS Widget Feasibility

Gocus can support a macOS widget, but not from Electron alone. A widget needs a native WidgetKit extension inside an Xcode host app,
then a small bridge for sharing repository summary data.

Recommended path:

- Keep the Electron app as the interactive Git client.
- Add a native macOS companion target when packaging moves beyond the prototype stage.
- Share a compact JSON snapshot through an app group container.
- Limit the widget to read-only data: repository name, branch, ahead/behind, dirty counts, and last refresh time.

This is feasible, but it should be a packaging milestone rather than part of the current Electron renderer architecture.
