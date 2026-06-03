import {
  CheckCircle2,
  ChevronLeft,
  ChevronsRight,
  CircleHelp,
  ExternalLink,
  FileCode2,
  FolderOpen,
  GitBranch,
  GitCommitHorizontal,
  GitCompareArrows,
  GitFork,
  GitMerge,
  PanelRightClose,
  Pin,
  PinOff,
  RefreshCw,
  Route,
  Search,
} from "lucide-react";
import { useEffect, useState } from "react";
import type { BranchKind, ChangedFile, CommitGraph, CommitItem, GitSnapshot, SnapshotResponse } from "./types";

type Theme = "light" | "dark";
type FileFilter = "all" | "modified" | "staged" | "untracked";

const statusCopy: Record<FileFilter, string> = {
  all: "All changes",
  modified: "Modified",
  staged: "Staged",
  untracked: "Untracked",
};

function isElectronRuntime() {
  return Boolean(window.gitPeek);
}

function getSystemTheme(): Theme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function joinClass(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function formatPath(path: string) {
  const parts = path.split("/");
  if (parts.length <= 2) return path;
  return `${parts.slice(0, -1).join("/")}/${parts.at(-1)}`;
}

function fileKind(file: ChangedFile): FileFilter {
  if (file.status.includes("?")) return "untracked";
  if (file.status[0] && file.status[0] !== " ") return "staged";
  return "modified";
}

function statusLetter(file: ChangedFile) {
  if (file.status.includes("?")) return "U";
  if (file.status.includes("A")) return "A";
  if (file.status.includes("D")) return "D";
  if (file.status.includes("R")) return "R";
  return "M";
}

function IconButton({
  label,
  onClick,
  children,
  active = false,
  disabled = false,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      className={joinClass("icon-button", active && "is-active")}
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

function graphToneClass(color: BranchKind) {
  return color;
}

function GraphCell({ graph }: { graph: CommitGraph }) {
  const laneGap = 12;
  const graphWidth = Math.max(42, 18 + graph.laneCount * laneGap);
  const nodeY = 32;
  const nodeX = 9 + graph.column * laneGap;
  const nodeLeft = `${(nodeX / graphWidth) * 100}%`;
  const xForColumn = (column: number) => 9 + column * laneGap;
  const bridgePath = (fromColumn: number, toColumn: number) => {
    const fromX = xForColumn(fromColumn);
    const toX = xForColumn(toColumn);
    const curveY = nodeY + 26;
    return `M ${fromX} ${nodeY} C ${fromX} ${curveY}, ${toX} ${curveY}, ${toX} ${curveY + 12} L ${toX} 100`;
  };

  return (
    <div className="timeline-cell" aria-hidden="true">
      <svg className="graph-svg" viewBox={`0 0 ${graphWidth} 100`} preserveAspectRatio="none">
        {graph.passThrough.map((lane) => (
          <path
            className={joinClass("graph-line", graphToneClass(lane.color))}
            d={`M ${xForColumn(lane.column)} 0 L ${xForColumn(lane.column)} 100`}
            key={`through-${lane.column}-${lane.color}`}
          />
        ))}
        <path className={joinClass("graph-line", graphToneClass(graph.currentColor))} d={`M ${nodeX} 0 L ${nodeX} ${nodeY}`} />
        {graph.parentStems.map((lane) => (
          <path
            className={joinClass("graph-line", graphToneClass(lane.color))}
            d={`M ${xForColumn(lane.column)} ${nodeY} L ${xForColumn(lane.column)} 100`}
            key={`stem-${lane.column}-${lane.color}`}
          />
        ))}
        {graph.bridges
          .filter((bridge) => bridge.fromColumn !== bridge.toColumn)
          .map((bridge) => (
            <path
              className={joinClass("graph-line", "graph-bridge", graphToneClass(bridge.color))}
              d={bridgePath(bridge.fromColumn, bridge.toColumn)}
              key={`bridge-${bridge.fromColumn}-${bridge.toColumn}-${bridge.color}`}
            />
          ))}
      </svg>
      <span className={joinClass("graph-node", graphToneClass(graph.currentColor), graph.isMerge && "is-merge")} style={{ left: nodeLeft, top: `${nodeY}%` }}>
        {graph.isMerge ? <span className={joinClass("graph-node-core", graphToneClass(graph.currentColor))} /> : null}
      </span>
    </div>
  );
}

function Header({
  snapshot,
  pinned,
  refreshing,
  onOpen,
  onRefresh,
  onTogglePinned,
  onCollapse,
}: {
  snapshot: GitSnapshot | null;
  pinned: boolean;
  refreshing: boolean;
  onOpen: () => void;
  onRefresh: () => void;
  onTogglePinned: () => void;
  onCollapse: () => void;
}) {
  return (
    <header className="peek-header">
      <button className="repo-mark" type="button" aria-label="Open repository" title="Open repository" onClick={onOpen}>
        <Route aria-hidden="true" />
      </button>
      <div className="repo-title">
        <strong>{snapshot?.repoName ?? "Git Peek"}</strong>
        <span>{snapshot?.repoPath ?? "No working folder"}</span>
      </div>
      {snapshot ? (
        <span className="branch-pill" title={snapshot.branch.upstream || snapshot.branch.name}>
          <GitBranch aria-hidden="true" />
          {snapshot.branch.name}
        </span>
      ) : null}
      <div className="header-actions">
        <IconButton label={pinned ? "Unpin floating panel" : "Pin floating panel"} active={pinned} onClick={onTogglePinned}>
          {pinned ? <PinOff aria-hidden="true" /> : <Pin aria-hidden="true" />}
        </IconButton>
        <IconButton label="Refresh Git status" onClick={onRefresh} disabled={!snapshot}>
          <RefreshCw className={refreshing ? "is-spinning" : ""} aria-hidden="true" />
        </IconButton>
        <IconButton label="Collapse side peek" onClick={onCollapse}>
          <ChevronLeft aria-hidden="true" />
        </IconButton>
      </div>
    </header>
  );
}

function SummaryChips({
  snapshot,
  activeFilter,
  onFilter,
}: {
  snapshot: GitSnapshot;
  activeFilter: FileFilter;
  onFilter: (filter: FileFilter) => void;
}) {
  const chips = [
    {
      key: "modified" as const,
      label: "Modified",
      value: snapshot.counts.modified,
      icon: <FileCode2 aria-hidden="true" />,
    },
    {
      key: "staged" as const,
      label: "Staged",
      value: snapshot.counts.staged,
      icon: <CheckCircle2 aria-hidden="true" />,
    },
    {
      key: "untracked" as const,
      label: "Untracked",
      value: snapshot.counts.untracked,
      icon: <CircleHelp aria-hidden="true" />,
    },
  ];

  return (
    <section className="summary-strip" aria-label="Working tree summary">
      {chips.map((chip) => (
        <button
          className={joinClass("summary-chip", chip.key, activeFilter === chip.key && "is-active")}
          type="button"
          key={chip.key}
          onClick={() => onFilter(activeFilter === chip.key ? "all" : chip.key)}
        >
          {chip.icon}
          <span>{chip.label}</span>
          <strong>{chip.value}</strong>
        </button>
      ))}
    </section>
  );
}

function CommitRow({
  commit,
  selected,
  onSelect,
  onAction,
}: {
  commit: CommitItem;
  selected: boolean;
  onSelect: () => void;
  onAction: (action: string) => void;
}) {
  const ref = commit.refs[0];

  return (
    <article className={joinClass("commit-row", selected && "is-selected")} onClick={onSelect}>
      <GraphCell graph={commit.graph} />
      <div className="commit-content">
        <div className="commit-title-line">
          <h3>{commit.title}</h3>
          {ref ? <span className={joinClass("ref-pill", commit.lane)}>{ref}</span> : null}
        </div>
        <div className="commit-meta">
          <code>{commit.hash}</code>
          <span>{commit.relativeTime}</span>
          <span>{commit.author}</span>
          {commit.graph.isMerge ? (
            <span className="merge-indicator" title={`${commit.parents.length} parent commits`}>
              <GitMerge aria-hidden="true" />
              merge
            </span>
          ) : null}
        </div>
        <div className="commit-stats">
          <span className="additions">+{commit.additions}</span>
          <span className="deletions">-{commit.deletions}</span>
          <span className="files">
            <FileCode2 aria-hidden="true" />
            {commit.filesChanged}
          </span>
        </div>
        {selected ? (
          <div className="commit-actions" onClick={(event) => event.stopPropagation()}>
            <button type="button" onClick={() => onAction("Compare")}>
              <GitCompareArrows aria-hidden="true" />
              Compare
            </button>
            <button type="button" onClick={() => onAction("Branch")}>
              <GitFork aria-hidden="true" />
              Branch
            </button>
            <button type="button" onClick={() => onAction("Checkout")}>
              <GitBranch aria-hidden="true" />
              Checkout
            </button>
          </div>
        ) : null}
      </div>
    </article>
  );
}

function RecentCommits({
  commits,
  selectedId,
  onSelect,
  onAction,
}: {
  commits: CommitItem[];
  selectedId: string;
  onSelect: (id: string) => void;
  onAction: (action: string) => void;
}) {
  return (
    <section className="commits-section" aria-label="Recent commits">
      <div className="section-heading">
        <h2>Recent commits</h2>
        <div className="heading-tools">
          <span>All {commits.length}</span>
          <button type="button" aria-label="Filter commits">
            <Search aria-hidden="true" />
          </button>
        </div>
      </div>
      <div className="commit-list">
        {commits.map((commit) => (
          <CommitRow
            key={commit.id}
            commit={commit}
            selected={commit.id === selectedId}
            onSelect={() => onSelect(commit.id)}
            onAction={onAction}
          />
        ))}
      </div>
    </section>
  );
}

function ChangedNow({
  files,
  filter,
  onClearFilter,
}: {
  files: ChangedFile[];
  filter: FileFilter;
  onClearFilter: () => void;
}) {
  const filteredFiles = filter === "all" ? files : files.filter((file) => fileKind(file) === filter);

  return (
    <section className="changed-section" aria-label="Changed now">
      <div className="section-heading compact">
        <h2>Changed now</h2>
        <div className="heading-tools">
          <span>{statusCopy[filter]}</span>
          {filter !== "all" ? (
            <button type="button" aria-label="Clear file filter" onClick={onClearFilter}>
              <ChevronsRight aria-hidden="true" />
            </button>
          ) : (
            <FolderOpen aria-hidden="true" />
          )}
        </div>
      </div>
      <div className="file-list">
        {filteredFiles.length ? (
          filteredFiles.slice(0, 4).map((file) => (
            <div className="file-row" key={`${file.status}-${file.path}`}>
              <span className={joinClass("file-badge", fileKind(file))}>{statusLetter(file)}</span>
              <span className="file-path" title={file.path}>
                {formatPath(file.path)}
              </span>
              <span className="file-delta">
                {file.additions ? <span className="additions">+{file.additions}</span> : null}
                {file.deletions ? <span className="deletions">-{file.deletions}</span> : null}
              </span>
            </div>
          ))
        ) : (
          <div className="empty-state">No files in this view.</div>
        )}
      </div>
    </section>
  );
}

function Footer({
  onOpenRepo,
  onOpenGraph,
  hasRepository,
}: {
  onOpenRepo: () => void;
  onOpenGraph: () => void;
  hasRepository: boolean;
}) {
  return (
    <footer className="peek-footer">
      <button className="open-graph" type="button" onClick={hasRepository ? onOpenGraph : onOpenRepo}>
        <GitCommitHorizontal aria-hidden="true" />
        {hasRepository ? "Open full graph" : "Open working folder"}
      </button>
      <button className="footer-icon" type="button" aria-label="Open repository" title="Open repository" onClick={onOpenRepo}>
        <FolderOpen aria-hidden="true" />
      </button>
      <button className="footer-icon" type="button" aria-label="Open graph in new window" title="Open graph in new window" onClick={onOpenGraph} disabled={!hasRepository}>
        <ExternalLink aria-hidden="true" />
      </button>
    </footer>
  );
}

function CollapsedRail({
  snapshot,
  onExpand,
  onDock,
}: {
  snapshot: GitSnapshot | null;
  onExpand: () => void;
  onDock: () => void;
}) {
  const dirtyCount = snapshot ? snapshot.counts.modified + snapshot.counts.staged + snapshot.counts.untracked : 0;

  return (
    <aside className="collapsed-rail" aria-label="Collapsed Git Peek" title="Drag to move. Double-click to dock to the screen edge." onDoubleClick={onDock}>
      <button className="rail-expand" type="button" aria-label="Expand Git Peek" onClick={onExpand}>
        <PanelRightClose aria-hidden="true" />
      </button>
      <div className="rail-branch">
        {snapshot ? <GitBranch aria-hidden="true" /> : <FolderOpen aria-hidden="true" />}
        <span>{snapshot?.branch.name ?? "Open"}</span>
      </div>
      {snapshot ? (
        <div className="rail-count" aria-label={`${dirtyCount} working tree changes`}>
          {dirtyCount}
        </div>
      ) : null}
    </aside>
  );
}

function EmptyRepositoryState({
  loading,
  notice,
  onOpen,
}: {
  loading: boolean;
  notice: string;
  onOpen: () => void;
}) {
  return (
    <section className="empty-repository" aria-label="Open working folder">
      <div className="empty-icon">
        <FolderOpen aria-hidden="true" />
      </div>
      <h2>{loading ? "Checking working folder" : "Open a working folder"}</h2>
      <p>{loading ? "Looking for the last saved repository." : "Git Peek only shows real data from a folder you choose. It remembers that folder for next time."}</p>
      <button className="primary-action" type="button" onClick={onOpen} disabled={loading}>
        <FolderOpen aria-hidden="true" />
        Choose folder
      </button>
      <span>{notice}</span>
    </section>
  );
}

export default function App() {
  const [snapshot, setSnapshot] = useState<GitSnapshot | null>(null);
  const [theme, setTheme] = useState<Theme>(getSystemTheme);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [fileFilter, setFileFilter] = useState<FileFilter>("all");
  const [selectedCommitId, setSelectedCommitId] = useState("");
  const [notice, setNotice] = useState("No working folder selected.");
  const electron = isElectronRuntime();

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    if (window.gitPeek) {
      window.gitPeek.getSystemTheme().then(setTheme);
      return window.gitPeek.onThemeChanged(setTheme);
    }

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handleThemeChange = () => setTheme(media.matches ? "dark" : "light");
    handleThemeChange();
    media.addEventListener("change", handleThemeChange);
    return () => media.removeEventListener("change", handleThemeChange);
  }, []);

  function applySnapshotResponse(response: SnapshotResponse, successNotice = "Live Git data connected.") {
    if (response.ok) {
      setSnapshot(response.snapshot);
      setSelectedCommitId(response.snapshot.commits[0]?.id ?? "");
      setNotice(successNotice);
      return;
    }

    if (!response.canceled) {
      setSnapshot(null);
      setSelectedCommitId("");
      setNotice(response.error ?? "Choose a working folder to start.");
    }
  }

  useEffect(() => {
    if (!window.gitPeek) {
      setLoading(false);
      setNotice("Run the Electron app to choose a local working folder.");
      return;
    }

    window.gitPeek.getSnapshot().then((response) => {
      applySnapshotResponse(response);
      setLoading(false);
    });

    const unsubscribeSnapshot = window.gitPeek.onSnapshotUpdated((response) => {
      applySnapshotResponse(response, response.ok ? "Git data updated from menu." : "Working folder cleared.");
      setLoading(false);
    });
    const unsubscribeCollapsed = window.gitPeek.onCollapsedChanged(setCollapsed);

    return () => {
      unsubscribeSnapshot();
      unsubscribeCollapsed();
    };
  }, []);

  async function openRepository() {
    if (!window.gitPeek) {
      setNotice("Electron mode is required to open a local folder.");
      return;
    }

    setLoading(true);
    const response = await window.gitPeek.openRepository();
    if (response.ok) {
      setSnapshot(response.snapshot);
      setSelectedCommitId(response.snapshot.commits[0]?.id ?? "");
      setNotice(`Opened ${response.snapshot.repoName}.`);
    } else if (!response.canceled) {
      setSnapshot(null);
      setNotice(response.error ?? "Unable to open repository.");
    }
    setLoading(false);
  }

  async function refreshSnapshot() {
    if (!snapshot) {
      setNotice("Choose a working folder before refreshing Git data.");
      return;
    }

    setRefreshing(true);
    if (!window.gitPeek) {
      window.setTimeout(() => {
        setRefreshing(false);
        setNotice("Sample data refreshed.");
      }, 500);
      return;
    }

    const response = await window.gitPeek.refresh();
    setRefreshing(false);

    if (response.ok) {
      setSnapshot(response.snapshot);
      setSelectedCommitId((current) => response.snapshot.commits.find((commit) => commit.id === current)?.id ?? response.snapshot.commits[0]?.id ?? "");
      setNotice("Git status refreshed.");
    } else {
      setSnapshot(null);
      setNotice(response.error ?? "Refresh failed.");
    }
  }

  function togglePinned() {
    const next = !pinned;
    setPinned(next);
    window.gitPeek?.setPinned(next);
    setNotice(next ? "Panel pinned above other windows." : "Panel unpinned.");
  }

  function setCollapsedState(next: boolean) {
    setCollapsed(next);
    window.gitPeek?.setCollapsed(next);
  }

  function dockCurrentState() {
    window.gitPeek?.dockToEdge(collapsed);
  }

  function handleCommitAction(action: string) {
    if (action === "Checkout") {
      setNotice("Checkout is queued behind confirmation in the full graph.");
      return;
    }
    setNotice(`${action} opened for the selected commit.`);
  }

  return (
    <main className={joinClass("app-viewport", electron && "is-electron", collapsed && "is-collapsed")}>
      {!electron ? (
        <div className="editor-backdrop" aria-hidden="true">
          <div className="editor-tabs">
            <span>Menu.tsx</span>
            <span>shortcuts.ts</span>
          </div>
          <pre>{`export function Menu({ items }) {
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
}`}</pre>
        </div>
      ) : null}

      {collapsed ? (
        <CollapsedRail snapshot={snapshot} onExpand={() => setCollapsedState(false)} onDock={dockCurrentState} />
      ) : (
        <section className="peek-panel" aria-label="Git Peek side panel">
          <Header
            snapshot={snapshot}
            pinned={pinned}
            refreshing={refreshing}
            onOpen={openRepository}
            onRefresh={refreshSnapshot}
            onTogglePinned={togglePinned}
            onCollapse={() => setCollapsedState(true)}
          />

          {snapshot ? <SummaryChips snapshot={snapshot} activeFilter={fileFilter} onFilter={setFileFilter} /> : null}

          {snapshot ? (
            <>
              <div className="scroll-region">
                <RecentCommits commits={snapshot.commits} selectedId={selectedCommitId} onSelect={setSelectedCommitId} onAction={handleCommitAction} />
              </div>

              <ChangedNow files={snapshot.changedFiles} filter={fileFilter} onClearFilter={() => setFileFilter("all")} />
            </>
          ) : (
            <EmptyRepositoryState loading={loading} notice={notice} onOpen={openRepository} />
          )}

          <div className="notice-line" role="status">
            {notice}
          </div>

          <Footer
            onOpenRepo={openRepository}
            onOpenGraph={() => setNotice("Full graph opens as a larger companion view in the next build slice.")}
            hasRepository={Boolean(snapshot)}
          />
        </section>
      )}
    </main>
  );
}
