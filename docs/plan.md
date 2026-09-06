DiskVacuum — Implementation Plan

Product: DiskVacuum

Goal: build a polished, fast, safe, cross-platform disk analyzer and storage cleaner inspired by the strengths of Reclaim, but with its own product identity, information architecture, visual language, component system, and implementation.

Initial platform focus: macOS + Linux
Next: Windows
Later: Android

This document is the source of truth for implementation direction. Do not try to complete everything in one pass. Build in ordered, reviewable steps.
⸻

1. Product Direction

DiskVacuum should answer one question extremely well:

What is eating my storage, and what can I safely remove?

The application should combine:

- visual disk usage analysis;
- a storage-oriented file explorer;
- large-file discovery;
- duplicate detection;
- developer-artifact cleanup;
- AI model/cache/log cleanup;
- app-leftover detection;
- safe cleanup review;
- system/storage information;
- global search;
- exclusions and safety rules;
- platform-specific cleanup intelligence.

The product should feel like a real desktop utility, not a web dashboard placed inside a desktop window.

The core product loop is:

1. Select a drive, home directory, or custom folder.
2. Scan it quickly.
3. See storage usage visually.
4. Explore the biggest consumers.
5. Discover reclaimable categories.
6. Review exactly what is selected.
7. Move selected items to Trash safely.
8. See how much space was reclaimed.
   ⸻
9. Reference Product: What We Are Taking Inspiration From

Reclaim is a useful reference because it combines several storage tools in one coherent app:

- Space Overview / treemap
- Disk Explorer
- Duplicate Finder
- Large Files
- AI Cache & Logs
- App Leftovers
- Dev Cleanup
- Global Search
- System Info
- Quick Clean / safety review
- permission handling
- exclusions
- update handling
- cleanup safety

DiskVacuum should reach functional parity with the useful parts of that experience and improve it in areas where cross-platform behavior, clarity, responsiveness, safety, and developer cleanup can be stronger.

Important design rule

Do not clone Reclaim pixel-for-pixel.

Do not copy:

- source code;
- assets;
- exact spacing;
- exact color system;
- exact sidebar proportions;
- exact card dimensions;
- exact copywriting;
- exact paywall placement;
- exact page composition.

Instead, copy the product lessons:

- information is visually scannable;
- the most important storage number is always obvious;
- sidebar navigation keeps the app predictable;
- destructive actions are clearly separated from discovery;
- each cleanup category has its own focused view;
- large lists are compact and useful;
- the app looks like a serious native utility.

DiskVacuum must have a recognizable identity of its own.
⸻ 3. DiskVacuum Visual Identity

3.1 Overall feel

The UI should feel:

- native-adjacent;
- calm;
- technical but not intimidating;
- dense enough for power users;
- simple enough for normal users;
- deliberate;
- restrained;
- high quality;
- fast.

Avoid a “generated SaaS dashboard” appearance.

3.2 Avoid common AI-generated UI patterns

Do not default to:

- giant gradient hero cards inside the app;
- glowing blobs in backgrounds;
- gradients on every button;
- excessive rounded-3xl;
- glassmorphism on every surface;
- five different card styles on one page;
- excessive badges;
- random colored icons;
- oversized marketing text;
- empty whitespace used only to look “premium”;
- decorative charts with no utility;
- generic “Welcome back” dashboards;
- emoji;
- unnecessary animations;
- repeated explanatory copy.

The UI should be functional first.

3.3 Color direction

Use a neutral dark graphite interface by default.

DiskVacuum should not use Reclaim’s red-heavy brand treatment.

Recommended brand direction:

- primary accent: cool cyan / blue-cyan / restrained electric blue;
- neutral backgrounds: graphite / charcoal / near-black;
- green: confirmed safe / success;
- amber: caution / review;
- red: destructive / blocked / dangerous only;
- muted text: cool neutral gray.

The exact palette must be defined as design tokens and remain consistent.

Light theme can come after the dark theme is polished, but the theme system should support both from the beginning.

3.4 Typography

Use one professional UI sans-serif stack.

Principles:

- normal body: 13–15 px on desktop;
- compact table metadata: 12–13 px;
- section/page titles: 22–28 px;
- major metric: 26–36 px depending on viewport;
- weights: regular, medium, semibold, bold only where necessary;
- monospaced text only for paths, hashes, technical values, and code-like data.

Avoid oversized headings.

3.5 Surfaces

Use a small, consistent surface system:

1. app background;
2. sidebar/topbar surface;
3. raised content surface;
4. selected/active surface;
5. modal/popover surface.

Cards should usually use:

- subtle 1px border;
- restrained radius;
- little or no shadow in dark mode;
- clear hierarchy from background tone.

3.6 Iconography

Use one icon set consistently, e.g. Lucide.

Do not mix icon families.

Use semantic icons:

- disk / drive;
- folder;
- search;
- copy / duplicates;
- file;
- trash;
- code;
- bot / CPU where appropriate;
- shield;
- settings;
- refresh;
- filter;
- info.
  ⸻

4. Responsive Strategy

The application must work at:

- narrow desktop windows;
- tablet-sized windows;
- mobile layout;
- normal desktop;
- wide desktop.

Even though Android is later, the desktop UI should not assume a 1600px-wide viewport.

4.1 Breakpoint behavior

Wide desktop: ~1280px and above

- fixed left sidebar;
- fixed or sticky top command bar;
- content uses full remaining width;
- two-column layouts where useful;
- data tables remain tables;
- treemap fills main workspace;
- secondary detail panel can appear on the right where useful.

Compact desktop / tablet: ~768px–1279px

- sidebar collapses to narrow rail or drawer;
- main content gains width;
- cards can collapse from 2 columns to 1;
- table columns become selectively hidden;
- filters move into a popover/sheet;
- treemap remains primary content.

Mobile / very narrow window: below ~768px

- no permanent sidebar;
- use a compact top app bar;
- primary navigation becomes bottom navigation or an app-menu sheet;
- page actions become toolbar/menu actions;
- tables become list rows/cards;
- modal dialogs can become bottom sheets/full-screen sheets;
- search becomes a full-screen search surface;
- treemap labels reduce aggressively;
- selected treemap-node detail appears in a bottom sheet;
- multi-column pages stack vertically;
- touch targets are at least ~44px;
- no hover-only interaction may be required to complete a task.

