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
      label: "Changed",
      value: snapshot.counts.modified,
    },
    {
      key: "staged" as const,
      label: "Staged",
      value: snapshot.counts.staged,
    },
    {
      key: "untracked" as const,
      label: "New",
      value: snapshot.counts.untracked,
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
          <span>{chip.label}</span>
          <strong>{chip.value}</strong>
        </button>
      ))}
    </section>
  );
}
