# DiskVacuum — Steps Summary & Completion Checks

> This is the short execution guide.
>
> `plan.md` contains the full specification.  
> `toto-progress.md` contains the detailed checklist.
>
> Codex should complete one step, run its checks, update progress, then continue.

---

# Step 0 — Preserve the Working Baseline

## Do

- Confirm the existing Tauri + React starter runs.
- Confirm Linux continues to run.
- Confirm macOS runs.
- Add/verify format and lint commands.
- Do not start feature work before baseline is clean.

## Check

- `bun run build` succeeds.
- frontend formatter succeeds.
- TypeScript/lint succeeds.
- `cargo fmt --check` succeeds.
- `cargo clippy` has no unaddressed project warnings/errors.
- `bun tauri dev` launches on macOS and Linux.

## Do not continue if

- basic build is broken;
- Tauri only runs on one target and the reason is unknown.

---

# Step 1 — Create the Modular Structure

## Do

Frontend:

```text
app/
routes/
components/core/
components/layout/
features/
lib/
styles/
```

Feature folders:

```text
scan
overview
explorer
cleanup
large-files
duplicates
developer-cleanup
ai-storage
app-leftovers
system
settings
search
```

Use TanStack Router.

Route files stay thin.

Feature page components live inside the matching feature.

Feature page components compose components from:

```text
features/<feature>/components/sections/
```

## Check

- Every main route loads.
- No giant `App.tsx`.
- No feature business logic in the global layout.
- No empty speculative abstraction folders beyond the agreed structure.
- App still runs.

---

# Step 2 — Create Theme & Design Tokens

## Do

- Remove Vite starter appearance.
- Set DiskVacuum dark graphite visual direction.
- Create semantic color tokens.
- Define typography, radius, spacing, borders.
- Configure shadcn.
- Make focus/disabled/hover states consistent.
- Keep destructive red reserved for destructive actions.
- Use a cool DiskVacuum accent so the app does not visually clone Reclaim.

## Check

- One button style does not randomly differ from another.
- One card style does not randomly differ from another.
- Contrast is readable.
- The UI does not look like a generic gradient SaaS dashboard.
- Narrow viewport has no obvious theme/layout breakage.

---

# Step 3 — Build the Responsive App Shell

## Do

Desktop:

- sidebar;
- scan controls;
- storage summary;
- grouped navigation;
- top command bar;
- search trigger;
- rescan action.

Tablet:

- compact sidebar/rail or drawer.

Mobile:

- top bar;
- bottom navigation;
- More sheet;
- scan sheet.

## Check

Test at:

- wide desktop;
- 1280-ish;
- 1024-ish;
- 768-ish;
- narrow/mobile.

There must be:

- no horizontal scroll;
- no clipped navigation;
- no unreachable route;
- no hover-only required action.

---

# Step 4 — Add Every Route and Page Skeleton

## Do

Create:

- Overview
- Explorer
- Cleanup Hub
- Large Files
- Duplicates
- Developer Cleanup
- AI Storage
- App Leftovers
- System
- Settings

Each route imports its feature page.

Each feature page composes named section components.

Use realistic fixture data.

## Check

- Every route is reachable.
- Active nav is correct.
- Back/forward routing works.
- Page skeletons are responsive.
- Route files contain minimal composition only.

---

# Step 5 — Build Shared Core Components From Actual Needs

## Do

As page skeletons reveal repeated patterns, build:

- page header;
- section surface;
- metric;
- storage progress;
- safety badge;
- path display;
- file icon;
- empty/loading/error state;
- filter bar;
- selection summary;
- dialog/sheet wrappers if useful.

## Check

- Shared components have at least two real consumers, unless they are foundational wrappers.
- No giant prop-heavy universal table.
- Feature-specific components remain in features.

---

# Step 6 — Finish Space Map UI

## Do

Build all visual states:

- no scan;
- scanning;
- complete;
- failure;
- permission-limited.

Implement fixture treemap:

- category colors;
- selection;
- hover;
- drill-down;
- breadcrumb;
- details;
- responsive mobile details.

## Check

- Treemap owns most of the available workspace.
- Labels do not overflow.
- Mobile can inspect a node without hover.
- User can understand current path.
- UI is visually distinct from Reclaim.

---

# Step 7 — Finish Explorer UI

## Do

Desktop storage-first table.

Include:

- breadcrumb;
- back;
- sort;
- size;
- type;
- modified;
- actions.

Mobile list fallback.

## Check

- Long filenames/paths do not break layout.
- Huge directory lists have a virtualization/pagination plan.
- Directory drill-down interaction is obvious.
- Empty/loading/error states exist.

---

# Step 8 — Finish Cleanup Hub + Safety Review UI

## Do

Create:

- recoverable categories;
- selection;
- safety levels;
- selected size;
- review screen;
- confirmation;
- post-clean result.

