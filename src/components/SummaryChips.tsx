import { CheckCircle2, CircleHelp, FileCode2 } from "lucide-react";
import { joinClass } from "../lib/classNames";
import type { FileFilter, GitSnapshot } from "../types";

export function SummaryChips({
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
