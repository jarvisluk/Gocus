import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { Check, ChevronDown, ChevronLeft, ChevronRight, Monitor, Moon, RefreshCw, RotateCcw, Sun } from "lucide-react";
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

type SettingsDropdownName = "lightTheme" | "darkTheme" | "fontFamily" | "autoRefresh";

interface SettingsDropdownOption<T extends string> {
  value: T;
  label: string;
}

function SettingsDropdown<T extends string>({
  value,
  options,
  open,
  view,
  ariaLabel,
  triggerId,
  menuId,
  onOpenChange,
  onChange,
}: {
  value: T;
  options: readonly SettingsDropdownOption<T>[];
  open: boolean;
  view: ReturnType<typeof settingsPanelView>["mainPanel"];
  ariaLabel: string;
  triggerId: string;
  menuId: string;
  onOpenChange: (open: boolean) => void;
  onChange: (value: T) => void;
}) {
  const controlRef = useRef<HTMLDivElement>(null);
  const selectedOption = options.find((option) => option.value === value) ?? options[0];

  useDismissableLayer({
    active: open,
    refs: [controlRef],
    onDismiss: () => onOpenChange(false),
  });

  function selectOption(nextValue: T) {
    onChange(nextValue);
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
          id={triggerId}
          className={`${view.refreshTriggerClassName}${open ? " is-open" : ""}`}
          type="button"
          aria-label={ariaLabel}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={menuId}
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
          id={menuId}
          role={view.refreshMenuRole}
          aria-labelledby={triggerId}
        >
          {options.map((option) => {
            const active = option.value === value;

            return (
              <button
                className={`${view.refreshMenuItemClassName}${active ? " is-active" : ""}`}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                key={option.value}
                onClick={() => selectOption(option.value)}
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
  onCheckForUpdates,
  onBack,
  onReset,
}: {
  preferences: UiPreferences;
  availableWorkspaceTargets: WorkspaceOpenTarget[];
  onChange: (preferences: UiPreferences) => void;
  onCheckForUpdates: () => void;
  onBack: () => void;
  onReset: () => void;
}) {
  const [settingsPage, setSettingsPage] = useState<SettingsPage>("main");
  const [openDropdown, setOpenDropdown] = useState<SettingsDropdownName | null>(null);
  const availableWorkspaceOptions = availableWorkspaceOpenOptions(workspaceOpenOptions, availableWorkspaceTargets);
  const view = settingsPanelView(settingsPage, availableWorkspaceOptions, preferences.workspaceOpenTargets);
  const preferenceView = settingsPreferencesView(preferences);
  const sections = view.sections;
  const workspaceTargetItems = settingsWorkspaceTargetItems(availableWorkspaceOptions, preferences.workspaceOpenTargets);

  function setDropdownOpen(name: SettingsDropdownName, open: boolean) {
    setOpenDropdown(open ? name : null);
  }

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

      {view.appPageActive ? (
        <div className={view.mainPanel.className}>
          <div className={view.mainPanel.sectionClassName} aria-labelledby={sections.app.updatesTitleId}>
            <h2 className={view.mainPanel.sectionTitleClassName} id={sections.app.updatesTitleId}>
              {sections.app.updatesTitle}
            </h2>
            <div className={view.mainPanel.rowClassName}>
              <span className={view.mainPanel.labelClassName}>{sections.app.rows.channel}</span>
              <div className={view.mainPanel.compactSegmentedClassName} role="group" aria-label={sections.app.autoUpdateChannelAriaLabel}>
                {preferenceView.autoUpdateChannelOptions.map((option) => (
                  <button
                    className={option.className}
                    type="button"
                    aria-pressed={option.ariaPressed}
                    key={option.value}
                    onClick={() => onChange({ ...preferences, autoUpdateChannel: option.value })}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <div className={view.mainPanel.rowClassName}>
              <span className={view.mainPanel.labelClassName}>{sections.app.rows.updates}</span>
              <label className={view.mainPanel.autoUpdateChecksToggleClassName}>
                <input
                  type="checkbox"
                  aria-label={sections.app.autoUpdateChecksAriaLabel}
                  checked={preferences.autoUpdateChecks}
                  onChange={(event) => onChange({ ...preferences, autoUpdateChecks: event.target.checked })}
                />
              </label>
            </div>
            <div className={view.mainPanel.rowClassName}>
              <span className={view.mainPanel.labelClassName}>{sections.app.rows.install}</span>
              <label className={view.mainPanel.autoUpdateInstallToggleClassName}>
                <input
                  type="checkbox"
                  aria-label={sections.app.autoUpdateInstallAriaLabel}
                  checked={preferences.autoUpdateInstall}
                  onChange={(event) => onChange({ ...preferences, autoUpdateInstall: event.target.checked })}
                />
              </label>
            </div>
            <div className={view.mainPanel.rowClassName}>
              <span className={view.mainPanel.labelClassName}>{sections.app.rows.check}</span>
              <button
                className={view.mainPanel.manualUpdateButtonClassName}
                type="button"
                aria-label={sections.app.checkForUpdatesAriaLabel}
                onClick={onCheckForUpdates}
              >
                <RefreshCw aria-hidden="true" />
                <span>{sections.app.checkForUpdatesLabel}</span>
              </button>
            </div>
          </div>
        </div>
      ) : view.openInPageActive ? (
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
          <div className={view.mainPanel.sectionClassName} aria-labelledby={sections.app.titleId}>
            <h2 className={view.mainPanel.sectionTitleClassName} id={sections.app.titleId}>
              {sections.app.title}
            </h2>
            <div className={view.mainPanel.rowClassName}>
              <span className={view.mainPanel.labelClassName}>{sections.app.rowLabel}</span>
              <div className={view.mainPanel.disclosureFrameClassName}>
                <button
                  className={view.mainPanel.disclosureButtonClassName}
                  type="button"
                  aria-label={sections.app.disclosureAriaLabel}
                  onClick={() => setSettingsPage("app")}
                >
                  <span className={view.mainPanel.disclosureLabelClassName}>{sections.app.disclosureLabel}</span>
                  <span className={view.mainPanel.disclosureValueClassName}>{sections.app.disclosureValue}</span>
                  <ChevronRight aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>

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
              <SettingsDropdown
                value={preferences.lightThemePreset}
                options={lightThemePresetOptions}
                open={openDropdown === "lightTheme"}
                view={view.mainPanel}
                ariaLabel={sections.appearance.lightThemeAriaLabel}
                triggerId="settings-light-theme-trigger"
                menuId="settings-light-theme-menu"
                onOpenChange={(open) => setDropdownOpen("lightTheme", open)}
                onChange={(lightThemePreset) => onChange({ ...preferences, lightThemePreset })}
              />
            </div>
            <div className={view.mainPanel.rowClassName}>
              <span className={view.mainPanel.labelClassName}>{sections.appearance.rows.dark}</span>
              <SettingsDropdown
                value={preferences.darkThemePreset}
                options={darkThemePresetOptions}
                open={openDropdown === "darkTheme"}
                view={view.mainPanel}
                ariaLabel={sections.appearance.darkThemeAriaLabel}
                triggerId="settings-dark-theme-trigger"
                menuId="settings-dark-theme-menu"
                onOpenChange={(open) => setDropdownOpen("darkTheme", open)}
                onChange={(darkThemePreset) => onChange({ ...preferences, darkThemePreset })}
              />
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
              <SettingsDropdown
                value={preferences.fontFamily}
                options={preferenceView.fontFamilyOptions}
                open={openDropdown === "fontFamily"}
                view={view.mainPanel}
                ariaLabel={sections.appearance.fontFamilyAriaLabel}
                triggerId="settings-font-family-trigger"
                menuId="settings-font-family-menu"
                onOpenChange={(open) => setDropdownOpen("fontFamily", open)}
                onChange={(fontFamily) => onChange({ ...preferences, fontFamily })}
              />
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
              <SettingsDropdown
                value={preferences.autoRefreshInterval}
                options={autoRefreshIntervalOptions}
                open={openDropdown === "autoRefresh"}
                view={view.mainPanel}
                ariaLabel={sections.behavior.autoRefreshAriaLabel}
                triggerId={view.mainPanel.refreshTriggerId}
                menuId={view.mainPanel.refreshMenuId}
                onOpenChange={(open) => setDropdownOpen("autoRefresh", open)}
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
              <span className={view.mainPanel.labelClassName}>{sections.behavior.rows.dock}</span>
              <label className={view.mainPanel.dockIconToggleClassName}>
                <input
                  type="checkbox"
                  aria-label={sections.behavior.showDockIconAriaLabel}
                  checked={preferences.showDockIcon}
                  onChange={(event) => onChange({ ...preferences, showDockIcon: event.target.checked })}
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
