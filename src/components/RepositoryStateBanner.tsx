import { AlertTriangle } from "lucide-react";
import { repositoryStateBannerView } from "../lib/repositoryStateView";
import type { GitRepositoryState } from "../types";

export function RepositoryStateBanner({ state }: { state: GitRepositoryState }) {
  const view = repositoryStateBannerView(state);
  if (!view) return null;

  return (
    <section className={view.className} role={view.role} aria-live={view.ariaLive}>
      <AlertTriangle aria-hidden="true" />
      <div>
        <strong>{view.title}</strong>
        <span>{view.detail}</span>
      </div>
    </section>
  );
}
