import { RotateCcw } from "lucide-react";
import type { UiPreferences } from "../types";

const accentOptions = ["#6aa8ff", "#25b7ba", "#48ad62", "#f0a400", "#d96a9f"];

export function SettingsPanel({
  preferences,
  onChange,
  onReset,
}: {
  preferences: UiPreferences;
  onChange: (preferences: UiPreferences) => void;
  onReset: () => void;
}) {
  return (
    <section className="settings-panel" aria-label="Settings">
      <div className="settings-row">
        <span>Accent</span>
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
      <div className="settings-row">
        <span>Density</span>
        <div className="segmented-control compact">
          <button className={preferences.density === "compact" ? "is-active" : ""} type="button" onClick={() => onChange({ ...preferences, density: "compact" })}>
            Compact
          </button>
          <button className={preferences.density === "comfortable" ? "is-active" : ""} type="button" onClick={() => onChange({ ...preferences, density: "comfortable" })}>
            Comfort
          </button>
        </div>
      </div>
      <div className="settings-row">
        <span>Font</span>
        <select value={preferences.fontFamily} onChange={(event) => onChange({ ...preferences, fontFamily: event.target.value as UiPreferences["fontFamily"] })}>
          <option value="system">System</option>
          <option value="inter">Inter</option>
          <option value="mono">Mono</option>
        </select>
      </div>
      <div className="settings-row">
        <span>Graph</span>
        <div className="segmented-control compact">
          <button className={preferences.graphStyle === "solid" ? "is-active" : ""} type="button" onClick={() => onChange({ ...preferences, graphStyle: "solid" })}>
            Solid
          </button>
          <button className={preferences.graphStyle === "soft" ? "is-active" : ""} type="button" onClick={() => onChange({ ...preferences, graphStyle: "soft" })}>
            Soft
          </button>
        </div>
      </div>
      <button className="settings-reset" type="button" onClick={onReset}>
        <RotateCcw aria-hidden="true" />
        Reset
      </button>
    </section>
  );
}
