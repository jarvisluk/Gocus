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
const latestReleaseApiUrl = "https://api.github.com/repos/jarvisluk/Gocus/releases/latest";
const repositoryUrl = "https://github.com/jarvisluk/gocus";
const releasesUrl = "https://github.com/jarvisluk/gocus/releases";

type DownloadPlatform = "mac" | "windows" | "other";
type MacArchitecture = "arm64" | "x64";

type ReleaseDownloads = {
  macArm64?: string;
  macX64?: string;
  windowsInstaller?: string;
  windowsZip?: string;
};

type GitHubReleaseAsset = {
  name: string;
  browser_download_url?: string;
};

type GitHubReleaseResponse = {
  assets?: GitHubReleaseAsset[];
};

type NavigatorWithUserAgentData = Navigator & {
  userAgentData?: {
    platform?: string;
    getHighEntropyValues?: (hints: string[]) => Promise<{ architecture?: string }>;
  };
};

type DownloadTarget = {
  ariaLabel: string;
  label: string;
  navLabel: string;
  url: string;
};

type DownloadOption = {
  title: string;
  meta: string;
  body: string;
  label: string;
  url: string;
};

const workflow = [
  {
    icon: FolderOpen,
    title: "Open the agent workspace",
    body: "Point Gocus at the repository your AI-native editor is changing, then keep it beside the session.",
  },
  {
    icon: GitBranch,
    title: "Track agent commits",
    body: "Scan branch rails, selected commits, worktrees, and release tags without switching into a full IDE.",
  },
  {
    icon: MousePointer2,
    title: "Return to the editor",
    body: "Open files, inspect changed-now state, refresh history, and keep Codex, Claude Code, or Antigravity in front.",
  },
];

const features = [
  "AI-native editor companion",
  "Agent commit rails and branch tags",
  "Recent repositories and worktrees",
  "Changed-now context beside Codex, Claude Code, or Antigravity",
  "Stable compact and comfortable density modes",
  "Release-channel update links",
];

const heroContexts = [
  {
    label: "Scan",
    body: "Recent agent commits, branch labels, and file counts stay visible beside the AI session.",
  },
  {
    label: "Orient",
    body: "Current worktree and branch context stay close while the agent moves across tasks.",
  },
  {
    label: "Return",
    body: "Open the repo or target file from the same narrow panel when you need to step in.",
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

function releaseAssetUrl(assets: GitHubReleaseAsset[], pattern: RegExp) {
  return assets.find((asset) => pattern.test(asset.name))?.browser_download_url;
}

function releaseDownloadsFromResponse(release: GitHubReleaseResponse): ReleaseDownloads {
  const assets = release.assets ?? [];

  return {
    macArm64: releaseAssetUrl(assets, /^Gocus-.+-mac-arm64\.zip$/),
    macX64: releaseAssetUrl(assets, /^Gocus-.+-mac-x64\.zip$/),
    windowsInstaller: releaseAssetUrl(assets, /^Gocus-Setup-.+-win-x64\.exe$/),
    windowsZip: releaseAssetUrl(assets, /^Gocus-.+-win-x64\.zip$/),
  };
}

function useLatestReleaseDownloads() {
  const [downloads, setDownloads] = useState<ReleaseDownloads>({});

  useEffect(() => {
    let isActive = true;

    fetch(latestReleaseApiUrl, {
      headers: {
        Accept: "application/vnd.github+json",
      },
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`GitHub latest release request failed with ${response.status}`);
        }

        return response.json() as Promise<GitHubReleaseResponse>;
      })
      .then((release) => {
        if (isActive) {
          setDownloads(releaseDownloadsFromResponse(release));
        }
      })
      .catch(() => {
        if (isActive) {
          setDownloads({});
        }
      });

    return () => {
      isActive = false;
    };
  }, []);

  return downloads;
}

function downloadOptionsForRelease(downloads: ReleaseDownloads): DownloadOption[] {
  return [
    {
      title: "macOS build",
      meta: "Latest Apple Silicon zip",
      body: "For running Gocus beside Codex, Claude Code, Antigravity, and other AI-native coding sessions on macOS.",
      label: "Download macOS build",
      url: downloads.macArm64 ?? downloads.macX64 ?? latestReleaseUrl,
    },
    {
      title: "Windows build",
      meta: "Latest Windows x64 zip",
      body: "Use the Windows x64 build when your AI-native workflow runs on Windows.",
      label: "Download Windows build",
      url: downloads.windowsInstaller ?? downloads.windowsZip ?? latestReleaseUrl,
    },
  ];
}

