import { joinClass } from "./classNames";
import type { GitSnapshot } from "../types";

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
}: {
  electron: boolean;
  collapsed: boolean;
}) {
  return {
    className: joinClass("app-viewport", electron && "is-electron", collapsed && "is-collapsed"),
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

export function appPanelView() {
  return {
    className: "peek-panel",
    ariaLabel: "Gocus side panel",
  };
}

export function appPanelContentView({
  snapshot,
  settingsOpen,
}: {
  snapshot: GitSnapshot | null;
  settingsOpen: boolean;
}): AppPanelContentView {
  if (settingsOpen) return { mode: "settings" };
  if (snapshot) return { mode: "repository", snapshot };
  return { mode: "empty" };
}

export function appScrollRegionView() {
  return {
    className: "scroll-region",
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

export function appChangedNowCount(snapshot: GitSnapshot | null) {
  return snapshot?.changedFiles.length ?? 0;
}

export function appShouldShowRepositoryControls({
  snapshot,
}: {
  snapshot: GitSnapshot | null;
}) {
  return Boolean(snapshot);
}

export function appShouldCloseSettingsOnKey({
  key,
  settingsOpen,
}: {
  key: string;
  settingsOpen: boolean;
}) {
  return settingsOpen && key === "Escape";
}

export function appShouldCloseTemporaryInfoOnPointer(target: EventTarget | null, exemptSelector: string) {
  return !closestTarget(target, exemptSelector);
}
