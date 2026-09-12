# DiskVacuum handoff

Use this file to continue DiskVacuum work in a new chat. It describes the state of this checkout as of 2026-09-12; verify anything that may have changed before acting.

## Project and priorities

- Repository: https://github.com/khalids01/disk-vacuum
- Website: https://diskvacuum.skycanvasstudio.com/
- Author: Khalid Khan (`@khalids01`)
- Current version in this checkout: `0.1.10`; the matching GitHub release and updater manifest were published and verified in the prior chat.
- The three original documents in `docs/` are the main product brief; `goal.md` predates them. Read the relevant product documents before making feature decisions. `docs/ux-improvement-plan.md` and `docs/todo-progress.md` track later UX and implementation work.
- The user prefers focused, inspect-first changes, truthful platform claims, minimal abstractions, and actual runtime verification. Do not run Git commands, commit, push, tag, publish, or start app servers unless explicitly requested in the new chat. Do not assume an earlier request to publish authorizes a later publish.

## Architecture

- Desktop app: Tauri 2 with Rust backend, React/TypeScript frontend, Bun, Vite, Tailwind and shadcn-style UI components.
- Routing: TanStack file router under `src/routes/`; `src/routeTree.gen.ts` is generated. Run `bun run build` before interpreting route-related TypeScript errors.
- State/data: TanStack Query plus Zustand stores. `src/stores/cleanup-queue-store.ts` persists the cleanup queue in local storage. Rust `ScanRepository` under `src-tauri/src/scan_repository.rs` holds the compact durable scan index in the app data directory.
- Backend commands are registered in `src-tauri/src/lib.rs`; `src-tauri/src/features/` contains scanning, safety, cleanup, duplicates, developer cleanup, AI storage, app leftovers, settings, and system information.
- Deletion is safety-critical: review `src-tauri/src/features/cleanup.rs` and `safety.rs` before changing validation or trash/permanent-delete behavior. Do not bypass canonical protected-path and changed-file checks to make a candidate deletable.
- The static marketing site is separate from the Tauri app. `website/` is the self-contained GitHub Pages artifact. Root `index.html` and root crawler files support the branch-root Pages source; `app.html` is the Vite/Tauri development entry. Keep both static HTML copies and crawler files aligned where applicable.

## What exists

- System, home, and chosen-folder scans; scan progress and cancellation; persistent scan summary/index; capacity/free-versus-reserved reporting; explorer, treemap, directory drill-down, and search.
- Cleanup surfaces for large files, duplicates, developer artifacts, AI storage, and app leftovers; cleanup queue, review, move to trash, and permanent deletion with validation.
- System-aware light/dark theme, responsive navigation, onboarding, settings, and signed in-app updater.
- Published Linux AppImage/DEB/RPM, macOS Intel/Apple Silicon DMG, and Windows x64 EXE/MSI builds. Windows and macOS are still preview-level: CI builds do not prove complete runtime behavior or OS publisher notarization/code-signing.
- Android is not shippable yet. Desktop unrestricted-filesystem assumptions must be redesigned for Android scoped storage and permissions; do not add an Android download without a real tested mobile build.

## Release and updater flow

1. `bun run release:prepare <next-semver>` aligns `package.json`, `src-tauri/tauri.conf.json`, `Cargo.toml`, `Cargo.lock`, and the site's visible/JSON-LD version.
2. Review, test, and commit changes. `bun run release:publish` requires a clean `main` and unused tag, pushes `main`, creates the tag, and pushes it.
3. `.github/workflows/release.yml` builds all desktop platforms as a **draft** GitHub Release, then the final job creates one signed `latest.json` and publishes the release. The finalizer must use permanent `/releases/download/vX.Y.Z/<asset>` URLs. Never use draft `browser_download_url` values: they contain `untagged-*` and return 404 after publishing.
4. Updater signing is separate from macOS Apple notarization and Windows Authenticode signing. CI needs `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` GitHub Actions secrets. Never expose or commit the private key/password.
5. Verify a release by checking the workflow succeeded, `releases/latest/download/latest.json` has the intended version and platform keys, all URLs use the permanent tag, all signatures are present, and installer URLs return HTTP 200/206. Test install/restart on actual target systems; a build alone is not enough.
6. The user confirmed updating installed `0.1.5` copies to `0.1.9` worked on macOS and Linux. Later `0.1.10` was published and its manifest verified, but do not infer every target's runtime from that.

See `docs/self-updater.md` for setup and command details. The last release-workflow repairs addressed draft-release lookup, manifest upload, and temporary asset URLs. Keep those invariants when editing `.github/workflows/release.yml`.

## Website and SEO

- `.github/workflows/pages.yml` deploys the static `website/` artifact on changes to `main`. At the end of the prior chat, GitHub Pages settings still showed `main → /(root)` as the publishing source, and the root `index.html` was serving the live site. Check which source is active before editing deployment behavior.
- The custom domain is `diskvacuum.skycanvasstudio.com`, with `CNAME` in root and `website/`. HTTPS certificate and "Enforce HTTPS" were working in the prior chat.
- `website/app.js` fetches the latest GitHub release and fills the platform download links and displayed version; the footer also has a release-script-updated fallback version.
- Root and `website/` contain `robots.txt`, `sitemap.xml`, `llms.txt`, and `llm.txt`; the HTML contains canonical/social/JSON-LD metadata and subtle author/repository links. Search-engine indexing is not guaranteed by these files. Google Search Console submission has not been confirmed.
- `bun run website:verify` checks the artifact shape, but also verify the live HTML/assets after deployment. Avoid accidentally serving the Vite `/src/main.tsx` entry on Pages or creating recursive redirects.

## Checks and current cautions

Useful non-mutating checks: `bun run version:check`, `bun run website:verify`, `bun run build`, and `cargo test --manifest-path src-tauri/Cargo.toml`. The prior chat's `0.1.10` run passed the production frontend build and 36 Rust tests; repeat after changes. Rust compilation can generate a very large `src-tauri/target/` build cache. Do not delete it without the user's direction.

Some README/platform-status wording may lag current previews; inspect before repeating it as current fact. The site may deploy via branch root despite a separate Pages Actions workflow also succeeding; do not assume workflow success means its artifact is what the custom domain serves.

## Suggested opening prompt for the next chat

"Continue the DiskVacuum app from `docs/handoff.md`. Read the relevant three original docs under `docs/` plus the UX/progress documents before planning new product work. Inspect the current code and state first. Do not run Git commands, publish, or start the app unless I ask. Tell me what you will change and verify it on the platforms in scope."
