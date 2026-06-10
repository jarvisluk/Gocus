import { joinClass } from "./classNames";
import type { GitSnapshot, UiPreferences } from "../types";

const editorBackdropTabLabels = ["Menu.tsx", "shortcuts.ts"] as const;
const editorBackdropPreviewCode = `export function Menu({ items }) {
  return (
    <nav className="menu">
      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => item.onClick()}
          className="menu-item"
        >
          {item.label}
        </button>
      ))}
    </nav>
  )
}`;

const temporaryInfoDismissView = {
  exemptSelector: ".footer-changed-now, .rail-count",
};

type ClosestTarget = EventTarget & {
  closest?: (selector: string) => unknown;
};

export type AppPanelContentView =
  | { mode: "zen"; snapshot: GitSnapshot }
  | { mode: "settings" }
  | { mode: "repository"; snapshot: GitSnapshot }
  | { mode: "empty" };

function closestTarget(target: EventTarget | null, selector: string) {
  const closest = (target as ClosestTarget | null)?.closest;
  return typeof closest === "function" ? closest.call(target, selector) : null;
}

export function appViewportView({
  electron,
  collapsed,
  zenActive,
}: {
  electron: boolean;
  collapsed: boolean;
  zenActive: boolean;
}) {
  return {
    className: joinClass("app-viewport", electron && "is-electron", collapsed && "is-collapsed", zenActive && "is-zen"),
  };
}

export function appEditorBackdropView() {
  return {
    className: "editor-backdrop",
    ariaHidden: true,
    tabs: {
      className: "editor-tabs",
      labels: editorBackdropTabLabels,
    },
    previewCode: editorBackdropPreviewCode,
  };
}

export function appPanelView(zenActive: boolean) {
  return {
    className: joinClass("peek-panel", zenActive && "is-zen-panel"),
    ariaLabel: zenActive ? "Git Peek zen commit view" : "Git Peek side panel",
  };
}

export function appPanelContentView({
  snapshot,
  settingsOpen,
  zenMode,
}: {
  snapshot: GitSnapshot | null;
  settingsOpen: boolean;
  zenMode: boolean;
}): AppPanelContentView {
  const zenSnapshot = appZenSnapshot({ snapshot, zenMode });
  if (zenSnapshot) return { mode: "zen", snapshot: zenSnapshot };
  if (settingsOpen) return { mode: "settings" };
  if (snapshot) return { mode: "repository", snapshot };
  return { mode: "empty" };
}

export function appZenExitButtonView() {
  return {
    className: "ui-icon-button zen-exit-button",
    ariaLabel: "Exit Zen mode",
    title: "Exit Zen mode",
  };
}

export function appScrollRegionView(zenActive: boolean) {
  return {
    className: joinClass("scroll-region", zenActive && "zen-scroll-region"),
  };
}

export function appNativeDialogBlockerView() {
  return {
    className: "native-dialog-blocker",
    ariaHidden: true,
  };
}

export function appTemporaryInfoDismissView() {
  return temporaryInfoDismissView;
}

export function appZenSnapshot({ snapshot, zenMode }: { snapshot: GitSnapshot | null; zenMode: boolean }) {
  return zenMode ? snapshot : null;
}

export function appChangedNowCount(snapshot: GitSnapshot | null) {
  return snapshot?.changedFiles.length ?? 0;
}

export function appPreferencesWithZenMode(preferences: UiPreferences, zenMode: boolean): UiPreferences {
  return {
    ...preferences,
    zenMode,
  };
}

export function appShouldShowRepositoryControls({
  snapshot,
  zenActive,
}: {
  snapshot: GitSnapshot | null;
  zenActive: boolean;
}) {
  return Boolean(snapshot) && !zenActive;
}

export function appShouldCloseSettingsOnKey({
  key,
  settingsOpen,
  zenActive,
}: {
  key: string;
  settingsOpen: boolean;
  zenActive: boolean;
}) {
  return settingsOpen && !zenActive && key === "Escape";
}

export function appShouldCloseSettingsAfterPreferencesChange({
  settingsOpen,
  nextZenMode,
}: {
  settingsOpen: boolean;
  nextZenMode: boolean;
}) {
  return settingsOpen && nextZenMode;
}

export function appShouldExitZenOnKey({ key, zenActive }: { key: string; zenActive: boolean }) {
  return zenActive && key === "Escape";
}

export function appShouldCloseTemporaryInfoOnPointer(target: EventTarget | null, exemptSelector: string) {
  return !closestTarget(target, exemptSelector);
}
