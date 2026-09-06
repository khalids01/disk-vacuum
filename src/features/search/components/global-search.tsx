import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { FileIcon, FolderIcon, SearchIcon, XIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { currentScanQuery } from "@/features/scan/api/scan-queries";
import { formatBytes } from "@/features/scan/lib/format-bytes";
import { formatScanCategory } from "@/features/scan/lib/scan-category";
import {
  type ScanSearchResult,
  searchScan,
} from "@/features/search/api/search-api";
import { useSearchStore } from "@/stores/search-store";

const SEARCH_LIMIT = 50;
const SEARCH_DELAY_MS = 400;

export function GlobalSearch() {
  const isOpen = useSearchStore((state) => state.isOpen);
  const openSearch = useSearchStore((state) => state.openSearch);
  const closeSearch = useSearchStore((state) => state.closeSearch);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const currentScan = useQuery(currentScanQuery);
  const normalizedQuery = debouncedQuery.trim();
  const search = useQuery({
    queryKey: [
      "scan-search",
      currentScan.data?.completedAtUnixSeconds,
      normalizedQuery,
    ],
    queryFn: () => searchScan(normalizedQuery, SEARCH_LIMIT),
    enabled: isOpen && Boolean(currentScan.data) && normalizedQuery.length >= 2,
    staleTime: 0,
    gcTime: 30_000,
  });
  const results = search.data?.superseded ? [] : (search.data?.results ?? []);

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        openSearch();
      } else if (event.key === "Escape" && useSearchStore.getState().isOpen) {
        event.preventDefault();
        closeSearch();
      }
    }
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [closeSearch, openSearch]);

  useEffect(() => {
    if (!isOpen) return;
    inputRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setQuery("");
      setDebouncedQuery("");
      setActiveIndex(0);
      return;
    }

    const timeout = window.setTimeout(
      () => setDebouncedQuery(query),
      SEARCH_DELAY_MS,
    );
    return () => window.clearTimeout(timeout);
  }, [isOpen, query]);

  function openResult(result: ScanSearchResult) {
    const directoryId =
      result.kind === "directory" ? result.id : result.parentDirectoryId;
    closeSearch();
    void navigate({ to: "/explorer", search: { directoryId } });
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeSearch();
    } else if (event.key === "ArrowDown" && results.length > 0) {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % results.length);
    } else if (event.key === "ArrowUp" && results.length > 0) {
      event.preventDefault();
      setActiveIndex((index) => (index - 1 + results.length) % results.length);
    } else if (event.key === "Enter" && results[activeIndex]) {
      event.preventDefault();
      openResult(results[activeIndex]);
    }
  }

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center bg-black/50 sm:p-6 lg:pt-[10vh]"
      role="presentation"
    >
      <button
        type="button"
        className="absolute inset-0"
        aria-label="Close search"
        onClick={closeSearch}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Search scanned storage"
        className="relative z-10 flex h-svh w-full flex-col border-border bg-card shadow-2xl sm:h-auto sm:max-h-[min(44rem,calc(100svh-3rem))] sm:max-w-3xl sm:rounded-xl sm:border"
      >
        <div className="flex items-center gap-3 border-b border-border px-4 sm:px-5">
          <SearchIcon className="size-5 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Search names or paths…"
            aria-label="Search names or paths"
            className="h-14 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
          />
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Close search"
            onClick={closeSearch}
          >
            <XIcon />
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-2 sm:max-h-[34rem]">
          {!currentScan.data ? (
            <SearchMessage
              title="No completed scan"
              description="Complete a scan before searching storage."
            />
          ) : query.trim().length < 2 ? (
            <SearchMessage
              title="Search scanned storage"
              description="Type at least two characters. Use / to match path components."
            />
          ) : search.isPending || normalizedQuery !== query.trim() ? (
            <SearchMessage
              title="Searching cached index…"
              description="No filesystem rescan is required."
            />
          ) : search.isError ? (
            <SearchMessage
              title="Search unavailable"
              description={
                search.error instanceof Error
                  ? search.error.message
                  : "The cached index could not be searched."
              }
              destructive
            />
          ) : results.length === 0 ? (
            <SearchMessage
              title="No matches"
              description={`Nothing in this scan matched “${query.trim()}”.`}
            />
          ) : (
            <div
              role="listbox"
              aria-label="Search results"
              className="space-y-1"
            >
              {results.map((result, index) => {
                const isActive = index === activeIndex;
                const Icon =
                  result.kind === "directory" ? FolderIcon : FileIcon;
                return (
                  <button
                    key={`${result.parentDirectoryId}-${result.id}`}
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${isActive ? "bg-primary/10" : "hover:bg-muted"}`}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => openResult(result)}
                  >
                    <span className="grid size-9 shrink-0 place-items-center rounded-md bg-muted text-primary">
                      <Icon className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {result.name}
                      </span>
                      <span className="block truncate font-mono text-xs text-muted-foreground">
                        {result.path}
                      </span>
                    </span>
                    <span className="hidden shrink-0 text-right sm:block">
                      <span className="block font-mono text-xs">
                        {formatBytes(result.sizeBytes)}
                      </span>
                      <span className="block text-[11px] text-muted-foreground">
                        {result.kind} · {formatScanCategory(result.category)}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {search.data && results.length > 0 && (
          <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-2 text-xs text-muted-foreground sm:px-5">
            <span>
              Showing {results.length} of{" "}
              {search.data.matchedCount.toLocaleString()} matches
            </span>
            <span>{search.data.elapsedMilliseconds.toLocaleString()} ms</span>
          </div>
        )}
      </section>
    </div>
  );
}

function SearchMessage({
  title,
  description,
  destructive = false,
}: {
  title: string;
  description: string;
  destructive?: boolean;
}) {
  return (
    <div className="grid min-h-52 place-items-center px-6 text-center">
      <div>
        <p
          className={`text-sm font-semibold ${destructive ? "text-destructive" : ""}`}
        >
          {title}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
