import { ChevronLeft, Monitor, Moon, RotateCcw, Sun } from "lucide-react";
import { autoRefreshIntervalOptions, darkThemePresetOptions, lightThemePresetOptions } from "../lib/preferences";
import { workspaceOpenOptions } from "../lib/workspaceOpenOptions";
import type { UiPreferences, WorkspaceOpenTarget } from "../types";

export function SettingsPanel({
  preferences,
  availableWorkspaceTargets,
  onChange,
  onBack,
  onReset,
}: {
  preferences: UiPreferences;
  availableWorkspaceTargets: WorkspaceOpenTarget[];
  onChange: (preferences: UiPreferences) => void;
  onBack: () => void;
  onReset: () => void;
}) {
  const availableTargets = new Set(availableWorkspaceTargets);
  const availableWorkspaceOptions = workspaceOpenOptions.filter((option) => availableTargets.has(option.target));

  function setWorkspaceTarget(target: WorkspaceOpenTarget, checked: boolean) {
    const nextTargets = new Set(preferences.workspaceOpenTargets);

    if (checked) {
      nextTargets.add(target);
    } else {
      nextTargets.delete(target);
    }

    onChange({
      ...preferences,
      workspaceOpenTargets: workspaceOpenOptions.filter((option) => nextTargets.has(option.target)).map((option) => option.target),
    });
  }

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
          <span className="ui-label">Mode</span>
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
          <span className="ui-label">Light</span>
          <div className="ui-select-frame">
            <select
              className="ui-select"
              value={preferences.lightThemePreset}
              onChange={(event) => onChange({ ...preferences, lightThemePreset: event.target.value as UiPreferences["lightThemePreset"] })}
            >
              {lightThemePresetOptions.map((option) => (
                <option value={option.value} key={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="ui-form-row settings-row">
          <span className="ui-label">Dark</span>
          <div className="ui-select-frame">
            <select
              className="ui-select"
              value={preferences.darkThemePreset}
              onChange={(event) => onChange({ ...preferences, darkThemePreset: event.target.value as UiPreferences["darkThemePreset"] })}
            >
              {darkThemePresetOptions.map((option) => (
                <option value={option.value} key={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
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
          <div className="ui-select-frame">
            <select className="ui-select" value={preferences.fontFamily} onChange={(event) => onChange({ ...preferences, fontFamily: event.target.value as UiPreferences["fontFamily"] })}>
              <option value="system">System</option>
              <option value="inter">Inter</option>
              <option value="mono">Mono</option>
            </select>
          </div>
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
        <div className="ui-form-row settings-row">
          <span className="ui-label">Refresh</span>
          <div className="ui-select-frame">
            <select
              className="ui-select"
              value={preferences.autoRefreshInterval}
              onChange={(event) => onChange({ ...preferences, autoRefreshInterval: event.target.value as UiPreferences["autoRefreshInterval"] })}
              aria-label="Auto refresh interval"
            >
              {autoRefreshIntervalOptions.map((option) => (
                <option value={option.value} key={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="ui-form-row settings-row">
          <span className="ui-label">Startup</span>
          <label className="ui-toggle settings-launch-at-login-toggle">
            <input
              type="checkbox"
              aria-label="Launch at login"
              checked={preferences.launchAtLogin}
              onChange={(event) => onChange({ ...preferences, launchAtLogin: event.target.checked })}
            />
          </label>
        </div>
        <div className="ui-form-row settings-row">
          <span className="ui-label">Zen</span>
          <label className="ui-toggle settings-zen-entry-toggle">
            <input
              type="checkbox"
              aria-label="Show Zen mode entry"
              checked={preferences.showZenEntry}
              onChange={(event) => onChange({ ...preferences, showZenEntry: event.target.checked })}
            />
          </label>
        </div>
        <div className="ui-form-row settings-row settings-workspace-targets-row">
          <span className="ui-label">Open in</span>
          <div className="workspace-target-list">
            {availableWorkspaceOptions.map((option) => (
              <label className="workspace-target-toggle" key={option.target}>
                <span className="external-app-icon">
                  <img src={option.iconSrc} alt="" aria-hidden="true" />
                </span>
                <span>{option.label}</span>
                <input
                  type="checkbox"
                  aria-label={`Show ${option.label} in open menu`}
                  checked={preferences.workspaceOpenTargets.includes(option.target)}
                  onChange={(event) => setWorkspaceTarget(option.target, event.target.checked)}
                />
              </label>
            ))}
          </div>
        </div>
        <button className="ui-button settings-reset" type="button" onClick={onReset}>
          <RotateCcw aria-hidden="true" />
          Reset
        </button>
      </div>
    </section>
  );
}