4.2 Responsive rules that apply everywhere

- Never use fixed content widths that cause clipping.
- Long paths must truncate with tooltip/copy support.
- All data tables must have a narrow-layout fallback.
- Action buttons can collapse into icon buttons or menus.
- Header metrics wrap instead of overflowing.
- Filters should wrap or move into a filter sheet.
- Dialogs must fit small screens.
- All critical actions must remain reachable by keyboard and touch.
  ⸻

5. Application Information Architecture

Use a persistent app shell with navigation grouped by purpose.

Suggested DiskVacuum navigation:

Scan

- Scan Drive
- Scan Home
- Scan Folder

Explore

- Space Map
- Disk Explorer

Cleanup

- Cleanup Hub
- Large Files
- Duplicates
- Developer Cleanup
- AI Storage
- App Leftovers

Tools

- System
- Settings

This differs enough from the Reclaim navigation while keeping the same product capabilities.

The exact final order may be adjusted after UI implementation, but routes should remain stable.
⸻ 6. Routes / Screens

Suggested route map using TanStack Router:

/
├── /overview
├── /explorer
├── /cleanup
├── /large-files
├── /duplicates
├── /developer-cleanup
├── /ai-storage
├── /app-leftovers
├── /system
└── /settings

Global overlays are not routes unless there is a reason to deep-link them:

- global search;
- scan picker;
- scan progress;
- item details;
- cleanup review;
- confirmation;
- permission request;
- update available;
- license/upgrade later.
  ⸻

7. Global App Shell

The shell is shared across all pages.

7.1 Desktop sidebar

The sidebar should include:

Scan controls

- primary Scan Drive action;
- Scan Home;
- Scan Folder;
- current scan target if available;
- disable conflicting scan actions while scanning.

On macOS, “Scan Drive” may mean the main data volume/root scope available to the app.

On Linux it should allow choosing a mounted filesystem/volume.

Storage summary

Compact storage block:

- total storage;
- used storage;
- free storage;
- amount analyzed by current scan;
- estimated reclaimable space;
- small progress indicator.

Do not confuse “scanned bytes” with physical drive capacity.

Navigation

Grouped navigation described above.

Optional per-item badges:

- reclaimable size;
- running/loading indicator;
- warning indicator;
- disabled state if no scan exists.

Bottom area

- Settings;
- app version optionally in a menu;
- update indicator if available.

7.2 Top command bar

Desktop:

- global search trigger;
- keyboard hint: ⌘K macOS, Ctrl+K Linux/Windows;
- scan/rescan status/action;
- optional cleanup selection tray indicator;
- optional upgrade/license action later.

The top bar should visually belong to the native desktop shell, not look like a website navbar.

7.3 Mobile shell

- top bar: page title + scan/search/menu;
- bottom nav: Overview, Explorer, Clean, More;
- “More” opens remaining sections;
- search is full-screen;
- scan controls live in a sheet.
  ⸻

8. Global Application States

Every feature must consider these states.

8.1 No scan yet

Show an intentional empty state:

- explain that DiskVacuum needs a scan;
- show Scan Home, Scan Drive, Choose Folder;
- show concise privacy/safety note;
- no fake numbers.

8.2 Permission missing

Platform-aware message.

macOS:

- Full Disk Access explanation;
- current status;
- button to open the correct System Settings page if possible;
- re-check action;
- user can still scan accessible folders if desired.

Linux:

- explain normal filesystem permission failures;
- never tell the user to run the whole GUI as root;
- show skipped/inaccessible count after scan;
- optionally suggest scanning a folder the user owns.

Windows later:

- explain protected locations and elevation behavior only when needed.

8.3 Scanning

Show:

- target;
- elapsed time;
- running analyzed size;
- files/folders visited;
- current path, truncated;
- progress if determinable;
- indeterminate state if total work is unknown;
- Cancel button.

Do not freeze navigation unnecessarily. Views that depend on completed data can be disabled or show live partial data only if explicitly supported.

8.4 Scan complete

Show:

- duration;
- total indexed files/folders;
- analyzed size;
- skipped/inaccessible paths count;
- reclaimable estimate;
- timestamp.

8.5 Scan error/cancelled

Keep any valid previous scan until the new scan replaces it successfully.

Show useful error information rather than raw Rust errors.
⸻ 9. Screen: Space Map / Overview

This is the flagship screen.

9.1 Purpose

Give the user an immediate visual answer to:

- where is the disk space going?
- what folder dominates usage?
- what categories are large?
- where should I inspect next?

9.2 Page layout

Desktop:

1. compact top summary strip;
2. view controls;
3. treemap workspace;
4. optional item-detail panel or bottom detail bar;
5. optional cleanup tray action.

The treemap should dominate the page, not be a small dashboard widget.

9.3 Summary strip

Display:

- analyzed size;
- reclaimable estimate;
- current target;
- scan timestamp;
- quick action: rescan;
- quick action: open Cleanup Hub.

Do not copy Reclaim’s exact banner layout.

Use DiskVacuum styling with a more neutral metric-driven header.

9.4 Treemap

Requirements:

- nested rectangles sized by disk usage;
- performant with large datasets;
- category colors;
- labels only where rectangles are large enough;
- directory name on parent regions;
- item name on large child regions;
- selected state;
- hover state on pointer devices;
- touch selection on mobile;
- breadcrumb drill-down;
- double click / Enter to drill into folder;
- Backspace or breadcrumb to move upward;
- zoom/drill transition should be fast and subtle.

Categories may include:

- Applications
- Documents
- Downloads
- Images
- Video
- Audio
- Archives
- Developer
- AI
- Caches
- System
- Other

Avoid random colors per file. Colors should be category-based and stable.

9.5 Selected item detail

Show:

- name;
- full path;
- type;
- size;
- child item count if directory;
- modified date;
- category;
- safety classification;
- actions.

Actions:

- Open / Reveal in file manager;
- Copy path;
- Inspect in Explorer;
- Exclude from future scans;
- Add to cleanup selection if allowed;
- Move to Trash only through safe cleanup flow.

On mobile, details appear in a bottom sheet.

9.6 Context menu

Desktop right-click may offer:

- Open;
- Reveal;
- Copy Path;
- Drill Into;
- Exclude;
- Add to Cleanup;
- Properties.

Do not make right-click the only way to reach actions.

