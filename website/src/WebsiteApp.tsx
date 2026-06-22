import {
  ArrowRight,
  Check,
  ChevronDown,
  Download,
  FileCode2,
  FolderOpen,
  GitBranch,
  Github,
  MousePointer2,
  Pin,
  RefreshCw,
  Search,
  Settings,
  Sparkles,
} from "lucide-react";

const latestReleaseUrl = "https://github.com/jarvisluk/gocus/releases/latest";
const releasesUrl = "https://github.com/jarvisluk/gocus/releases";

const commits = [
  {
    title: "feat: preview release updates",
    hash: "4ebb965",
    time: "13 minutes ago",
    branch: "main",
    branchClassName: "branch-main",
    additions: "+4",
    deletions: "-3",
    files: "1",
    rail: "rail-main",
  },
  {
    title: "ci: add release candidate build",
    hash: "604d086",
    time: "2 hours ago",
    branch: "v0.1.2",
    branchClassName: "branch-tag",
    additions: "+402",
    deletions: "-106",
    files: "6",
    rail: "rail-main",
  },
  {
    title: "fix: center selected commit after search",
    hash: "2b11942",
    time: "2 hours ago",
    branch: "",
    branchClassName: "",
    additions: "+50",
    deletions: "-37",
    files: "1",
    rail: "rail-main",
  },
  {
    title: "fix: include merged worktree state",
    hash: "cd4b3ce",
    time: "40 minutes ago",
    branch: "feature/settings",
    branchClassName: "branch-feature",
    additions: "+72",
    deletions: "-5",
    files: "2",
    rail: "rail-feature",
  },
];

const workflow = [
  {
    icon: FolderOpen,
    title: "Open repo",
    body: "Point Gocus at a repository or jump between recent workspaces from the footer.",
  },
  {
    icon: GitBranch,
    title: "Track commits",
    body: "Scan branch rails, selected commits, worktrees, and release tags in one narrow surface.",
  },
  {
    icon: MousePointer2,
    title: "Act on changes",
    body: "Open files, inspect changed-now state, refresh history, and keep your editor in front.",
  },
];

const features = [
  "Side-floating macOS panel",
  "Commit graph rails and branch tags",
  "Recent repositories and worktrees",
  "Changed-now context beside your editor",
  "Stable compact and comfortable density modes",
  "Release-channel update links",
];

function ProductMockup() {
  return (
    <div className="product-frame" aria-label="Gocus app preview">
      <div className="mock-panel">
        <header className="mock-header">
          <img src="/app-icon.png" alt="" className="mock-logo" />
          <div className="mock-title">
            <strong>Gocus</strong>
            <span>/Users/junrong/codesp...</span>
          </div>
          <button type="button" aria-label="Repository menu">
            <ChevronDown />
          </button>
          <button type="button" aria-label="Pin panel">
            <Pin />
          </button>
          <button type="button" aria-label="Refresh commits">
            <RefreshCw />
          </button>
        </header>

        <div className="mock-tabs" aria-hidden="true">
          <span className="is-active">All</span>
          <span>Current</span>
          <span>
            <GitBranch />
            Branch
          </span>
        </div>

        <div className="mock-worktree">
          <GitBranch />
          <div>
            <span>Current worktree</span>
            <strong>main</strong>
          </div>
          <button type="button">
            3 worktrees
            <ChevronDown />
          </button>
        </div>

        <div className="mock-section-title">
          <strong>Commits</strong>
          <span>Showing 298</span>
          <Search />
        </div>

        <div className="commit-list" aria-hidden="true">
          {commits.map((commit) => (
            <article className="commit-row" key={commit.hash}>
              <div className={`commit-rail ${commit.rail}`} />
              <div className="commit-content">
                <div className="commit-title-line">
                  <strong>{commit.title}</strong>
                  {commit.branch ? <span className={`branch-pill ${commit.branchClassName}`}>{commit.branch}</span> : null}
                </div>
                <p>
                  <code>{commit.hash}</code>
                  <span>{commit.time}</span>
                </p>
                <div className="commit-stats">
                  <span className="additions">{commit.additions}</span>
                  <span className="deletions">{commit.deletions}</span>
                  <span>
                    <FileCode2 />
                    {commit.files}
                  </span>
                </div>
              </div>
            </article>
          ))}
        </div>

        <footer className="mock-footer">
          <button type="button" aria-label="Settings">
            <Settings />
          </button>
          <span>Git data updated from menu.</span>
          <button type="button" className="editor-button" aria-label="Open in editor">
            <span>VS</span>
          </button>
        </footer>
      </div>
    </div>
  );
}

function WebsiteHeader() {
  return (
    <header className="site-header">
      <a className="brand" href="#top" aria-label="Gocus home">
        <img src="/app-icon.png" alt="" />
        <span>Gocus</span>
      </a>
      <nav aria-label="Website navigation">
        <a href="#workflow">Workflow</a>
        <a href="#features">Use cases</a>
        <a href={releasesUrl}>Releases</a>
      </nav>
      <a className="nav-download" href={latestReleaseUrl}>
        <Download />
        Download
      </a>
    </header>
  );
}

export function WebsiteApp() {
  return (
    <main className="site-shell" id="top">
      <WebsiteHeader />

      <section className="hero-section" aria-labelledby="hero-title">
        <div className="hero-copy">
          <h1 id="hero-title">Gocus</h1>
          <p className="hero-lede">See your Git history without leaving your flow.</p>
          <p className="hero-body">
            A compact side-floating macOS utility for commits, worktrees, branch context, and quick repository actions.
          </p>
          <div className="hero-actions">
            <a className="primary-cta" href={latestReleaseUrl}>
              <Download />
              Download for macOS
            </a>
            <a className="secondary-cta" href={releasesUrl}>
              <Github />
              View GitHub Releases
            </a>
          </div>
        </div>
        <ProductMockup />
      </section>

      <section className="workflow-section" id="workflow" aria-labelledby="workflow-title">
        <div className="section-heading">
          <h2 id="workflow-title">How it works</h2>
          <p>Keep the Git surface beside your editor and move from context to action in a few clicks.</p>
        </div>
        <div className="workflow-grid">
          {workflow.map((item) => (
            <article className="workflow-card" key={item.title}>
              <item.icon />
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="feature-section" id="features" aria-labelledby="feature-title">
        <div className="feature-panel">
          <div>
            <h2 id="feature-title">Made for repeated Git checks</h2>
            <p>
              Gocus keeps the high-frequency parts of repository state visible without turning your desktop into another dashboard.
            </p>
          </div>
          <ul>
            {features.map((feature) => (
              <li key={feature}>
                <Check />
                {feature}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="download-section" id="download" aria-labelledby="download-title">
        <Sparkles aria-hidden="true" />
        <div>
          <h2 id="download-title">Download the macOS build</h2>
          <p>Use the latest release asset now, then switch channels from inside the app when develop builds are available.</p>
        </div>
        <a className="primary-cta" href={latestReleaseUrl}>
          <Download />
          Download for macOS
          <ArrowRight />
        </a>
      </section>
    </main>
  );
}
