import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CommitItem } from "../types";
import {
  commitListView,
  commitSearchStateAfterAvailability,
  commitSearchStateAfterClose,
  commitSearchStateAfterToggle,
  commitSearchStateApplication,
  type CommitSearchStateTransition,
} from "./commitListView";

export function useCommitSearch(commits: readonly CommitItem[]) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchToggleRef = useRef<HTMLButtonElement>(null);
  const view = useMemo(() => commitListView(commits, searchQuery, searchOpen), [commits, searchOpen, searchQuery]);

  const applySearchState = useCallback((nextState: CommitSearchStateTransition) => {
    const application = commitSearchStateApplication(nextState);
    if (application.updateState) {
      setSearchQuery(application.searchQuery);
      setSearchOpen(application.searchOpen);
    }
    if (application.restoreToggleFocus) searchToggleRef.current?.focus();
  }, []);

  const closeSearch = useCallback(
    ({ restoreFocus = false }: { restoreFocus?: boolean } = {}) => {
      applySearchState(commitSearchStateAfterClose({ searchOpen, searchQuery }, { restoreFocus }));
    },
    [applySearchState, searchOpen, searchQuery],
  );

  const toggleSearch = useCallback(() => {
    applySearchState(commitSearchStateAfterToggle({ searchOpen, searchQuery }, view.searchToggle));
  }, [applySearchState, searchOpen, searchQuery, view.searchToggle]);

  useEffect(() => {
    if (!searchOpen) return;
    searchInputRef.current?.focus();
    searchInputRef.current?.select();
  }, [searchOpen]);

  useEffect(() => {
    applySearchState(commitSearchStateAfterAvailability({ searchOpen, searchQuery }, view.canSearch));
  }, [applySearchState, view.canSearch, searchOpen, searchQuery]);

  return {
    ...view,
    searchInputRef,
    searchOpen,
    searchQuery,
    searchToggleRef,
    setSearchQuery,
    closeSearch,
    toggleSearch,
  };
}