9.7 Scanning state

While scanning:

- the treemap area becomes a focused scan-progress surface;
- show live path + bytes analyzed + file count;
- use a clean progress animation, not an oversized spinner only.

9.8 Empty state

Before first scan, use this page as the main call-to-action for starting a scan.
⸻ 10. Screen: Disk Explorer

10.1 Purpose

A size-first filesystem browser.

It is not intended to replace Finder/Nautilus/Explorer. It should help users inspect large storage consumers.

10.2 Desktop layout

Header:

- page title;
- current scan root/volume;
- breadcrumb;
- back action;
- item count;
- sort;
- optional filters.

Table columns:

- Name
- Type
- Size
- Modified
- Safety / status where relevant

Default sort: largest first.

Optional columns should hide on narrower widths.

10.3 Row behavior

Each row shows:

- icon;
- name;
- path context if useful;
- type;
- size;
- modified date;
- optional safety badge;
- context/action menu.

Directory click:

- drills into directory.

File click:

- opens detail panel or selects row.

Actions:

- reveal;
- copy path;
- exclude;
- add to cleanup;
- move to Trash through review.

10.4 Mobile

Replace table with list cards:

- icon;
- name;
- path snippet;
- size;
- type;
- chevron;
- long press / menu for actions.

Breadcrumb becomes horizontally scrollable or a simple back/title pattern.
⸻ 11. Screen: Cleanup Hub

This is DiskVacuum’s safer version of “Quick Clean”.

11.1 Purpose

Aggregate high-confidence reclaimable items from all analyzers.

The Cleanup Hub should never imply that every large file is junk.

11.2 Categories

Possible sections:

- Safe caches
- Temporary files
- Developer artifacts
- Package caches
- AI caches/logs
- Exact duplicate copies
- Old installers
- Trash
- App leftovers with high confidence

Large personal files should not be auto-selected.

11.3 Layout

Header:

- total high-confidence reclaimable;
- selected amount;
- rescan;
- cleanup action.

Category cards/accordion rows:

- category icon;
- category name;
- item count;
- size;
- confidence/safety;
- selectable checkbox;
- expand for details.

11.4 Safety classification

Use explicit statuses:

- Safe to regenerate
- Likely safe
- Review
- Protected

Avoid claiming “Safe” when DiskVacuum cannot actually guarantee safety.

11.5 Cleanup action

Button copy should be clear:

- Review cleanup
- not Delete now.

Review is always required before final action.
⸻ 12. Screen: Large Files

12.1 Purpose

Show files above a configurable threshold, sorted by size.

Default threshold can start at 100 MB, but this should eventually be configurable.

12.2 Header

- page title;
- description;
- total size represented;
- selected size;
- filter/sort;
- optional threshold selector.

Do not label the entire total as “recoverable” unless the user has selected it or it belongs to a safe category.

Better terminology:

- 252 GB in large files
- 4.2 GB selected

12.3 List/table

Columns:

- selection;
- file;
- parent location;
- size;
- modified;
- category;
- safety/review state;
- actions.

Filters:

- size;
- extension/type;
- age;
- folder;
- category.

Actions:

- reveal;
- open;
- copy path;
- exclude;
- select;
- inspect.

12.4 Safety

Files that appear to be:

- videos;
- photos;
- archives;
- project sources;
- databases;
- documents;
- virtual machine disks;
- container data;

must default to Review, not “safe”.
⸻ 13. Screen: Duplicate Finder

13.1 Purpose

Find byte-identical duplicate files and show actual wasted space.

13.2 Detection behavior

Use staged detection:

1. group by exact file size;
2. skip unique sizes;
3. cheap partial content hash;
4. full hash only for remaining candidates;
5. group exact matches.

The UI must only call something a confirmed duplicate after content confirmation.

13.3 Header

Show:

- duplicate group count;
- duplicate file count;
- reclaimable duplicate-copy size;
- scan/recheck action;
- smart select action.

13.4 Group UI

Duplicates should be grouped visually.

Each group:

- group total size;
- file count;
- one recommended item to keep;
- copies listed underneath;
- paths visible;
- modified date;
- file type;
- checkbox per copy.

Do not label a file as “original” unless DiskVacuum knows it is original.

Better:

- Keep
- Copy
- Recommended keep
- Selected for removal

13.5 Smart select strategies

Later:

- keep newest;
- keep oldest;
- keep shortest path;
- prefer known user library;
- prefer non-download location.

Smart select must never select every file in a duplicate group.

13.6 Mobile

Each duplicate group becomes a card with horizontally compact file rows.
⸻ 14. Screen: Developer Cleanup

This should become one of DiskVacuum’s strongest differentiators.

14.1 Purpose

Find regeneratable developer storage scattered across projects and tools.

14.2 Categories

Initial:

- Node node_modules
- Node build output (dist, build, .next, .nuxt, etc.)
- Rust target
- Python .venv, venv
- Python **pycache**
- package manager caches
- temporary test/build output

Later:

- Gradle
- Maven
- Android build caches
- Xcode DerivedData
- CocoaPods
- Swift build output
- Go build/module caches
- PHP Composer caches/vendor where safe
- Docker data with special handling
- Bun cache
- pnpm store
- npm/yarn cache

14.3 Page structure

Header:

- total detected;
- selected;
- rescan analyzer;
- Review cleanup.

Category accordion:

- category;
- item count;
- total size;
- short explanation;
- regeneratability note;
- checkbox.

Expanded rows:

- project/tool name where inferable;
- path;
- size;
- modified;
- last project activity if inferable;
- safety classification.

14.4 Safety

Never assume every directory named build, dist, or target is disposable without context.

Detection rules must use known project patterns and parent markers where possible.

Docker requires special care and should not initially be cleaned by raw filesystem deletion. Use Docker APIs/CLI integration later if implemented.
⸻ 15. Screen: AI Storage

Rename the concept from Reclaim’s “AI Cache & Logs” to AI Storage to broaden the feature and differentiate it.

15.1 Purpose

Show local storage used by AI tools:

- model weights;
- downloaded models;
- caches;
- generated indexes;
- logs;
- sessions;
- temporary artifacts.

15.2 Tool grouping

Possible tools:

- Ollama
- LM Studio
- Cursor
- Claude / Claude Code
- Codex
- ChatGPT desktop
- Windsurf
- Continue
- local Hugging Face caches
- other known AI tools

