import { ChevronLeft, Monitor, Moon, RotateCcw, Sun } from "lucide-react";
import type { UiPreferences } from "../types";

const accentOptions = ["#6aa8ff", "#25b7ba", "#48ad62", "#f0a400", "#d96a9f"];

export function SettingsPanel({
  preferences,
  onChange,
  onBack,
  onReset,
}: {
  preferences: UiPreferences;
  onChange: (preferences: UiPreferences) => void;
  onBack: () => void;
  onReset: () => void;
}) {
  return (
    <section className="ui-page settings-page" aria-label="Settings">
      <header className="ui-page-header settings-page-header">
        <button className="ui-icon-button" type="button" aria-label="Back to Git view" onClick={onBack}>
          <ChevronLeft aria-hidden="true" />
        </button>
        <div>
          <h1>Settings</h1>
          <span>Interface preferences</span>
        </div>
      </header>

      <div className="ui-form settings-panel">
        <div className="ui-form-row settings-row">
          <span className="ui-label">Accent</span>
          <div className="swatch-group">
            {accentOptions.map((color) => (
              <button
                className={preferences.accentColor === color ? "is-active" : ""}
                type="button"
                aria-label={`Use accent ${color}`}
                key={color}
                style={{ background: color }}
                onClick={() => onChange({ ...preferences, accentColor: color })}
              />
            ))}
          </div>
        </div>
        <div className="ui-form-row settings-row">
          <span className="ui-label">Theme</span>
          <div className="ui-segmented segmented-control">
            <button className={preferences.themeMode === "system" ? "is-active" : ""} type="button" onClick={() => onChange({ ...preferences, themeMode: "system" })}>
              <Monitor aria-hidden="true" />
              System
            </button>
            <button className={preferences.themeMode === "light" ? "is-active" : ""} type="button" onClick={() => onChange({ ...preferences, themeMode: "light" })}>
              <Sun aria-hidden="true" />
              Light
            </button>
            <button className={preferences.themeMode === "dark" ? "is-active" : ""} type="button" onClick={() => onChange({ ...preferences, themeMode: "dark" })}>
              <Moon aria-hidden="true" />
              Dark
            </button>
          </div>
        </div>
        <div className="ui-form-row settings-row">
          <span className="ui-label">Density</span>
          <div className="ui-segmented segmented-control compact">
            <button className={preferences.density === "compact" ? "is-active" : ""} type="button" onClick={() => onChange({ ...preferences, density: "compact" })}>
              Compact
            </button>
            <button className={preferences.density === "comfortable" ? "is-active" : ""} type="button" onClick={() => onChange({ ...preferences, density: "comfortable" })}>
              Comfort
            </button>
          </div>
        </div>
        <div className="ui-form-row settings-row">
          <span className="ui-label">Font</span>
          <select className="ui-select" value={preferences.fontFamily} onChange={(event) => onChange({ ...preferences, fontFamily: event.target.value as UiPreferences["fontFamily"] })}>
            <option value="system">System</option>
            <option value="inter">Inter</option>
            <option value="mono">Mono</option>
          </select>
        </div>
        <div className="ui-form-row settings-row">
          <span className="ui-label">Graph</span>
          <div className="ui-segmented segmented-control compact">
            <button className={preferences.graphStyle === "solid" ? "is-active" : ""} type="button" onClick={() => onChange({ ...preferences, graphStyle: "solid" })}>
              Solid
            </button>
            <button className={preferences.graphStyle === "soft" ? "is-active" : ""} type="button" onClick={() => onChange({ ...preferences, graphStyle: "soft" })}>
              Soft
            </button>
          </div>
        </div>
        <label className="ui-toggle settings-toggle">
          <span>Zen</span>
          <input type="checkbox" checked={preferences.zenMode} onChange={(event) => onChange({ ...preferences, zenMode: event.target.checked })} />
        </label>
        <button className="ui-button settings-reset" type="button" onClick={onReset}>
          <RotateCcw aria-hidden="true" />
          Reset
        </button>
      </div>
    </section>
  );
}
