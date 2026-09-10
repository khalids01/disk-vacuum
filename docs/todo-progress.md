# DiskVacuum — Progress Tracker

> Codex: update this file as work is completed.
>
> Use:
>
> - `[ ]` not started
> - `[-]` in progress
> - `[x]` complete
> - `[!]` blocked / needs decision
>
> Do not mark a phase complete until its phase checks in `steps-summary-checks.md` pass.

---

## Current Status

- Current phase: **Quality, onboarding, and release readiness**
- Current task: **UX improvement Phase 1 — command center and navigation**
- UX plan: `docs/ux-improvement-plan.md`
- macOS dev run: [!]
- Linux dev run: [x]
- First release target: **macOS + Linux**
- Windows: Later
- Android: Later

---

# Phase 0 — Baseline

- [x] Confirm app name is `DiskVacuum`
- [x] Confirm Tauri identifier
- [!] Confirm project builds on macOS
- [x] Confirm project builds/runs on Linux
- [!] Confirm React/Vite hot reload
- [x] Add/verify formatting command
- [x] Add/verify TypeScript lint command
- [x] Add/verify Rust `cargo fmt`
- [x] Add/verify Rust `cargo clippy`
- [x] Confirm clean `bun run build`
- [x] Commit clean baseline before structural work

---

# Phase 1 — Frontend Project Structure

- [x] Create `src/app`
- [x] Create `src/routes`
- [x] Create `src/components/core`
- [x] Create `src/components/layout`
- [x] Create `src/features`
- [x] Create `src/lib`
- [x] Create `src/styles`
- [x] Configure TanStack Router
- [x] Create app provider composition
- [x] Configure TanStack Query
- [x] Configure Zustand location for global stores
- [x] Keep route files thin
- [x] Verify project still runs

## Feature directories

- [x] `features/scan`
- [x] `features/overview`
- [x] `features/explorer`
- [x] `features/cleanup`
- [x] `features/large-files`
- [x] `features/duplicates`
- [x] `features/developer-cleanup`
- [x] `features/ai-storage`
- [x] `features/app-leftovers`
- [x] `features/system`
- [x] `features/settings`
- [x] `features/search`

---

# Phase 2 — Rust/Tauri Structure

Create only required modules; do not create empty architecture for appearance.

- [x] Keep `main.rs` minimal
- [x] Keep Tauri bootstrap in `lib.rs`
- [x] Add managed `app_state` when first needed
- [x] Add `features` module when first backend feature begins
- [x] Add `platform` module when platform behavior is introduced
- [x] Add `safety` module before destructive operations
- [x] Add `common` helpers only for proven shared logic
- [x] Verify `cargo fmt`
- [x] Verify `cargo clippy`

---

# Phase 3 — Theme Foundation

- [x] Tailwind configured
- [x] shadcn configured
- [x] Dark theme tokens
- [x] Light/system theme plumbing
- [x] Background tokens
- [x] Surface tokens
- [x] Border tokens
- [x] Text tokens
- [x] Primary accent tokens
- [x] Success/warning/danger tokens
- [x] Typography scale
- [x] Radius scale
- [x] Spacing conventions
- [x] Focus-visible styles
- [x] Disabled styles
- [x] Selection styles
- [x] Scrollbar treatment if needed
- [x] Responsive breakpoint conventions
- [x] No Reclaim-red visual clone
- [x] Remove starter Vite styles/assets

---

# Phase 4 — App Shell

## Desktop

- [x] App shell
- [x] Sidebar
- [x] Scan controls area
- [x] Storage summary card
- [x] Navigation groups
- [x] Active states
- [x] Disabled states
- [x] Loading/badge support
- [x] Top command bar
- [x] Search trigger
- [x] Rescan action
- [x] Main content container

## Responsive

- [x] Compact desktop sidebar behavior
- [x] Tablet drawer/rail behavior
- [x] Mobile top app bar
- [x] Mobile bottom navigation
- [x] “More” navigation sheet
- [x] No horizontal overflow
- [x] Narrow window tested

---

# Phase 5 — Routes & Page Skeletons

- [x] `/overview`
- [x] `/explorer`
- [x] `/cleanup`
- [x] `/large-files`
- [x] `/duplicates`
- [x] `/developer-cleanup`
- [x] `/ai-storage`
- [x] `/app-leftovers`
- [x] `/system`
- [x] `/settings`
- [x] Default route redirects/lands correctly
- [x] 404/fallback behavior
- [x] Route title/active-nav behavior

---

