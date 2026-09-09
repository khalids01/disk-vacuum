# DiskVacuum UX improvement plan

## Goal

Make DiskVacuum feel like one calm, guided storage workflow: understand the disk, find meaningful opportunities, review consequences, and reclaim space safely. Advanced tools remain available through the workflow without dominating the first screen.

## Product principles

1. Lead with the user goal, not implementation terminology.
2. Show one clear primary action per state.
3. Give immediate feedback for every operation that can take noticeable time.
4. Explain consequences before technical detail.
5. Never present estimated, overlapping, or unverified bytes as safely reclaimable.
6. Keep cleanup review-first; automatic actions require a strict backend allowlist.
7. Use progressive disclosure for advanced filters and system details.
8. Keep interaction patterns consistent across analyzers.

## Phase 1 — Command center and navigation

- Reduce primary navigation to Overview, Explore Files, Clean Up, and Settings.
- Keep specialized analyzers discoverable through Clean Up rather than exposing ten equal destinations.
- Turn Overview into a storage-health command center.
- Show available space, usage pressure, scan freshness, and clear next actions.
- Keep storage map and category detail below the decision layer.
- Move system details into the Settings journey.

Acceptance:

- A first-time user can identify the next action within five seconds.
- Every existing feature remains reachable.
- No additional expensive analysis runs merely from opening Overview.
- Desktop and narrow-window navigation remain usable.

## Phase 2 — Shared language and visual hierarchy

- Replace internal labels with Safe to remove, Review recommended, Personal file, and Protected.
- Add short consequence copy to every cleanup category and candidate.
- Standardize badges, filter labels, section headers, empty states, and errors.
- Reduce equal-weight bordered boxes and establish one dominant area per page.
- Add accurate skeletons for page-level loading states.

Acceptance:

- No user-facing camelCase, slug, or backend enum labels.
- Safety colors and wording mean the same thing everywhere.
- Empty, filtered-empty, not-analyzed, running, failed, and complete states are distinct.

## Phase 3 — Unified cleanup queue

- Add one shared cleanup selection store.
- Let supported analyzer pages add/remove candidates without blocking the checkbox UI.
- Show a persistent selection bar with item count and non-overlapping total.
- Group final review by consequence and source.
- Revalidate every item in Rust immediately before moving it to Trash.
- Show completed, rejected, changed, and failed items separately.

Acceptance:

- Selection responds immediately.
- Protected items cannot enter the queue.
- The queue survives route changes but is cleared or reconciled after a new scan.
- Reported reclaimable size never double-counts overlapping candidates.

## Phase 4 — Long-running operation UX

- Standardize scan, indexing, duplicate analysis, cleanup validation, and cleanup progress.
- Show a plain-language phase, useful counters, elapsed time, cancel state, and next phase.
- Use percentages only when the denominator is real.
- Show indeterminate progress with live counters otherwise.
- Move expensive analysis out of navigation/render paths and run it explicitly or lazily.

Acceptance:

- The UI acknowledges an action within 100 ms.
- No navigation click performs synchronous heavy filtering.
- No long operation appears frozen.
- Cancellation has an explicit cancelling and final state.

## Phase 5 — Quick Clean

- Start with deterministic regeneratable caches only.
- Implement a platform-specific Rust allowlist with path ownership and application markers.
- Exclude personal files, models, sessions, downloads, source trees, unknown caches, symlinks, mounts, and protected paths.
- Preview every target and explain regeneration cost.
- Revalidate paths, metadata, scan generation, and exclusions immediately before cleanup.
- Use operating-system Trash unless a separately reviewed cache API requires another safe mechanism.

Acceptance:

- Every Quick Clean rule has fixture tests and a documented consequence.
- Tests prove near-match and adversarial paths are rejected.
- Real cleanup is tested only on disposable data first.
- Linux and macOS behavior are verified independently before enabling the feature by default.
- If certainty is below 100 percent, the item remains review-only.

## Phase 6 — Performance, accessibility, and release polish

- Lazy-load noncritical dialogs and feature routes.
- Reduce the initial JavaScript bundle and avoid eager analyzer queries.
- Verify keyboard navigation, focus restoration, screen-reader labels, contrast, and reduced motion.
- Test empty, huge, permission-limited, cancelled, stale, and corrupt-index states.
- Run platform-specific release checks on Linux and macOS.

Acceptance:

- Startup and primary navigation remain responsive on large saved scans.
- No accessibility-critical findings in the primary scan-to-cleanup journey.
- Installer and updater flows are verified from an older installed version.

## Delivery order

Each phase is implemented and committed independently. Safety and correctness checks run after every phase. Quick Clean does not begin until the shared queue, consequence language, and long-operation UX are stable.