No real file mutation yet.

## Check

- Nothing implies a personal large file is automatically junk.
- Destructive action says what will happen.
- Default final action is conceptually “Move to Trash”.
- Risky items are visually separated.

---

# Step 9 — Finish Large Files UI

## Do

- table/list;
- threshold;
- filters;
- sort;
- selection;
- safety/review state;
- responsive list.

## Check

- “Large” does not equal “safe to delete”.
- Total vs selected size are not confused.
- Media/documents default to review.

---

# Step 10 — Finish Duplicate UI

## Do

- duplicate groups;
- keep/copy semantics;
- paths;
- size;
- smart select UI;
- manual override.

## Check

- UI can never select every copy in one group without a warning/guard.
- Do not call something “original” unless known.
- Empty state is polished.

---

# Step 11 — Finish Developer Cleanup UI

## Do

Initial categories:

- node_modules;
- Python virtualenv;
- Python cache;
- Rust target;
- build output;
- package caches.

## Check

- Each category explains what regenerates.
- Individual project paths can be inspected.
- Generic directory names are not blindly labeled safe.

---

# Step 12 — Finish AI Storage UI

## Do

Group by tool and by storage kind:

- model;
- cache;
- log;
- session;
- other.

## Check

- Model removal consequence is explicit.
- Models are not auto-selected.
- Potential conversation/session data is marked Review.
- Tool groups are visually easy to scan.

---

# Step 13 — Finish App Leftovers UI

## Do

- group by inferred app;
- show candidate paths;
- show confidence;
- selection/review.

## Check

- Heuristics are not shown as certainty.
- Ambiguous items are never auto-selected.
- High confidence and Review are visually distinct.

---

# Step 14 — Finish System UI

## Do

Show:

- memory;
- CPU;
- disks/volumes;
- OS;
- hostname;
- uptime;
- app version.

## Check

- APFS/mount duplicates do not create misleading storage data.
- external volumes are recognizable.
- mobile is single-column.

---

# Step 15 — Finish Settings UI

## Do

Sections:

- General
- Scan
- Exclusions
- Safety
- Permissions
- Updates
- Privacy
- License later

## Check

- Path exclusion can use picker.
- Safety guarantees are clear.
- macOS permission UI is macOS-only.
- Linux does not show macOS-only text.
- Page remains manageable on mobile.

---

# Step 16 — Finish Global Search + Onboarding

## Search

- Cmd/Ctrl+K;
- command palette desktop;
- full-screen mobile;
- keyboard navigation;
- result metadata.

## Onboarding

- product purpose;
- safety;
- platform permissions;
- first scan.

## Check

- Search does not require mouse.
- Onboarding is short.
- User can recover if permission is denied.
- Product can still scan user-selected accessible folders.

---

# Step 17 — First Real Rust Feature: System Info

## Why first

Small enough to establish good Tauri patterns before the scan engine.

## Do

Create a modular system feature.

Return typed data.

Wire TanStack Query.

## Check

- macOS correct;
- Linux correct;
- frontend has no platform shell commands;
- errors are mapped cleanly.

---

# Step 18 — Implement the Scan Engine

## Do

Rust owns full scan index.

Frontend receives:

- scan summary;
- progress;
- bounded treemap data;
- query slices.

Implement:

- scan Home;
- scan Drive;
- scan Folder;
- cancellation;
- permission errors;
- classification;
- size aggregation;
- index;
- progress events.

## Critical check

**The full filesystem tree must not be serialized and sent to React.**

## Additional checks

- UI remains responsive.
- One unreadable folder does not fail whole scan.
- previous good scan survives failed replacement scan.
- no panic on missing/changing file.
- symlink policy is explicit.

---

# Step 19 — Wire Explorer & Treemap to Real Scan Data

## Explorer

Query directory children from Rust index.

## Treemap

Query bounded summary/drill-down from Rust index.

## Check

- switching pages does not rescan;
- Explorer and treemap agree on sizes;
- huge directories do not create huge IPC responses;
- drill-down is fast.

---

# Step 20 — Implement Real Global Search

## Do

Search the Rust index.

Return bounded results.

## Check

- no full index copied to JS;
- results feel instant after completed scan;
- long paths handled;
- no UI lock on repeated queries.

---

# Step 21 — Implement Large Files

## Do

Query cached index.

Filters:

- minimum size;
- type;
- age;
- category;
- sort.

## Check

- no disk rewalk;
- pagination/bounded results;
- safety classification is conservative.

---

# Step 22 — Implement Developer Cleanup

## Do

Add concrete detectors one by one.

Do not create a plugin framework yet.

## Check

For each detector:

- tested with temporary fixture project;
- false positives reviewed;
- result explains regeneration consequence;
- macOS + Linux paths checked.

---

# Step 23 — Implement AI Storage

## Do

Use a bundled detection manifest.