# Phase 6 — Core Components

Only create when needed.

- [x] `PageHeader`
- [x] `SectionCard`
- [x] `Metric`
- [x] `StorageProgress`
- [x] `SafetyBadge`
- [x] `FileTypeIcon`
- [x] `PathText`
- [x] `EmptyState`
- [x] `LoadingState`
- [x] `ErrorState`
- [x] `FilterBar`
- [x] `SelectionSummary`
- [x] `ConfirmActionDialog`
- [x] `AppSheet`
- [x] `AppDialog`
- [x] Responsive list/table primitive if proven useful
- [x] No speculative “universal component” abstractions

---

# Phase 7 — Space Map UI

## Structure

- [x] `features/overview/pages/overview-page.tsx`
- [x] `features/overview/components/sections`
- [x] Overview summary section
- [x] Treemap section
- [x] Selected-item detail section

## UI states

- [x] No scan
- [x] Scanning
- [x] Scan complete
- [x] Scan failed
- [x] Scan cancelled
- [x] Permission-limited scan

## Treemap

- [x] Mock treemap
- [x] Category color mapping
- [x] Labels
- [x] Hover
- [x] Selection
- [x] Drill-down
- [x] Breadcrumb
- [x] Back navigation
- [x] Context menu
- [x] Item detail
- [x] Mobile bottom-sheet detail
- [x] Tablet layout
- [x] Mobile layout

---

# Phase 8 — Disk Explorer UI

- [x] Explorer page sections
- [x] Root/volume header
- [x] Breadcrumb
- [x] Back action
- [x] Item count
- [x] Sort
- [x] Filter layout
- [x] Desktop table
- [x] Directory row
- [x] File row
- [x] Row selection
- [x] Row actions
- [x] Empty state
- [x] Loading state
- [x] Error state
- [x] Mobile list-card fallback
- [x] Long path handling
- [x] Narrow-window behavior

---

# Phase 9 — Cleanup Hub UI

- [x] Header metrics
- [x] Safe category list
- [x] Category accordions
- [x] Item counts
- [x] Selected size
- [x] Safety labels
- [x] Select all safe behavior
- [x] Review action
- [x] Cleanup review UI
- [x] Risk grouping
- [x] Final confirmation UI
- [x] Cleanup result UI
- [x] Mobile layout
- [x] Empty state

---

# Phase 10 — Large Files UI

- [x] Header
- [x] Total large-file metric
- [x] Selected metric
- [x] Threshold control
- [x] Type filter
- [x] Size filter
- [x] Age filter
- [x] Sort
- [x] Desktop table
- [x] Review/safety states
- [x] Selection
- [x] Row actions
- [x] Empty state
- [x] Mobile list layout
- [x] Large dataset virtualization strategy

---

# Phase 11 — Duplicate Finder UI

- [x] Header metrics
- [x] Duplicate group count
- [x] Wasted-space metric
- [x] Smart select action
- [x] Group component
- [x] Keep recommendation
- [x] Copy rows
- [x] Manual selection
- [x] Never-select-all-copies safeguard in UI
- [x] Path display
- [x] Modified date
- [x] Empty state
- [x] Loading/progress state
- [x] Mobile group cards

---

# Phase 12 — Developer Cleanup UI

- [x] Header metrics
- [x] Category accordions
- [x] Node modules
- [x] Python virtual envs
- [x] Python cache
- [x] Rust targets
- [x] Build outputs
- [x] Package cache placeholder
- [x] Project/tool context
- [x] Regeneration explanation
- [x] Selection
- [x] Review flow
- [x] Mobile layout

---

# Phase 13 — AI Storage UI

- [x] Header metrics
- [x] Tool groups
- [x] Models group
- [x] Cache group
- [x] Logs group
- [x] Sessions group
- [x] “Removal consequence” copy
- [x] Safety state
- [x] Selection
- [x] Model files never auto-selected
- [x] Empty state
- [x] Mobile layout

---

# Phase 14 — App Leftovers UI

- [x] Header metrics
- [x] Former-app grouping
- [x] Candidate paths
- [x] High-confidence state
- [x] Likely state
- [x] Review state
- [x] Selection
- [x] No ambiguous auto-select
- [x] Empty state
- [x] Mobile layout

---

# Phase 15 — System Dashboard UI

- [x] Page header
- [x] Memory card
- [x] Processor card
- [x] Storage volumes
- [x] System card
- [x] External/removable indicator
- [x] Empty/error handling
- [x] Tablet layout
- [x] Mobile single-column layout

---

