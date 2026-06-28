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
import { useEffect, useMemo, useState } from "react";

const latestReleaseUrl = "https://github.com/jarvisluk/gocus/releases/latest";
const releasesUrl = "https://github.com/jarvisluk/gocus/releases";
const releaseDownloads = {
  macArm64: "https://github.com/jarvisluk/Gocus/releases/download/v0.1.3/Gocus-0.1.3-mac-arm64.zip",
  windowsInstaller:
    "https://github.com/jarvisluk/Gocus/releases/download/v0.1.3/Gocus-Setup-0.1.3-win-x64.exe",
};

type DownloadPlatform = "mac" | "windows" | "other";
type MacArchitecture = "arm64" | "x64";

type ReleaseDownloads = {
  macArm64?: string;
  macX64?: string;
  windowsInstaller?: string;
};

type NavigatorWithUserAgentData = Navigator & {
  userAgentData?: {
    platform?: string;
    getHighEntropyValues?: (hints: string[]) => Promise<{ architecture?: string }>;
  };
};

type DownloadTarget = {
  ariaLabel: string;
  body: string;
  label: string;
  navLabel: string;
  title: string;
  url: string;
};

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
  "Side-floating desktop panel",
  "Commit graph rails and branch tags",
  "Recent repositories and worktrees",
  "Changed-now context beside your editor",
  "Stable compact and comfortable density modes",
  "Release-channel update links",
];

const heroContexts = [
  {
    label: "Scan",
    body: "Recent commits, branch labels, and file counts stay visible beside your editor.",
  },
  {
    label: "Orient",
    body: "Current worktree and branch context stay close when you move between tasks.",
  },
  {
    label: "Return",
    body: "Open the repo or editor target from the same narrow panel when you are ready.",
  },
];

function detectDownloadPlatform(): DownloadPlatform {
  if (typeof navigator === "undefined") {
    return "mac";
  }

  const nav = navigator as NavigatorWithUserAgentData;
  const platformSource = `${nav.userAgentData?.platform ?? ""} ${nav.platform} ${nav.userAgent}`;

  if (/windows|win32|win64/i.test(platformSource)) {
    return "windows";
  }

  if (/mac|iphone|ipad|ipod/i.test(platformSource)) {
    return "mac";
  }

  return "other";
}

function macArchitectureFromValue(value?: string): MacArchitecture | null {
  if (!value) {
    return null;
  }

  if (/arm|aarch64/i.test(value)) {
    return "arm64";
  }

  if (/x64|x86|amd64|intel/i.test(value)) {
    return "x64";
  }

  return null;
}

async function detectMacArchitecture(): Promise<MacArchitecture | null> {
  if (typeof navigator === "undefined") {
    return null;
  }

  const nav = navigator as NavigatorWithUserAgentData;
  const highEntropyValues = await nav.userAgentData?.getHighEntropyValues?.(["architecture"]);
  return macArchitectureFromValue(highEntropyValues?.architecture) ?? macArchitectureFromValue(nav.platform);
}

function downloadUrlForPlatform(
  platform: DownloadPlatform,
  downloads: ReleaseDownloads,
  macArchitecture: MacArchitecture | null,
) {
  if (platform === "windows") {
    return downloads.windowsInstaller ?? latestReleaseUrl;
  }

  if (platform === "mac") {
    if (macArchitecture === "x64" && downloads.macX64) {
      return downloads.macX64;
    }

    if (macArchitecture === "x64") {
      return latestReleaseUrl;
    }

    return downloads.macArm64 ?? downloads.macX64 ?? latestReleaseUrl;
  }

  return latestReleaseUrl;
}

function downloadTargetForPlatform(
  platform: DownloadPlatform,
  downloads: ReleaseDownloads,
  macArchitecture: MacArchitecture | null,
): DownloadTarget {
  const url = downloadUrlForPlatform(platform, downloads, macArchitecture);

  if (platform === "windows") {
    return {
      ariaLabel: "Download Gocus Windows Installer",
      body: "Use the latest Windows Installer from GitHub Releases. Portable and zip assets stay available on the release page.",
      label: "Download for Windows",
      navLabel: "Windows",
      title: "Download the Windows Installer",
      url,
    };
  }

  if (platform === "mac") {
    return {
      ariaLabel: "Download Gocus for macOS",
      body: "Use the latest macOS release build now, then switch channels from inside the app when develop builds are available.",
      label: "Download for macOS",
      navLabel: "macOS",
      title: "Download the macOS build",
      url,
    };
  }

  return {
    ariaLabel: "Open Gocus downloads",
    body: "Pick the Windows Installer or macOS build from the latest GitHub Release.",
    label: "Choose download",
    navLabel: "Download",
    title: "Choose your Gocus build",
    url,
  };
}

function useDownloadTarget() {
  const [platform, setPlatform] = useState<DownloadPlatform>(() => detectDownloadPlatform());
  const [macArchitecture, setMacArchitecture] = useState<MacArchitecture | null>(null);

  useEffect(() => {
    let isActive = true;

    setPlatform(detectDownloadPlatform());

    detectMacArchitecture()
      .then((architecture) => {
        if (isActive) {
          setMacArchitecture(architecture);
        }
      })
      .catch(() => {
        if (isActive) {
          setMacArchitecture(null);
        }
      });

    return () => {
      isActive = false;
    };
  }, []);

  return useMemo(
    () => downloadTargetForPlatform(platform, releaseDownloads, macArchitecture),
    [platform, macArchitecture],
  );
}

function ProductPreview() {
  return (
    <div className="product-frame" aria-label="Gocus app preview">
      <img className="product-screenshot" src="/gocus-overview.png" alt="Gocus commit history panel screenshot" />
    </div>
  );
}

function WebsiteHeader({ downloadTarget }: { downloadTarget: DownloadTarget }) {
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
      <a className="nav-download" href={downloadTarget.url} aria-label={downloadTarget.ariaLabel}>
        <Download />
        {downloadTarget.navLabel}
      </a>
    </header>
  );
}

export function WebsiteApp() {
  const downloadTarget = useDownloadTarget();

  return (
    <main className="site-shell" id="top">
      <WebsiteHeader downloadTarget={downloadTarget} />

      <section className="hero-section" aria-labelledby="hero-title">
        <div className="hero-copy">
          <h1 id="hero-title">Gocus</h1>
          <p className="hero-lede">See your Git history without leaving your flow.</p>
          <p className="hero-body">
            A compact side-floating desktop utility for commits, worktrees, branch context, and quick repository actions.
          </p>
          <div className="hero-actions">
            <a className="primary-cta" href={downloadTarget.url} aria-label={downloadTarget.ariaLabel}>
              <Download />
              {downloadTarget.label}
            </a>
            <a className="secondary-cta" href={releasesUrl}>
              <Github />
              View GitHub Releases
            </a>
          </div>
          <aside className="hero-context-panel" aria-label="Gocus daily use cases">
            <div className="hero-context-heading">
              <span>Daily loop</span>
              <strong>Keep the small Git checks close while your editor stays in front.</strong>
            </div>
            <div className="hero-context-grid">
              {heroContexts.map((item) => (
                <div className="hero-context-item" key={item.label}>
                  <span>{item.label}</span>
                  <p>{item.body}</p>
                </div>
              ))}
            </div>
          </aside>
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
          <h2 id="download-title">{downloadTarget.title}</h2>
          <p>{downloadTarget.body}</p>
        </div>
        <a className="primary-cta" href={downloadTarget.url} aria-label={downloadTarget.ariaLabel}>
          <Download />
          {downloadTarget.label}
          <ArrowRight />
        </a>
      </section>
    </main>
  );
}
