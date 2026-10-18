# Installed apps

- Added Installed Apps on Linux, macOS, and Windows with search, sorting, storage and cache sizes, and Locate actions.
- Added icon buttons with hover labels and confirmation before clearing cache or uninstalling apps.
- Linux hides system components, protected packages, and apps other installed packages rely on; package removal previews must affect only the selected app.
- Windows conservatively filters system components, runtimes, drivers, and package dependencies, and uses native uninstallers with administrator prompts when needed.
- macOS can move eligible application bundles and identifiable caches to Trash.

# Reliability

- Added Windows PowerShell policy checks and native Rust tests before release builds.
- Corrected platform-specific test fixtures and Windows test-harness startup while preserving cleanup protections.
- Improved redirected-path protection and missing-Cargo setup instructions.

Windows and macOS app management remain previews pending hands-on verification. Uncertain entries and cache locations are intentionally unavailable.