Detection must be platform-specific and version-tolerant.

15.3 Page layout

Header:

- total AI-related storage detected;
- safe-cache amount;
- model-data amount;
- selected amount.

Tool groups:

- tool icon;
- tool name;
- total size;
- path count;
- category summary.

Expanded content groups:

- Models
- Cache
- Logs
- Sessions
- Other

Each item:

- path;
- size;
- modified;
- data type;
- consequence of removal.

Examples of consequences:

- “Will be downloaded again”
- “Clears local logs”
- “Removes local model; re-download required”
- “May remove local conversation/session data — review”

Models should never be auto-selected simply because they are large.
⸻ 16. Screen: App Leftovers

16.1 Purpose

Find data likely left behind by software that is no longer installed.

16.2 Detection

Cross-platform detection is not trivial.

The app should distinguish:

- high-confidence orphan;
- likely orphan;
- ambiguous application data.

Do not present heuristic results as guaranteed.

16.3 Page layout

Header:

- likely recoverable amount;
- candidate app count;
- selected amount;
- review action.

Group by inferred former application.

Within group:

- Application Support / data path
- caches
- logs
- preferences
- updater files
- helper data
- size
- last modified
- confidence

Confidence badges:

- High confidence
- Likely
- Review

16.4 Platform behavior

macOS:

- ~/Library/Application Support
- ~/Library/Caches
- ~/Library/Preferences
- ~/Library/Containers
- updater/helper locations

Linux:

- ~/.config
- ~/.cache
- ~/.local/share
- app-specific directories
- Flatpak/Snap remnants where detectable

Windows later:

- AppData
- ProgramData
- local/roaming app directories
- installer/update remnants
- uninstall metadata
  ⸻

17. Screen: System Dashboard

17.1 Purpose

Give useful system context without becoming a full system monitor.

17.2 Cards

Memory

- used / total;
- percentage;
- compact progress indicator.

Processor

- CPU model;
- core/thread count;
- current utilization optional.

Storage

List mounted drives/volumes:

- label;
- mount point;
- filesystem;
- used/total;
- free;
- percentage;
- external/removable badge where known.

Avoid duplicate APFS logical volumes that confuse normal users; combine or explain when necessary.

System

- OS;
- version;
- architecture;
- hostname;
- uptime;
- DiskVacuum app version.

17.3 Responsive

Desktop: two-column grid.
Tablet/mobile: one column.
⸻ 18. Screen: Settings & Exclusions

Organize settings into sections rather than one long undifferentiated page.

18.1 General

- appearance: system / dark / light;
- compact mode later;
- launch behavior;
- keyboard shortcut reference.

18.2 Scan

- default scan target;
- follow symlinks: off by default;
- include/exclude hidden files;
- minimum large-file threshold;
- excluded paths.

18.3 Exclusions

Add/remove paths.

Each exclusion shows:

- path;
- scope;
- reason optional;
- remove action.

Path picker should be preferred over manual path typing, with manual entry available for power users.

18.4 Safety

Display read-only safety guarantees:

- cleanup defaults to system Trash;
- critical OS paths are protected in Rust;
- symlink boundaries are respected;
- cleanup is restricted to explicit scan/selection scope.

Optional advanced setting:

- allow permanent deletion — disabled by default and possibly postponed entirely.

18.5 Permissions

macOS:

- Full Disk Access status;
- open settings;
- recheck.

Linux:

- skipped path summary / filesystem permission guidance.

Windows later:

- protected location/elevation status.

18.6 Updates

- current version;
- last checked;
- check for updates;
- auto-update preference if supported.

18.7 Privacy

State clearly:

- filenames and paths stay local unless a future cloud feature explicitly says otherwise;
- disk scan data is processed locally;
- telemetry is off unless deliberately implemented.

18.8 License / Pro — later

Do not build licensing before the storage product works.

When added:

- license status;
- activate;
- deactivate;
- purchase/restore;
- device count information if supported.
  ⸻

19. Global Search

19.1 Entry

- ⌘K on macOS;
- Ctrl+K Linux/Windows;
- top-bar search button.

19.2 Desktop presentation

Command-palette style overlay:

- centered;
- compact;
- dark surface;
- max height;
- keyboard navigation.

19.3 Mobile

Full-screen search page/sheet.

19.4 Search result

Show:

- icon;
- name;
- path;
- size;
- type;
- modified;
- matched reason optional.

Actions:

- Enter: inspect/open;
- secondary action: reveal;
- context menu: copy path, exclude, add to cleanup.

19.5 Performance

Search should query the Rust scan index, not load the complete filesystem into JS.

Debounce lightly or use an explicit minimum character count if necessary.
⸻ 20. Cleanup Review / Safety Net

This is a critical shared flow.

20.1 Review screen

Before cleanup, show:

- total selected size;
- total file/folder count;
- grouped categories;
- risky items count;
- inaccessible/changed items if any;
- destination: Trash.

Sections:

- Safe/regeneratable
- Review
- User-selected files
- Protected / blocked (not removable)

20.2 Confirmation

Default action:

Move to Trash

Never call raw permanent deletion the normal action.

For risky/large cleanup:

- require explicit confirmation;
- highlight user files;
- show exact size;
- show exact number of items;
- allow expanding group contents.

20.3 Post-clean result

Show:

- reclaimed amount;
- items moved;
- failures;
- current free disk space;
- Open Trash if platform supports it;
- rescan action.
  ⸻

21. First-Run Onboarding

Keep it short: 3–4 steps maximum.

Step 1 — What DiskVacuum does

- visual disk analysis;
- safe cleanup;
- local processing.

Step 2 — Safety

- Trash by default;
- protected system paths;
- review before cleanup.

Step 3 — Permission

Platform-specific.

macOS needs Full Disk Access explanation.

Linux should not show macOS-specific permission messaging.

Step 4 — First scan

Choose:

- home;
- drive;
- folder.

Onboarding should be skippable where reasonable and never trap the user.
⸻ 22. Frontend Technical Direction

Current frontend stack:

- React
- TypeScript
- Vite
- Tauri
- TanStack Router
- TanStack Query
- Zustand
- Tailwind CSS
- shadcn/ui where useful
- Lucide icons

Do not introduce another framework.

22.1 State ownership

TanStack Query

Use for Tauri-backed asynchronous data:

- scan summary;
- explorer directory data;
- large files;
- duplicates;
- AI storage;
- developer cleanup;
- app leftovers;
- system info;
- settings read/write when asynchronous.

Zustand

Use only for cross-route client/UI state:

- current selected scan target;
- cleanup basket / selected cleanup IDs if it genuinely spans routes;
- sidebar/mobile nav state;
- active scan UI metadata not owned by query;
- temporary user preferences that need global access.

Do not duplicate TanStack Query data inside Zustand.

Local component state

Use for:

- open accordion;
- local filters;
- hovered node;
- modal visibility if not global;
- row selection if it does not need to survive route changes.
  ⸻

23. Frontend Folder Structure

Follow a feature-first structure.

src/
├── app/
│ ├── router.tsx
│ ├── providers.tsx
│ └── app.tsx
│
├── routes/
│ ├── __root.tsx
│ ├── overview.tsx
│ ├── explorer.tsx
│ ├── cleanup.tsx
│ ├── large-files.tsx
│ ├── duplicates.tsx
│ ├── developer-cleanup.tsx
│ ├── ai-storage.tsx
│ ├── app-leftovers.tsx
│ ├── system.tsx
│ └── settings.tsx
│
├── components/
│ ├── core/
│ │ ├── app-button.tsx
│ │ ├── app-dialog.tsx
│ │ ├── app-sheet.tsx
│ │ ├── app-tooltip.tsx
│ │ ├── page-header.tsx
│ │ ├── section-card.tsx
│ │ ├── metric.tsx
│ │ ├── empty-state.tsx
│ │ ├── loading-state.tsx
│ │ ├── error-state.tsx
│ │ ├── safety-badge.tsx
│ │ ├── file-icon.tsx
│ │ ├── size-text.tsx
│ │ └── virtual-list.tsx
│ │
│ └── layout/
│ ├── app-shell.tsx
│ ├── app-sidebar.tsx
│ ├── app-topbar.tsx
│ ├── mobile-navigation.tsx
│ └── storage-summary.tsx
│
├── features/
│ ├── scan/
│ │ ├── components/
│ │ │ └── sections/
│ │ ├── hooks/
│ │ ├── api/
│ │ ├── store/
│ │ ├── types.ts
│ │ └── utils.ts
│ │
│ ├── overview/
│ │ ├── pages/
│ │ │ └── overview-page.tsx
│ │ ├── components/
│ │ │ ├── sections/
│ │ │ │ ├── overview-summary-section.tsx
│ │ │ │ ├── treemap-section.tsx
│ │ │ │ └── item-detail-section.tsx
│ │ │ └── treemap/
│ │ ├── hooks/
│ │ ├── api/
│ │ ├── types.ts
│ │ └── utils.ts
│ │
│ ├── explorer/
│ ├── cleanup/
│ ├── large-files/
│ ├── duplicates/
│ ├── developer-cleanup/
│ ├── ai-storage/
│ ├── app-leftovers/
│ ├── system/
│ ├── settings/
│ └── search/
│
├── hooks/
│ └── shared hooks only
│
├── lib/
│ ├── tauri.ts
│ ├── query-client.ts
│ ├── platform.ts
│ ├── format.ts
│ └── cn.ts
│
├── stores/
│ └── truly global stores only
│
├── styles/
│ ├── globals.css
│ └── tokens.css
│
└── main.tsx

23.1 Rules for feature folders

Every feature should own its own:

- page assembly;
- feature-specific components;
- components/sections;
- hooks;
- Tauri query functions;
- types;
- small local utilities.

Route files should be thin:

route -> imports FeaturePage -> FeaturePage composes feature sections

Do not put a 700-line page directly into a route file.

23.2 components/core

Only put a component here if it is:

- used by multiple features;
- visually standardized;
- not business-specific.

Do not move a component to core “because it might be reused someday”.

23.3 Section rule

Page-sized features should be composed from sections.

Example:

features/large-files/pages/large-files-page.tsx
-> LargeFilesHeaderSection
-> LargeFilesFilterSection
-> LargeFilesListSection

Sections can use smaller private components in the same feature.

23.4 Avoid abstraction debt

Do not create:

- generic repository interfaces for every command;
- a service class for every hook;
- unnecessary DTO mapping layers;
- custom event buses;
- generic form frameworks;
- one “universal table” before multiple tables actually need the same behavior.

Start concrete. Extract only proven duplication.
⸻ 24. UI Data Contracts

Define stable TypeScript types before real Rust integration.

Examples:

ScanSummary
ScanProgress
ScanNodeSummary
ExplorerEntry
LargeFileEntry
DuplicateGroup
DuplicateEntry
DeveloperArtifactGroup
DeveloperArtifact
AiStorageGroup
AiStorageEntry
AppLeftoverGroup
AppLeftoverEntry
SafetyLevel
CleanupSelection
CleanupPreview
CleanupResult
SystemSummary
VolumeInfo
AppSettings
PermissionStatus

Do not expose Rust internals directly to the UI.

Use IDs for selection when practical rather than sending giant paths everywhere.
⸻ 25. Rust / Tauri Backend Direction

The Rust side should also be modular, but not over-engineered.

Suggested structure:

src-tauri/src/
├── main.rs
├── lib.rs
├── app_state.rs
│
├── features/
│ ├── scan/
│ │ ├── mod.rs
│ │ ├── model.rs
│ │ └── service.rs
│ ├── explorer/
│ ├── large_files/
│ ├── duplicates/
│ ├── developer_cleanup/
│ ├── ai_storage/
│ ├── app_leftovers/
│ ├── cleanup/
│ ├── system/
│ └── settings/
│
├── platform/
│ ├── mod.rs
│ ├── macos.rs
│ ├── linux.rs
│ └── windows.rs
│
├── safety/
│ ├── mod.rs
│ └── protected_paths.rs
│
└── common/
├── mod.rs
├── fs.rs
└── size.rs

This is a direction, not a requirement to create empty files.

Do not create a file until it has a job.

If a feature is small, keep it in mod.rs. Split it only when it becomes meaningfully complex.

25.1 Command responsibility

Tauri command functions should:

- validate input;
- call feature logic;
- map expected errors to frontend-safe errors;
- return serializable output.

They should not contain thousands of lines of scanning logic.

25.2 Platform modules

