import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { ChangedFileInfoWindow } from "./components/ChangedFileInfoWindow";
import { CommitInfoWindow } from "./components/CommitInfoWindow";
import { TemporaryInfoWindow } from "./components/TemporaryInfoWindow";
import { installDevWebBridge } from "./lib/devWebBridge";
import { rootElementFromDocument, rootWindowModeFromUrl } from "./lib/rootMount";
import "./styles.css";

installDevWebBridge();

const windowMode = rootWindowModeFromUrl(window.location.href);
const RootApp =
  windowMode === "temporary-info"
    ? TemporaryInfoWindow
    : windowMode === "changed-file-info"
      ? ChangedFileInfoWindow
      : windowMode === "commit-info"
        ? CommitInfoWindow
        : App;

createRoot(rootElementFromDocument(document)).render(
  <StrictMode>
    <RootApp />
  </StrictMode>,
);