Add known macOS/Linux paths.

## Check

- model/cache/session distinction;
- no broad wildcard that captures unrelated user data;
- ambiguous data marked Review.

---

# Step 24 — Implement Duplicate Detection

## Do

1. group by size;
2. partial hash;
3. full hash;
4. output exact groups.

Run lazily.

Support progress/cancel.

## Check

- no hashing during basic disk scan;
- identical filenames with different contents are not duplicates;
- different filenames with same content can be duplicates;
- at least one file per group is retained by smart selection.

---

# Step 25 — Implement App Leftovers

## Do

Add installed-app inventory and heuristic candidates.

Return confidence.

## Check

- ambiguous candidates clearly marked;
- no automatic cleanup yet;
- false-positive testing on currently installed apps.

---

# Step 26 — Build the Safety Layer Before Deletion

## Do

Rust validation for every cleanup item:

- canonical path;
- scan scope;
- protected paths;
- symlink safety;
- existence/state;
- exclusions.

Add Trash operation.

Add cleanup preview.

## Hard stop

Do **not** expose real cleanup in the UI until these checks and tests pass.

## Check

- system roots blocked;
- scan root itself blocked where appropriate;
- path escape blocked;
- symlink escape blocked;
- temporary test tree moves to Trash correctly;
- partial failures return structured results.

---

# Step 27 — Enable Real Cleanup

## Do

Wire:

- Cleanup Hub;
- Large Files user selection;
- Duplicates;
- Developer Cleanup;
- AI Storage;
- App Leftovers only where confidence allows.

Every action routes through Cleanup Review.

## Check

- exact selection shown;
- exact size shown;
- risky items separated;
- final action defaults to Trash;
- result page reports success/failure;
- rescan updates free space.

---

# Step 28 — Persist Settings & Exclusions

## Do

Persist:

- theme;
- exclusions;
- threshold;
- onboarding;
- scan preference.

## Check

- app restart preserves settings;
- exclusions affect scan;
- exclusions also block cleanup;
- no database added unless actually needed.

---

# Step 29 — Updates

## Do

Add Tauri updater.

## Check

- app can check for updates;
- failures are non-blocking;
- update UI does not interrupt scans;
- release process documented.

---

# Step 30 — Licensing Only After Product Is Useful

Do not let payments block the core app.

When business model is decided:

- capability flags;
- license activation;
- secure storage;
- restore/deactivate;
- offline grace;
- upgrade UI.

## Check

- scanning remains usable according to product policy;
- no merchant secrets in desktop binary;
- license failure never destroys local data.

---

# Step 31 — Full Responsive Pass

Test each route at:

- wide desktop;
- standard desktop;
- compact desktop;
- tablet;
- narrow/mobile.

## Check every screen for

- overflow;
- truncated controls;
- long paths;
- keyboard;
- touch;
- sheets/dialogs;
- tables -> mobile lists;
- treemap touch interaction.

---

# Step 32 — Cross-Platform Safety QA

## macOS

- Full Disk Access granted;
- Full Disk Access denied;
- Home scan;
- drive scan;
- external drive;
- Trash;
- protected paths.

## Linux

- home scan;
- custom folder;
- mounted volume;
- permission denied;
- Trash;
- protected paths;
- Wayland;
- X11 where possible.

## Check

No release if cleanup safety differs unexpectedly between supported platforms.

---

# Step 33 — Performance QA

Use large real-world test trees without deleting them.

## Check

- scan does not freeze UI;
- scan events are throttled;
- memory use is reasonable;
- no million-node IPC;
- Explorer is fast;
- Search is fast;
- duplicate scan can cancel;
- changing routes does not rescan;
- large list rendering is bounded/virtualized.

---

# Step 34 — Final Polish

Only now:

- subtle transitions;
- micro-interactions;
- icon alignment;
- copy consistency;
- empty states;
- keyboard shortcuts;
- onboarding copy;
- update banner;
- installer/release polish.

Do not use polish as an excuse to add unnecessary decoration.

---

# Final Release Gate

A first public macOS/Linux release must have:

- [ ] professional distinct DiskVacuum visual identity
- [ ] stable scan
- [ ] Space Map
- [ ] Explorer
- [ ] Search
- [ ] Large Files
- [ ] Developer Cleanup
- [ ] basic AI Storage
- [ ] Cleanup Hub
- [ ] exclusions
- [ ] System Dashboard
- [ ] safe Trash cleanup
- [ ] server-side protected paths
- [ ] macOS permission handling
- [ ] Linux permission handling
- [ ] responsive layouts
- [ ] no major UI freezes
- [ ] no dangerous cleanup bug
- [ ] build/lint/format/test checks passing
- [ ] macOS packaging tested
- [ ] Linux packaging tested

If any safety-critical check is unresolved, release scanning/analysis without cleanup rather than shipping unsafe deletion.