Use cfg(target_os = "...") where appropriate.

Common logic stays common.

Platform modules should own:

- volumes/mounts;
- Trash integration differences;
- permission checks;
- known cache paths;
- application discovery;
- reveal/open behavior;
- platform safety roots.

Do not spread platform checks throughout unrelated modules.
⸻ 26. Scan Engine Architecture

This is the most important backend architecture decision.

26.1 Do not send the entire filesystem to React

A scan can contain millions of nodes.

The Rust side should own the complete scan index.

The frontend gets:

- summary tree for treemap;
- aggregate metrics;
- page/query-specific slices;
- search results;
- drill-down results.

26.2 Scan state

Keep current completed scan in managed Tauri state.

Conceptually:

ScanState
├── target
├── started_at
├── completed_at
├── summary
├── index
├── path/id lookup
├── aggregate category data
└── scan metadata

A failed new scan should not automatically destroy a previous valid completed scan.

26.3 Scan process

1. validate scope;
2. resolve platform path;
3. walk in parallel;
4. collect metadata;
5. aggregate directory sizes;
6. classify nodes;
7. build indexes;
8. build bounded treemap summary;
9. store completed scan atomically;
10. emit completion event.

26.4 Progress events

Emit throttled progress events:

- path;
- entries visited;
- bytes observed;
- elapsed time.

Do not emit an event for every filesystem entry.

Throttle to avoid IPC/UI overload.

26.5 Filesystem correctness

Handle:

- permission denied;
- symlinks;
- hard links;
- cycles;
- mount boundaries;
- special files;
- disappeared files;
- files changing during scan;
- platform-specific allocated vs logical size.

Never panic because one file cannot be read.
⸻ 27. Scan Performance Rules

- filesystem traversal happens in Rust;
- parallelize carefully;
- avoid loading file contents during basic scan;
- do not hash files during basic scan;
- do not run duplicate detection during every scan;
- do not calculate every smart-clean category eagerly if expensive;
- keep scan construction in Rust and persist the completed index to normalized SQLite rows;
- derive feature lists from the cached index;
- send bounded/paginated results;
- frontend lists must virtualize when large;
- avoid giant JSON payloads.

DiskVacuum keeps filesystem traversal and scan construction in Rust, then queries its normalized SQLite index per view. Only bounded page results and the small scan summary remain in memory after completion.
⸻ 28. Large Files Backend

Query the existing scan index.

Inputs:

- minimum size;
- optional category;
- optional extension;
- optional age;
- sort;
- pagination/cursor.

Do not re-walk disk.

Result should include:

- stable ID;
- path;
- display name;
- size;
- modified;
- extension/type;
- category;
- safety classification.
  ⸻

29. Duplicate Backend

Run only when requested or lazily in background after the main scan is stable.

Pipeline:

1. group cached files by exact size;
2. remove groups with one file;
3. partial hash candidate groups;
4. remove mismatches;
5. full hash confirmed candidates;
6. produce groups;
7. compute wasted space as all-but-one per group.

Hash in parallel but avoid saturating disk I/O unnecessarily.

Support cancellation.
⸻ 30. Developer Cleanup Backend

Use known detectors.

Detector functions can stay simple:

detect_node_modules
detect_rust_targets
detect_python_envs
detect_python_cache
detect_build_outputs
detect_package_caches

Do not invent a plugin framework initially.

Each result should explain:

- what was detected;
- why it is considered regeneratable;
- size;
- project/tool context;
- modified date;
- safety level.
  ⸻

31. AI Storage Backend

Use platform-specific known path manifests.

Initially, a bundled local manifest is enough.

Later, support a remotely updatable signed/validated manifest if needed.

Manifest entry concept:

tool
platform
paths
kind
removal_consequence
default_safety

Do not delete based only on folder names.
⸻ 32. App Leftovers Backend

Treat this as heuristic.

Detection should compare:

- known installed applications;
- known package/bundle identifiers;
- known data directories;
- orphan directories;
- timestamps;
- naming similarity.

Result must return confidence.

Do not automatically select ambiguous leftovers.
⸻ 33. Cleanup Backend

All destructive functionality goes through one safety layer.

33.1 Required validation

For every cleanup request:

1. item exists;
2. item belongs to the current allowed scan scope;
3. path canonicalizes safely;
4. path is not protected;
5. symlink behavior is safe;
6. item has not unexpectedly changed where that matters;
7. action is allowed for current platform;
8. user explicitly selected it.

33.2 Default action

Move to system Trash / Recycle Bin.

No raw rm -rf style behavior for normal cleanup.

33.3 Protected path rules

Hardcoded server-side.

macOS examples:

- critical system roots;
- system library roots;
- applications root;
- home root itself;
- volume roots unless operating on selected child paths.

Linux examples:

- /
- /boot
- /dev
- /proc
- /sys
- /run
- system package/config roots by default;
- mounted filesystem root itself;
- home root itself.

Exact rules must be researched and tested before cleanup ships.

UI protections are not enough.
⸻ 34. Settings Persistence

Keep it simple initially.

Persist:

- theme;
- exclusions;
- default scan preference;
- large file threshold;
- last successful scan target reference if appropriate;
- onboarding completion;
- update preference.

Use a small Tauri store / JSON-backed settings mechanism first.

Do not add SQLite merely because a desktop app “should have a database”.

Add a database only when there is a clear need.

The completed scan index now has that need: users expect millions of scanned items to survive an app restart. Store the last completed scan atomically as normalized, indexed rows in app-private SQLite through the Rust repository layer. Load only its small summary at startup and query bounded Explorer, treemap, Search, and Large Files results lazily so the full index is never reconstructed in RAM. Settings can remain in their simpler store until their requirements justify moving them.
⸻ 35. Platform-Specific Requirements

35.1 macOS first-class support

Implement:

- Full Disk Access status/guidance;
- APFS volume handling;
- system Trash;
- reveal in Finder;
- home/root scan behavior;
- common macOS app/cache locations;
- Apple Silicon + Intel build support eventually;
- signed/notarized release later.

35.2 Linux first-class support

Implement:

- common desktop Linux support;
- mounted volumes;
- XDG directories;
- system Trash via appropriate library;
- reveal in default file manager;
- permission-denied reporting;
- common cache locations;
- Flatpak/Snap awareness later;
- .deb/AppImage/other packaging to decide later.