function downloadUrlForPlatform(
  platform: DownloadPlatform,
  downloads: ReleaseDownloads,
  macArchitecture: MacArchitecture | null,
) {
  if (platform === "windows") {
    return downloads.windowsInstaller ?? downloads.windowsZip ?? latestReleaseUrl;
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
      ariaLabel: "Download Gocus for Windows",
      label: "Download for Windows",
      navLabel: "Windows",
      url,
    };
  }

  if (platform === "mac") {
    return {
      ariaLabel: "Download Gocus for macOS",
      label: "Download for macOS",
      navLabel: "macOS",
      url,
    };
  }

  return {
    ariaLabel: "Open Gocus downloads",
    label: "Choose download",
    navLabel: "Download",
    url,
  };
}

function useDownloadTarget(downloads: ReleaseDownloads) {
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
    () => downloadTargetForPlatform(platform, downloads, macArchitecture),
    [downloads, platform, macArchitecture],
  );
}

function ProductPreview() {
  return (
    <div className="product-frame" aria-label="Gocus app preview">
      <img
        className="product-screenshot"
        src="./gocus-overview.png"
        srcSet="./gocus-overview-320.png 320w, ./gocus-overview-480.png 480w, ./gocus-overview.png 640w"
        sizes="(max-width: 560px) calc(100vw - 32px), (max-width: 920px) 390px, 300px"
        width={640}
        height={1560}
        decoding="async"
        alt="Gocus commit history panel screenshot"
      />
    </div>
  );
}

function WebsiteHeader({ downloadTarget }: { downloadTarget: DownloadTarget }) {
  return (
    <header className="site-header">
      <a className="brand" href="#top" aria-label="Gocus home">
        <img src="./site-icon.png" alt="" />
        <span>Gocus</span>
      </a>
      <nav aria-label="Website navigation">
        <a href="#workflow">Workflow</a>
        <a href="#features">Use cases</a>
        <a href={repositoryUrl}>GitHub</a>
        <a href={releasesUrl}>Releases</a>
      </nav>
      <a className="nav-download" href={downloadTarget.url} aria-label={downloadTarget.ariaLabel}>
        <Download />
        {downloadTarget.navLabel}
      </a>
    </header>
  );
}

function DownloadOptions({ downloads }: { downloads: ReleaseDownloads }) {
  const downloadOptions = useMemo(() => downloadOptionsForRelease(downloads), [downloads]);

  return (
    <div className="download-list">
      {downloadOptions.map((option) => (
        <article className="download-option" key={option.title}>
          <div>
            <div className="download-option-heading">
              <h3>{option.title}</h3>
              <span>{option.meta}</span>
            </div>
            <p>{option.body}</p>
          </div>
          <a className="download-option-cta" href={option.url}>
            <Download />
            {option.label}
            <ArrowRight />
          </a>
        </article>
      ))}
    </div>
  );
}

export function WebsiteApp() {
  const downloads = useLatestReleaseDownloads();
  const downloadTarget = useDownloadTarget(downloads);

  return (
    <main className="site-shell" id="top">
      <WebsiteHeader downloadTarget={downloadTarget} />

      <section className="hero-section" aria-labelledby="hero-title">
        <div className="hero-copy">
          <h1 id="hero-title">Gocus</h1>
          <p className="hero-lede">See AI-agent Git history without leaving your flow.</p>
          <p className="hero-body">
            A compact side-floating Git surface for Codex, Claude Code, Antigravity, and other AI-native editors.
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
              <span>AI-native loop</span>
              <strong>Keep small Git checks close while the agent editor stays in front.</strong>
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
          <p>Use Gocus as the Git layer beside agent-first editors, where commits and worktrees move faster than a traditional IDE sidebar.</p>
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
            <h2 id="feature-title">Made for AI-native coding sessions</h2>
            <p>
              Gocus keeps the high-frequency parts of repository state visible when the coding surface is Codex, Claude Code, or Antigravity instead of an IDE-centered workflow.
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
          <h2 id="download-title">Download Gocus</h2>
          <p>Choose the build for the machine running your AI-native coding sessions. The header and hero CTA still adapt to your current OS.</p>
        </div>
        <DownloadOptions downloads={downloads} />
      </section>
    </main>
  );
}