# Phase 16 — Settings UI

- [x] General section
- [x] Appearance
- [x] Scan preferences
- [x] Large-file threshold
- [x] Exclusions
- [x] Add exclusion picker
- [x] Remove exclusion
- [x] Safety guarantees
- [ ] Permission status
- [x] Update section
- [x] Privacy section
- [ ] License section deferred/placeholder
- [x] Mobile layout

---

# Phase 17 — Global Search UI

- [x] Search trigger in top bar
- [x] Cmd+K
- [x] Ctrl+K
- [x] Search overlay
- [x] Keyboard result navigation
- [x] Result row
- [x] Path
- [x] Size
- [x] Type
- [x] Empty query state
- [x] No result state
- [x] Loading state
- [x] Mobile full-screen search

---

# Phase 18 — Onboarding / Permissions UI

- [x] Intro
- [x] Safety explanation
- [x] Platform-aware permission step
- [x] macOS Full Disk Access UI
- [x] Linux permission explanation
- [x] First scan choice
- [x] Skip/resume behavior
- [x] Persist onboarding completion

---

# Backend Phase 1 — System Info

- [x] Define Rust models
- [x] Implement system info command
- [x] Memory
- [x] CPU
- [x] OS
- [x] Hostname
- [x] Uptime
- [x] Volumes/mounts
- [ ] macOS verified
- [ ] Linux verified
- [x] TypeScript query wrapper
- [x] Wire System page
- [x] Error handling
- [x] Tests where reasonable

---

# Backend Phase 2 — Scan Engine

- [x] Define scan models
- [x] Define managed scan state
- [x] Scan path validation
- [x] Home target
- [x] Drive/root target
- [x] Custom folder target
- [x] Parallel filesystem walk
- [x] Permission errors handled
- [x] Symlink behavior defined
- [x] Hard links considered
- [x] Mounted filesystem behavior defined
- [x] Size aggregation
- [x] File/folder counts
- [x] Category classification
- [x] Bounded treemap summary
- [x] Full index kept in Rust
- [x] Progress events throttled
- [x] Cancellation
- [x] Atomic completed-state replacement
- [x] Previous scan preserved on new-scan failure
- [x] Completed scan persisted atomically to SQLite
- [x] Saved scan restored after app restart
- [x] Versioned database schema and persistence test
- [x] Normalized scan-node schema replaces directory JSON blobs
- [x] Only scan summary retained in RAM after completion
- [x] Explorer, treemap, Search, Large Files query SQLite lazily
- [x] WAL checkpointed and obsolete schema vacuumed
- [x] Frontend scan hook
- [x] Frontend scan progress
- [ ] macOS tested
- [ ] Linux tested

---

# Backend Phase 3 — Disk Explorer

- [x] Query current directory by ID/path
- [x] Sort largest first
- [x] Pagination/bounded output
- [x] Directory drill-down
- [x] Metadata
- [x] TypeScript query wrapper
- [x] Wire Explorer
- [ ] Large directory tested

---

# Backend Phase 4 — Space Map

- [x] Treemap summary query
- [x] Drill-down query
- [x] Category data
- [x] Selected node details
- [x] Wire real treemap
- [x] Ensure no full index crosses IPC
- [-] Large scan tested

---

# Backend Phase 5 — Search

- [x] Search cached scan index
- [x] Result limit
- [x] Case behavior
- [x] Path/name matching
- [x] Cancellation/debounce behavior
- [x] Wire search overlay
- [x] Performance tested

---

# Backend Phase 6 — Large Files

- [x] Minimum-size query
- [x] Filters
- [x] Sort
- [x] Pagination
- [x] Safety classification
- [x] Wire page
- [x] Large dataset tested

---

# Backend Phase 7 — Developer Cleanup

- [x] Detector model
- [x] Node modules
- [x] Python virtualenv
- [x] Python cache
- [x] Rust target
- [x] Build output
- [x] Package caches
- [x] Project-context inference
- [x] Safety classification
- [x] Wire page
- [ ] macOS tested
- [ ] Linux tested

---

# Backend Phase 8 — AI Storage

- [x] Manifest model
- [x] Bundled manifest
- [x] macOS paths
- [x] Linux paths
- [x] Tool grouping
- [x] Model/cache/log/session classification
- [x] Removal consequence
- [x] Safety classification
- [x] Wire page
- [x] False-positive review

---

# Backend Phase 9 — Duplicates