Do not require root to use the app.

35.3 Windows later

Architecture should not block:

- drive letters;
- NTFS;
- Recycle Bin;
- AppData;
- Windows protected paths;
- Explorer reveal;
- Windows application metadata.

35.4 Android later

Android will require a separate capability review because filesystem access is permission/scoped-storage constrained.

Do not design desktop cleanup APIs around unrestricted Android filesystem assumptions.
⸻ 36. Common UI Components to Build Before Feature Pages

Only after theme/tokens are defined.

Build a small useful set:

- PageHeader
- SectionCard
- Metric
- StorageProgress
- SafetyBadge
- FileTypeIcon
- PathText
- EmptyState
- LoadingState
- ErrorState
- ConfirmActionDialog
- ResponsiveDataList
- FilterBar
- SelectionSummary
- AppTooltip
- AppSheet
- AppDialog

Use shadcn primitives when they fit.

Do not rewrite shadcn primitives unnecessarily.

Do not create a universal component for every possible variant.
⸻ 37. Mock-First UI Development

Before Rust features are implemented, build pages with realistic fixtures.

Each feature can have a local fixture:

features/large-files/**fixtures**/large-files.ts

Fixtures should look realistic:

- long paths;
- tiny and huge sizes;
- empty states;
- warning states;
- hundreds of rows conceptually;
- permission errors;
- unknown file types.

Do not use lorem ipsum.

The page should be visually complete before backend wiring.

Once backend is ready:

- replace fixture query function;
- preserve the same UI contract;
- remove fixture usage from production path.
  ⸻

38. Detailed Implementation Order

Do not skip ahead unless a dependency forces it.

Phase 0 — Baseline

- confirm Tauri runs on macOS;
- confirm Tauri runs on Linux;
- install formatter/linter;
- establish build scripts;
- verify identifier/name/icon placeholders;
- commit clean baseline.

Phase 1 — Project Structure

- create frontend directories;
- create routes;
- create basic feature folders;
- split app bootstrap/provider/router;
- create Rust modular skeleton only where needed;
- no feature implementation yet.

Phase 2 — Theme Foundation

- Tailwind/shadcn setup;
- CSS variables/tokens;
- typography;
- surfaces;
- spacing;
- border radius;
- semantic colors;
- dark theme;
- responsive breakpoints;
- focus states.

Phase 3 — App Shell

- desktop sidebar;
- top command bar;
- mobile navigation;
- storage summary placeholder;
- global page container;
- route active states;
- responsive behavior.

Phase 4 — Route/Page Skeletons

Create every primary page with:

- correct route;
- page title;
- feature page component;
- section structure;
- realistic placeholder/fixture state.

No backend yet.

Phase 5 — Core Components

Build shared components proven necessary by page skeletons.

Refactor duplication only after seeing it.

Phase 6 — Space Map UI

- empty state;
- scan state;
- complete state;
- treemap mock;
- selected-node detail;
- breadcrumbs;
- responsive behavior.

Phase 7 — Disk Explorer UI

- table;
- list fallback;
- breadcrumb;
- row action menu;
- sorting/filter layout;
- empty/loading/error.

Phase 8 — Cleanup Hub UI

- aggregate categories;
- selection;
- safety labels;
- cleanup review modal/page;
- post-clean result mock.

Phase 9 — Large Files UI

- header metrics;
- filter controls;
- responsive data list;
- selection;
- safety states.

Phase 10 — Duplicate UI

- group cards/table;
- keep/remove semantics;
- smart-select UI;
- empty state.

Phase 11 — Developer Cleanup UI

- category accordion;
- project rows;
- sizes;
- safety/explanation.

Phase 12 — AI Storage UI

- tool grouping;
- storage-kind grouping;
- consequences;
- model vs cache distinction.

Phase 13 — App Leftovers UI

- app groups;
- confidence;
- selected amount;
- review states.

Phase 14 — System UI

- memory;
- processor;
- storage volumes;
- OS info;
- responsive grid.

Phase 15 — Settings UI

- general;
- scan;
- exclusions;
- safety;
- permissions;
- updates;
- privacy;
- license placeholder only if needed.

Phase 16 — Search UI

- command palette;
- keyboard support;
- mobile full-screen search;
- results;
- empty/loading.

Phase 17 — Onboarding / Permission UI

- first run;
- safety;
- platform permission;
- first scan.

At this point the entire product UI should exist and be reviewable with fixtures.
⸻ 39. Backend Implementation Order

Only after the UI structure is stable.

Backend Phase 1 — System Info

Start with a small feature:

- system metadata;
- volumes;
- memory;
- CPU;
- wire System page.

This proves Tauri command patterns.

Backend Phase 2 — Scan Engine

- scan scope;
- progress events;
- cached Rust index;
- scan summary;
- cancellation;
- error handling.

Wire shell + Space Map scan state.

Backend Phase 3 — Explorer

- root listing;
- directory drill-down;
- size sort;
- cached-index queries;
- wire Explorer.

Backend Phase 4 — Treemap Summary

- bounded hierarchical summary;
- categories;
- drill-down queries;
- wire Space Map.

Backend Phase 5 — Search

- indexed search;
- result limits;
- wire Global Search.

Backend Phase 6 — Large Files

- cached-index query;
- pagination/filter;
- wire Large Files.

Backend Phase 7 — Developer Cleanup

- initial detectors;
- wire Developer Cleanup.

Backend Phase 8 — AI Storage

- local manifest;
- platform detectors;
- wire AI Storage.

Backend Phase 9 — Duplicate Finder

- staged hashing;
- cancellation/progress;
- wire Duplicates.

Backend Phase 10 — App Leftovers

- installed app inventory;
- heuristic detection;
- confidence;
- wire App Leftovers.

Backend Phase 11 — Cleanup Safety

Before any actual file movement:

- canonicalization;
- scope validation;
- protected paths;
- Trash integration;
- cleanup preview;
- cleanup result.

Then wire Cleanup Hub and selection actions.

Backend Phase 12 — Settings / Exclusions

- persistence;
- exclusions applied during scan and cleanup;
- platform permission state.

Backend Phase 13 — Updates

- update check;
- update UI;
- release flow.

Backend Phase 14 — Licensing, only if/when product direction is decided

Core scanning/cleaning should not depend on payment integration during development.
⸻ 40. Accessibility and Input

