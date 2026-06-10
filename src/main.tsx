import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { TemporaryInfoWindow } from "./components/TemporaryInfoWindow";
import { rootElementFromDocument, rootWindowModeFromUrl } from "./lib/rootMount";
import "./styles.css";

const RootApp = rootWindowModeFromUrl(window.location.href) === "temporary-info" ? TemporaryInfoWindow : App;

createRoot(rootElementFromDocument(document)).render(
  <StrictMode>
    <RootApp />
  </StrictMode>,
);
