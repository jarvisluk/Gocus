import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { Check, ChevronDown, ChevronLeft, ChevronRight, Monitor, Moon, RotateCcw, Sun } from "lucide-react";
import { autoRefreshIntervalOptions, darkThemePresetOptions, lightThemePresetOptions } from "../lib/preferences";
import {
  settingsPageAfterBack,
  settingsPageAfterEscape,
  settingsPanelView,
  settingsPreferencesView,
  settingsWorkspaceTargetItems,
  type SettingsPage,
  type SettingsSegmentIcon,
} from "../lib/settingsPanelView";
import { useDismissableLayer } from "../lib/useDismissableLayer";
import { availableWorkspaceOpenOptions, workspaceOpenTargetsAfterToggle } from "../lib/workspaceOpenChoices";
import { workspaceOpenOptions } from "../lib/workspaceOpenOptions";
import type { UiPreferences, WorkspaceOpenTarget } from "../types";

function settingsSegmentIcon(icon: SettingsSegmentIcon | undefined) {
  if (icon === "monitor") return <Monitor aria-hidden="true" />;
  if (icon === "sun") return <Sun aria-hidden="true" />;
  if (icon === "moon") return <Moon aria-hidden="true" />;
  return null;
}

function AutoRefreshDropdown({
  value,
  open,
  view,
  ariaLabel,
  onOpenChange,
  onChange,
}: {
  value: UiPreferences["autoRefreshInterval"];
  open: boolean;
  view: ReturnType<typeof settingsPanelView>["mainPanel"];
  ariaLabel: string;
  onOpenChange: (open: boolean) => void;
  onChange: (interval: UiPreferences["autoRefreshInterval"]) => void;
}) {
  const controlRef = useRef<HTMLDivElement>(null);
  const selectedOption = autoRefreshIntervalOptions.find((option) => option.value === value) ?? autoRefreshIntervalOptions[0];

  useDismissableLayer({
    active: open,
    refs: [controlRef],
    onDismiss: () => onOpenChange(false),
  });

  function selectInterval(interval: UiPreferences["autoRefreshInterval"]) {
    onChange(interval);
    onOpenChange(false);
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (!open || event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    onOpenChange(false);
  }

  return (
    <div className={view.refreshControlClassName} ref={controlRef} onKeyDown={handleKeyDown}>
      <div className={view.refreshFrameClassName}>
        <button
          id={view.refreshTriggerId}
          className={`${view.refreshTriggerClassName}${open ? " is-open" : ""}`}
          type="button"
          aria-label={ariaLabel}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={view.refreshMenuId}
          onClick={() => onOpenChange(!open)}
        >
          <span className={view.disclosureLabelClassName}>{selectedOption.label}</span>
          <span className={view.disclosureValueClassName} aria-hidden="true" />
          <ChevronDown aria-hidden="true" />
        </button>
      </div>
      {open ? (
        <div
          className={view.refreshMenuClassName}
          id={view.refreshMenuId}
          role={view.refreshMenuRole}
          aria-labelledby={view.refreshTriggerId}
        >
          {autoRefreshIntervalOptions.map((option) => {
            const active = option.value === value;

            return (
              <button
                className={`${view.refreshMenuItemClassName}${active ? " is-active" : ""}`}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                key={option.value}
                onClick={() => selectInterval(option.value)}
              >
                {active ? <Check aria-hidden="true" /> : <span aria-hidden="true" />}
                <span>{option.label}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

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
  const [settingsPage, setSettingsPage] = useState<SettingsPage>("main");
  const [autoRefreshMenuOpen, setAutoRefreshMenuOpen] = useState(false);
  const availableWorkspaceOptions = availableWorkspaceOpenOptions(workspaceOpenOptions, availableWorkspaceTargets);
  const view = settingsPanelView(settingsPage, availableWorkspaceOptions, preferences.workspaceOpenTargets);
  const preferenceView = settingsPreferencesView(preferences);
  const sections = view.sections;
  const workspaceTargetItems = settingsWorkspaceTargetItems(availableWorkspaceOptions, preferences.workspaceOpenTargets);

  useEffect(() => {
    const nextPage = settingsPageAfterEscape(settingsPage);
    if (!nextPage) return undefined;
    const targetPage: SettingsPage = nextPage;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      setSettingsPage(targetPage);
    }

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [settingsPage]);

  function handleBack() {
    const nextPage = settingsPageAfterBack(settingsPage);

    if (nextPage) {
      setSettingsPage(nextPage);
      return;
    }

    onBack();
  }

  function setWorkspaceTarget(target: WorkspaceOpenTarget, checked: boolean) {
    onChange({
      ...preferences,
      workspaceOpenTargets: workspaceOpenTargetsAfterToggle(workspaceOpenOptions, preferences.workspaceOpenTargets, target, checked),
    });
  }

  return (
    <section className={view.page.className} aria-labelledby={view.page.ariaLabelledBy}>
      <header className={view.header.className}>
        <button
          className={view.header.backButton.className}
          type="button"
          aria-label={view.header.backButton.ariaLabel}
          onClick={handleBack}
        >
          <ChevronLeft aria-hidden="true" />
        </button>
        <div>
          <h1 id={view.titleId}>{view.title}</h1>
          <span>{view.subtitle}</span>
        </div>
      </header>

      {view.openInPageActive ? (
        <div className={view.openInPanel.className}>
          {workspaceTargetItems.length ? (
            <div className={view.openInPanel.listClassName}>
              {workspaceTargetItems.map(({ ariaLabel, checked, option }) => (
                <label className={view.openInPanel.toggleClassName} key={option.target}>
                  <span className={view.openInPanel.iconClassName}>
                    <img src={option.iconSrc} alt="" aria-hidden="true" />
                  </span>
                  <span>{option.label}</span>
                  <input
                    type="checkbox"
                    aria-label={ariaLabel}
                    checked={checked}
                    onChange={(event) => setWorkspaceTarget(option.target, event.target.checked)}
                  />
                </label>
              ))}
            </div>
          ) : (
            <div
              className={view.openInPanel.emptyState.className}
              role={view.openInPanel.emptyState.role}
              aria-live={view.openInPanel.emptyState.ariaLive}
            >
              {view.openInPanel.emptyState.message}
            </div>
          )}
        </div>
      ) : (
        <div className={view.mainPanel.className}>
          <div className={view.mainPanel.sectionClassName} aria-labelledby={sections.appearance.titleId}>
            <h2 className={view.mainPanel.sectionTitleClassName} id={sections.appearance.titleId}>
              {sections.appearance.title}
            </h2>
            <div className={view.mainPanel.rowClassName}>
              <span className={view.mainPanel.labelClassName}>{sections.appearance.rows.mode}</span>
              <div className={view.mainPanel.segmentedClassName}>
                {preferenceView.themeModeOptions.map((option) => (
                  <button
                    className={option.className}
                    type="button"
                    aria-pressed={option.ariaPressed}
                    key={option.value}
                    onClick={() => onChange({ ...preferences, themeMode: option.value })}
                  >
                    {settingsSegmentIcon(option.icon)}
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <div className={view.mainPanel.rowClassName}>
              <span className={view.mainPanel.labelClassName}>{sections.appearance.rows.light}</span>
              <div className={view.mainPanel.selectFrameClassName}>
                <select
                  className={view.mainPanel.selectClassName}
                  value={preferences.lightThemePreset}
                  aria-label={sections.appearance.lightThemeAriaLabel}
                  onChange={(event) =>
                    onChange({
                      ...preferences,
                      lightThemePreset: event.target.value as UiPreferences["lightThemePreset"],
                    })
                  }
                >
                  {lightThemePresetOptions.map((option) => (
                    <option value={option.value} key={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className={view.mainPanel.rowClassName}>
              <span className={view.mainPanel.labelClassName}>{sections.appearance.rows.dark}</span>
              <div className={view.mainPanel.selectFrameClassName}>
                <select
                  className={view.mainPanel.selectClassName}
                  value={preferences.darkThemePreset}
                  aria-label={sections.appearance.darkThemeAriaLabel}
                  onChange={(event) =>
                    onChange({
                      ...preferences,
                      darkThemePreset: event.target.value as UiPreferences["darkThemePreset"],
                    })
                  }
                >
                  {darkThemePresetOptions.map((option) => (
                    <option value={option.value} key={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className={view.mainPanel.rowClassName}>
              <span className={view.mainPanel.labelClassName}>{sections.appearance.rows.density}</span>
              <div className={view.mainPanel.compactSegmentedClassName}>
                {preferenceView.densityOptions.map((option) => (
                  <button
                    className={option.className}
                    type="button"
                    aria-pressed={option.ariaPressed}
                    key={option.value}
                    onClick={() => onChange({ ...preferences, density: option.value })}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <div className={view.mainPanel.rowClassName}>
              <span className={view.mainPanel.labelClassName}>{sections.appearance.rows.font}</span>
              <div className={view.mainPanel.selectFrameClassName}>
                <select
                  className={view.mainPanel.selectClassName}
                  value={preferences.fontFamily}
                  aria-label={sections.appearance.fontFamilyAriaLabel}
                  onChange={(event) =>
                    onChange({
                      ...preferences,
                      fontFamily: event.target.value as UiPreferences["fontFamily"],
                    })
                  }
                >
                  {preferenceView.fontFamilyOptions.map((option) => (
                    <option value={option.value} key={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className={view.mainPanel.sectionClassName} aria-labelledby={sections.graph.titleId}>
            <h2 className={view.mainPanel.sectionTitleClassName} id={sections.graph.titleId}>
              {sections.graph.title}
            </h2>
            <div className={view.mainPanel.rowClassName}>
              <span className={view.mainPanel.labelClassName}>{sections.graph.rows.lines}</span>
              <div className={view.mainPanel.compactSegmentedClassName}>
                {preferenceView.graphStyleOptions.map((option) => (
                  <button
                    className={option.className}
                    type="button"
                    aria-pressed={option.ariaPressed}
                    key={option.value}
                    onClick={() => onChange({ ...preferences, graphStyle: option.value })}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className={view.mainPanel.sectionClassName} aria-labelledby={sections.behavior.titleId}>
            <h2 className={view.mainPanel.sectionTitleClassName} id={sections.behavior.titleId}>
              {sections.behavior.title}
            </h2>
            <div className={view.mainPanel.rowClassName}>
              <span className={view.mainPanel.labelClassName}>{sections.behavior.rows.refresh}</span>
              <AutoRefreshDropdown
                value={preferences.autoRefreshInterval}
                open={autoRefreshMenuOpen}
                view={view.mainPanel}
                ariaLabel={sections.behavior.autoRefreshAriaLabel}
                onOpenChange={setAutoRefreshMenuOpen}
                onChange={(autoRefreshInterval) => onChange({ ...preferences, autoRefreshInterval })}
              />
            </div>
            <div className={view.mainPanel.rowClassName}>
              <span className={view.mainPanel.labelClassName}>{sections.behavior.rows.startup}</span>
              <label className={view.mainPanel.launchAtLoginToggleClassName}>
                <input
                  type="checkbox"
                  aria-label={sections.behavior.launchAtLoginAriaLabel}
                  checked={preferences.launchAtLogin}
                  onChange={(event) => onChange({ ...preferences, launchAtLogin: event.target.checked })}
                />
              </label>
            </div>
            <div className={view.mainPanel.rowClassName}>
              <span className={view.mainPanel.labelClassName}>{sections.behavior.rows.menuBar}</span>
              <label className={view.mainPanel.menuBarIconToggleClassName}>
                <input
                  type="checkbox"
                  aria-label={sections.behavior.showMenuBarIconAriaLabel}
                  checked={preferences.showMenuBarIcon}
                  onChange={(event) => onChange({ ...preferences, showMenuBarIcon: event.target.checked })}
                />
              </label>
            </div>
            <div className={view.mainPanel.rowClassName}>
              <span className={view.mainPanel.labelClassName}>{sections.behavior.rows.merge}</span>
              <label className={view.mainPanel.mergeCommitToggleClassName}>
                <input
                  type="checkbox"
                  aria-label={sections.behavior.createMergeCommitAriaLabel}
                  checked={preferences.createMergeCommit}
                  onChange={(event) => onChange({ ...preferences, createMergeCommit: event.target.checked })}
                />
              </label>
            </div>
            <div className={view.mainPanel.rowClassName}>
              <span className={view.mainPanel.labelClassName}>{sections.behavior.rows.zenEntry}</span>
              <label className={view.mainPanel.zenEntryToggleClassName}>
                <input
                  type="checkbox"
                  aria-label={sections.behavior.showZenEntryAriaLabel}
                  checked={preferences.showZenEntry}
                  onChange={(event) => onChange({ ...preferences, showZenEntry: event.target.checked })}
                />
              </label>
            </div>
            <div className={view.mainPanel.rowClassName}>
              <span className={view.mainPanel.labelClassName}>{sections.behavior.rows.prompt}</span>
              <div className={view.mainPanel.compactSegmentedClassName}>
                {preferenceView.promptLanguageOptions.map((option) => (
                  <button
                    className={option.className}
                    type="button"
                    aria-pressed={option.ariaPressed}
                    key={option.value}
                    onClick={() => onChange({ ...preferences, promptLanguage: option.value })}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className={view.mainPanel.sectionClassName} aria-labelledby={sections.workspace.titleId}>
            <h2 className={view.mainPanel.sectionTitleClassName} id={sections.workspace.titleId}>
              {sections.workspace.title}
            </h2>
            <div className={view.mainPanel.rowClassName}>
              <span className={view.mainPanel.labelClassName}>{sections.workspace.rowLabel}</span>
              <div className={view.mainPanel.disclosureFrameClassName}>
                <button
                  className={view.mainPanel.disclosureButtonClassName}
                  type="button"
                  aria-label={sections.workspace.disclosureAriaLabel}
                  onClick={() => setSettingsPage("openIn")}
                >
                  <span className={view.mainPanel.disclosureLabelClassName}>{sections.workspace.disclosureLabel}</span>
                  <span className={view.mainPanel.disclosureValueClassName}>{sections.workspace.disclosureValue}</span>
                  <ChevronRight aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>

          <div className={view.mainPanel.resetSectionClassName} aria-label={sections.reset.ariaLabel}>
            <button className={view.mainPanel.resetButtonClassName} type="button" onClick={onReset}>
              <RotateCcw aria-hidden="true" />
              {sections.reset.label}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
