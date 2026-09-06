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

- Current phase: **Backend Phase 2 — Resource-efficient persistence**
- Current task: **Review normalized SQLite scan on Linux**
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
- [ ] Verify project still runs

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
- [ ] Add managed `app_state` when first needed
- [x] Add `features` module when first backend feature begins
- [ ] Add `platform` module when platform behavior is introduced
- [ ] Add `safety` module before destructive operations
- [ ] Add `common` helpers only for proven shared logic
- [x] Verify `cargo fmt`
- [x] Verify `cargo clippy`

---

# Phase 3 — Theme Foundation

- [ ] Tailwind configured
- [ ] shadcn configured
- [ ] Dark theme tokens
- [ ] Light/system theme plumbing
- [ ] Background tokens
- [ ] Surface tokens
- [ ] Border tokens
- [ ] Text tokens
- [ ] Primary accent tokens
- [ ] Success/warning/danger tokens
- [ ] Typography scale
- [ ] Radius scale
- [ ] Spacing conventions
- [ ] Focus-visible styles
- [ ] Disabled styles
- [x] Selection styles
- [ ] Scrollbar treatment if needed
- [ ] Responsive breakpoint conventions
- [ ] No Reclaim-red visual clone
- [ ] Remove starter Vite styles/assets

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
- [ ] Loading/badge support
- [x] Top command bar
- [x] Search trigger
- [x] Rescan action
- [x] Main content container

## Responsive

- [ ] Compact desktop sidebar behavior
- [x] Tablet drawer/rail behavior
- [x] Mobile top app bar
- [ ] Mobile bottom navigation
- [ ] “More” navigation sheet
- [ ] No horizontal overflow
- [ ] Narrow window tested

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
- [ ] `Metric`
- [ ] `StorageProgress`
- [ ] `SafetyBadge`
- [ ] `FileTypeIcon`
- [ ] `PathText`
- [x] `EmptyState`
- [ ] `LoadingState`
- [ ] `ErrorState`
- [ ] `FilterBar`
- [ ] `SelectionSummary`
- [ ] `ConfirmActionDialog`
- [ ] `AppSheet`
- [ ] `AppDialog`
- [ ] Responsive list/table primitive if proven useful
- [ ] No speculative “universal component” abstractions

---

# Phase 7 — Space Map UI

## Structure

- [ ] `features/overview/pages/overview-page.tsx`
- [ ] `features/overview/components/sections`
- [ ] Overview summary section
- [ ] Treemap section
- [ ] Selected-item detail section

## UI states

- [x] No scan
- [x] Scanning
- [x] Scan complete
- [ ] Scan failed
- [x] Scan cancelled
- [ ] Permission-limited scan

## Treemap

- [ ] Mock treemap
- [x] Category color mapping
- [x] Labels
- [x] Hover
- [ ] Selection
- [x] Drill-down
- [x] Breadcrumb
- [x] Back navigation
- [ ] Context menu
- [x] Item detail
- [x] Mobile bottom-sheet detail
- [ ] Tablet layout
- [ ] Mobile layout

---

# Phase 8 — Disk Explorer UI

- [ ] Explorer page sections
- [ ] Root/volume header
- [ ] Breadcrumb
- [ ] Back action
- [ ] Item count
- [ ] Sort
- [ ] Filter layout
- [ ] Desktop table
- [ ] Directory row
- [ ] File row
- [ ] Row selection
- [ ] Row actions
- [ ] Empty state
- [ ] Loading state
- [ ] Error state
- [ ] Mobile list-card fallback
- [ ] Long path handling
- [ ] Narrow-window behavior

---

# Phase 9 — Cleanup Hub UI

- [ ] Header metrics
- [ ] Safe category list
- [ ] Category accordions
- [ ] Item counts
- [ ] Selected size
- [ ] Safety labels
- [ ] Select all safe behavior
- [ ] Review action
- [ ] Cleanup review UI
- [ ] Risk grouping
- [ ] Final confirmation UI
- [ ] Cleanup result UI
- [ ] Mobile layout
- [ ] Empty state

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

- [ ] Header metrics
- [ ] Duplicate group count
- [ ] Wasted-space metric
- [ ] Smart select action
- [ ] Group component
- [ ] Keep recommendation
- [ ] Copy rows
- [ ] Manual selection
- [ ] Never-select-all-copies safeguard in UI
- [ ] Path display
- [ ] Modified date
- [ ] Empty state
- [ ] Loading/progress state
- [ ] Mobile group cards

---

# Phase 12 — Developer Cleanup UI

