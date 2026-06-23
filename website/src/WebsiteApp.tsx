import {
  ArrowRight,
  Check,
  Download,
  FolderOpen,
  GitBranch,
  Github,
  MousePointer2,
  Sparkles,
} from "lucide-react";

const latestReleaseUrl = "https://github.com/jarvisluk/gocus/releases/latest";
const releasesUrl = "https://github.com/jarvisluk/gocus/releases";

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

function ProductPreview() {
  return (
    <div className="product-frame" aria-label="Gocus app preview">
      <img className="product-screenshot" src="/gocus-overview.png" alt="Gocus commit history panel screenshot" />
    </div>
  );
}

function WebsiteHeader() {
  return (
    <header className="site-header">
      <a className="brand" href="#top" aria-label="Gocus home">
        <img src="/site-icon.png" alt="" />
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
        <ProductPreview />
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
