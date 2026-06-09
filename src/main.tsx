import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { TemporaryInfoWindow } from "./components/TemporaryInfoWindow";
import "./styles.css";

const windowMode = new URL(window.location.href).searchParams.get("window");
const RootApp = windowMode === "temporary-info" ? TemporaryInfoWindow : App;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RootApp />
  </StrictMode>,
);