- [x] Candidate grouping by exact size
- [x] Partial hash
- [x] Full hash
- [x] Parallel hashing
- [x] I/O pressure controlled
- [x] Cancellation
- [x] Progress
- [x] Wasted-space calculation
- [x] Group output
- [x] Smart selection logic
- [x] Guarantee at least one copy kept
- [x] Wire page
- [x] Duplicate test fixtures

---

# Backend Phase 10 — App Leftovers

- [x] Installed-app inventory macOS
- [x] Installed-app inventory Linux
- [x] Candidate path rules
- [x] Confidence model
- [x] High-confidence detection
- [x] Ambiguous results marked Review
- [x] Wire page
- [x] False-positive testing

---

# Backend Phase 11 — Cleanup Safety Layer

**Do not move user files before all items in this section are complete.**

- [x] Canonical path validation
- [x] Current-scan scope validation
- [x] Protected path deny list
- [x] macOS protected paths
- [x] Linux protected paths
- [x] Windows protected paths
- [x] Symlink safety
- [x] Changed/missing item handling
- [x] Cleanup preview command
- [x] Trash operation
- [x] Batch cleanup
- [x] Partial failure result
- [x] Permanent deletion restricted to explicitly confirmed regular files
- [x] Protected-path tests
- [x] Scope traversal tests
- [ ] Temporary-directory integration tests
- [x] Wire Cleanup Review
- [x] Wire post-clean result
- [ ] Verify real cleanup only on disposable test data

---

# Backend Phase 12 — Settings & Exclusions

- [x] Persistence mechanism
- [x] Theme
- [x] Scan preference
- [x] Large-file threshold
- [x] Exclusion add
- [x] Exclusion remove
- [x] Exclusions applied to scan
- [x] Exclusions applied to cleanup
- [x] Onboarding state
- [ ] macOS permission status
- [ ] Linux permission/skipped path support
- [x] Wire Settings

---

# Backend Phase 13 — Updates

- [x] Updater plugin
- [x] Check command
- [x] Update available state
- [x] Download/install flow
- [x] Error handling
- [x] UI integration
- [x] Release manifest process documented

---

# Backend Phase 14 — Licensing (Deferred)

- [ ] Product decision made
- [ ] Free vs paid capabilities decided
- [ ] Payment provider decided
- [ ] License activation
- [ ] Secure local storage
- [ ] Restore purchase
- [ ] Device activation logic
- [ ] Offline grace behavior
- [ ] Upgrade UI
- [ ] No secrets embedded in app

---

# Quality Pass — Responsive

For every page:

- [ ] Wide desktop
- [ ] 1280px-ish
- [ ] 1024px-ish
- [ ] 768px-ish
- [ ] narrow/mobile
- [ ] no horizontal overflow
- [ ] long paths
- [ ] very large numbers
- [ ] empty data
- [ ] loading
- [ ] error

---

# Quality Pass — Accessibility

- [ ] Keyboard navigation
- [ ] Focus visible
- [ ] Screen-reader labels on icon buttons
- [ ] No color-only safety state
- [ ] Dialog focus trapping
- [ ] Esc behavior
- [ ] Search shortcut
- [ ] Touch targets
- [ ] Treemap alternative via Explorer

---

# Quality Pass — Performance

- [ ] UI responsive during scan
- [ ] UI responsive during duplicate hashing
- [ ] IPC payload sizes inspected
- [ ] No full scan tree sent to JS
- [ ] Lists virtualized when needed
- [ ] Progress events throttled
- [ ] Expensive analyzers lazy
- [ ] No re-scan when switching pages
- [ ] Memory behavior checked after large scan

---

# Quality Pass — Safety

- [ ] No raw delete in normal cleanup
- [ ] Protected paths enforced in Rust
- [ ] Scope validation in Rust
- [ ] Exclusions enforced in Rust
- [ ] No symlink escape
- [ ] No root-required normal operation
- [ ] Review before cleanup
- [ ] Risky user files never auto-selected
- [ ] AI models never auto-selected merely for size
- [ ] App leftovers confidence visible
- [ ] Cleanup failures clearly reported

---

# First Release Candidate

- [ ] macOS scan
- [ ] Linux scan
- [ ] Space Map
- [ ] Explorer
- [ ] Search
- [ ] Large Files
- [ ] Developer Cleanup
- [ ] Basic AI Storage
- [ ] Cleanup Hub
- [ ] Safe Trash cleanup
- [ ] Exclusions
- [ ] System Dashboard
- [ ] Permission handling
- [ ] Responsive UI
- [ ] No critical bugs
- [ ] Release packaging tested
