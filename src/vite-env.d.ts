/// <reference types="vite/client" />

import type { GitSnapshot, SnapshotResponse } from "./types";

declare global {
  interface Window {
    gitPeek?: {
      openRepository: () => Promise<SnapshotResponse>;
      refresh: () => Promise<SnapshotResponse>;
      getSnapshot: () => Promise<SnapshotResponse>;
      clearRepository: () => Promise<SnapshotResponse>;
      setCollapsed: (collapsed: boolean) => Promise<void>;
      setPinned: (pinned: boolean) => Promise<void>;
      dockToEdge: (collapsed: boolean) => Promise<void>;
      getSystemTheme: () => Promise<"light" | "dark">;
      onThemeChanged: (callback: (theme: "light" | "dark") => void) => () => void;
      onSnapshotUpdated: (callback: (response: SnapshotResponse) => void) => () => void;
      onCollapsedChanged: (callback: (collapsed: boolean) => void) => () => void;
    };
  }
}

export {};