- [ ] Header metrics
- [ ] Category accordions
- [ ] Node modules
- [ ] Python virtual envs
- [ ] Python cache
- [ ] Rust targets
- [ ] Build outputs
- [ ] Package cache placeholder
- [ ] Project/tool context
- [ ] Regeneration explanation
- [ ] Selection
- [ ] Review flow
- [ ] Mobile layout

---

# Phase 13 — AI Storage UI

- [ ] Header metrics
- [ ] Tool groups
- [ ] Models group
- [ ] Cache group
- [ ] Logs group
- [ ] Sessions group
- [ ] “Removal consequence” copy
- [ ] Safety state
- [ ] Selection
- [ ] Model files never auto-selected
- [ ] Empty state
- [ ] Mobile layout

---

# Phase 14 — App Leftovers UI

- [ ] Header metrics
- [ ] Former-app grouping
- [ ] Candidate paths
- [ ] High-confidence state
- [ ] Likely state
- [ ] Review state
- [ ] Selection
- [ ] No ambiguous auto-select
- [ ] Empty state
- [ ] Mobile layout

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

- [ ] General section
- [ ] Appearance
- [ ] Scan preferences
- [ ] Large-file threshold
- [ ] Exclusions
- [ ] Add exclusion picker
- [ ] Remove exclusion
- [ ] Safety guarantees
- [ ] Permission status
- [ ] Update section
- [ ] Privacy section
- [ ] License section deferred/placeholder
- [ ] Mobile layout

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

- [ ] Intro
- [ ] Safety explanation
- [ ] Platform-aware permission step
- [ ] macOS Full Disk Access UI
- [ ] Linux permission explanation
- [ ] First scan choice
- [ ] Skip/resume behavior
- [ ] Persist onboarding completion

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

- [ ] Detector model
- [ ] Node modules
- [ ] Python virtualenv
- [ ] Python cache
- [ ] Rust target
- [ ] Build output
- [ ] Package caches
- [ ] Project-context inference
- [ ] Safety classification
- [ ] Wire page
- [ ] macOS tested
- [ ] Linux tested

---

# Backend Phase 8 — AI Storage

- [ ] Manifest model
- [ ] Bundled manifest
- [ ] macOS paths
- [ ] Linux paths
- [ ] Tool grouping
- [ ] Model/cache/log/session classification
- [ ] Removal consequence
- [ ] Safety classification
- [ ] Wire page
- [ ] False-positive review

---

# Backend Phase 9 — Duplicates

- [ ] Candidate grouping by exact size
- [ ] Partial hash
- [ ] Full hash
- [ ] Parallel hashing
- [ ] I/O pressure controlled
- [ ] Cancellation
- [ ] Progress
- [ ] Wasted-space calculation
- [ ] Group output
- [ ] Smart selection logic
- [ ] Guarantee at least one copy kept
- [ ] Wire page
- [ ] Duplicate test fixtures

---

# Backend Phase 10 — App Leftovers

- [ ] Installed-app inventory macOS
- [ ] Installed-app inventory Linux
- [ ] Candidate path rules
- [ ] Confidence model
- [ ] High-confidence detection
- [ ] Ambiguous results marked Review
- [ ] Wire page
- [ ] False-positive testing

---

# Backend Phase 11 — Cleanup Safety Layer

**Do not move user files before all items in this section are complete.**

- [ ] Canonical path validation
- [ ] Current-scan scope validation
- [ ] Protected path deny list
- [ ] macOS protected paths
- [ ] Linux protected paths
- [ ] Symlink safety
- [ ] Changed/missing item handling
- [ ] Cleanup preview command
- [ ] Trash operation
- [ ] Batch cleanup
- [ ] Partial failure result
- [ ] No permanent delete in normal flow
- [ ] Protected-path tests
- [ ] Scope traversal tests
- [ ] Temporary-directory integration tests
- [ ] Wire Cleanup Review
- [ ] Wire post-clean result
- [ ] Verify real cleanup only on disposable test data

---

# Backend Phase 12 — Settings & Exclusions

- [ ] Persistence mechanism
- [ ] Theme
- [ ] Scan preference
- [ ] Large-file threshold
- [ ] Exclusion add
- [ ] Exclusion remove
- [ ] Exclusions applied to scan
- [ ] Exclusions applied to cleanup
- [ ] Onboarding state
- [ ] macOS permission status
- [ ] Linux permission/skipped path support
- [ ] Wire Settings

---

# Backend Phase 13 — Updates

- [ ] Updater plugin
- [ ] Check command
- [ ] Update available state
- [ ] Download/install flow
- [ ] Error handling
- [ ] UI integration
- [ ] Release manifest process documented

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