Support:

- keyboard navigation;
- visible focus;
- Enter/Space activation;
- Esc closes overlays;
- Cmd/Ctrl+K search;
- Backspace/Alt+Left for explorer navigation where appropriate;
- screen-reader labels for icon-only buttons;
- no color-only safety communication;
- sufficient contrast;
- touch interaction on mobile.

Treemap needs a keyboard-accessible alternative through Explorer/list mode.
⸻ 41. Performance Acceptance Targets

The app should:

- remain interactive during scans;
- avoid UI freezes during duplicate hashing;
- avoid rendering thousands of DOM rows at once;
- not transmit million-node scan trees over Tauri IPC;
- not rescan the filesystem when changing pages;
- lazily calculate expensive analyzers;
- allow scan cancellation;
- support directories with very large file counts;
- keep progress event frequency bounded.

Measure before optimizing micro-details.
⸻ 42. Error Handling

Backend errors should become typed frontend errors.

Examples:

- permission denied;
- scan target missing;
- path disappeared;
- filesystem unavailable;
- hash read failed;
- Trash operation failed;
- protected path blocked;
- scan cancelled.

UI should show concise messages with optional technical details expandable/copyable.

Never dump a Rust panic/stack trace into the normal UI.
⸻ 43. Security / Safety Rules

This product touches user files, so safety is a feature.

Required:

- no deletion outside explicit user-selected scope;
- protected path checks in Rust;
- Trash as default;
- explicit review;
- no automatic deletion;
- no background cleanup without opt-in;
- no hidden filesystem mutation;
- no path traversal vulnerabilities;
- canonicalize before destructive actions;
- symlink-aware checks;
- do not follow symlinks by default;
- do not run as root by default;
- never log sensitive full file paths to external services;
- no telemetry containing filenames.
  ⸻

44. Testing Strategy

Do not wait until the end.

Frontend

Test critical logic:

- size formatting;
- selection totals;
- safety filtering;
- duplicate smart-select behavior;
- route states;
- responsive component behavior where practical.

Rust

Unit-test:

- protected path rules;
- path scope validation;
- category classification;
- detector matching;
- duplicate grouping;
- partial/full hash workflow;
- size aggregation;
- exclusion matching.

Integration

Use temporary test directories with controlled structures.

Scenarios:

- nested folders;
- inaccessible folder where test environment allows;
- symlink;
- hard link;
- duplicate files;
- zero-byte files;
- huge sparse file;
- Unicode filenames;
- deeply nested path;
- file deleted during scan;
- file changed after scan before cleanup.

Never test destructive logic against real user folders.
⸻ 45. Cross-Platform QA Matrix

Every release candidate should be checked on:

macOS

- current supported macOS;
- Apple Silicon;
- Intel when possible;
- Full Disk Access granted/revoked;
- home scan;
- custom scan;
- external drive;
- Trash.

Linux

At minimum:

- Ubuntu/Debian-family;
- one Wayland desktop;
- one X11 environment if feasible;
- home scan;
- custom scan;
- external/mounted volume;
- inaccessible paths;
- Trash;
- app bundle/package launch behavior.

Windows comes later.
⸻ 46. “Done” Definition for a Feature

A feature is not done because the happy-path UI exists.

A feature is done when:

- route/page exists;
- desktop UI is polished;
- tablet/narrow layout works;
- mobile layout works;
- loading state exists;
- empty state exists;
- error state exists;
- backend command is implemented;
- data contract is typed;
- no giant IPC payload;
- cancellation exists if long-running;
- safety rules apply if destructive;
- keyboard interaction works;
- formatting/lint passes;
- relevant tests pass;
- feature is checked in docs/toto-progress.md.
  ⸻

47. Initial Release Scope

The first genuinely useful DiskVacuum release should prioritize:

1. macOS + Linux
2. scan Home / Drive / Folder
3. Space Map
4. Disk Explorer
5. Global Search
6. Large Files
7. Developer Cleanup
8. basic AI Storage
9. Cleanup Hub
10. safe Trash cleanup
11. exclusions
12. System Dashboard
13. permission/error handling
14. polished responsive UI

Duplicates can be included once the core scan index is reliable.

App Leftovers should not ship until confidence rules are trustworthy.

Licensing can be added after the application is useful.
⸻ 48. Later Enhancements

After core quality:

- Windows;
- Android;
- scheduled scans;
- storage-change history;
- “what grew since last scan”;
- stale/old file views;
- empty folder detection;
- download/installers cleanup;
- browser cache cleanup;
- Docker-aware cleanup;
- menu bar/tray quick status;
- notifications for low disk space;
- cleanup presets;
- export scan report;
- multiple drive comparison;
- duplicate image similarity as a separate feature;
- app uninstaller;
- signed remote cleanup manifests;
- localization.

Do not implement these before core quality.
⸻ 49. Codex Working Rules

When implementing this plan:

1. Work step-by-step.
2. Do not redesign the architecture every phase.
3. Do not create empty abstractions “for later”.
4. Keep route files thin.
5. Keep feature code inside the feature.
6. Put only proven shared components into components/core.
7. Keep Rust command handlers small.
8. Keep platform-specific code centralized.
9. Do not send the full scan index to React.
10. Do not implement destructive actions before server-side safety rules.
11. Do not copy Reclaim source code or exact UI.
12. Use realistic fixture data during UI phases.
13. Make each page responsive before moving to the next.
14. Update docs/toto-progress.md after completing each task.
15. Run checks from docs/steps-summary-checks.md before marking a phase done.
16. Prefer readable code over clever code.
17. Prefer a concrete implementation over unnecessary generic abstractions.
18. If a module becomes hard to understand, split it by responsibility; do not split it merely because it is Rust.
19. Keep the app looking like a professional desktop utility.
20. Safety and correctness take priority over cleanup aggressiveness.
    ⸻
21. Final Product Standard

DiskVacuum should not feel like “a Reclaim clone”.

It should feel like:

a clean, native-feeling, cross-platform storage utility with strong visual analysis, developer-focused cleanup, AI-storage awareness, and unusually careful safety.

When a user opens it, they should understand the product within seconds.

When they scan, the UI should stay responsive.

When DiskVacuum suggests cleanup, the user should understand why an item is safe or why it needs review.

When DiskVacuum removes something, the user should know exactly what happened.

That is the quality bar.
