# DiskVacuum for Android

DiskVacuum's Android build uses the Tauri 2 project in `src-tauri/gen/android`.

## Storage model

- Android 11 and newer open the system's **All files access** screen on first launch.
- Android 7 through 10 use the legacy runtime storage permission dialog.
- System and Home scans both target shared storage at `/storage/emulated/0`.
- Scan indexes and settings stay in the app-private data directory.
- Android does not expose a system Trash API to DiskVacuum. Cleanup therefore uses the existing reviewed permanent-delete flow and keeps all canonical-path, scan-scope, changed-file, symlink, and exclusion checks.
- The custom-folder picker is hidden on Android because Android document-provider URIs are not ordinary filesystem paths.

## Local checks

The Android SDK must expose platform 36, build tools 36.0.0, and NDK 27.1.12297006. Install the Rust Android targets once:

```bash
rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android
```

Build an ARM64 debug APK:

```bash
ANDROID_SDK_ROOT="$ANDROID_HOME" \
NDK_HOME="$ANDROID_HOME/ndk/27.1.12297006" \
bun tauri android build --debug --apk --target aarch64 --ci
```

## Release signing

The release workflow expects these GitHub Actions secrets:

- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_STORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

The production keystore must be backed up securely. Every future APK update must use the same key. The workflow builds one universal APK, uploads it to the draft GitHub Release, and waits for it before publishing the combined release.

## Physical-device acceptance

- Install the debug APK through ADB.
- Confirm the All files access screen opens and can be granted.
- Scan shared storage with test files present.
- Confirm progress, capacity, categories, Explorer, treemap, search, large files, and duplicate analysis.
- Restart the app and confirm the saved scan reloads.
- Test permanent deletion only with disposable files created for this test.
- Deny/revoke storage access and confirm scans fail with the permission guidance.
- Install a newer APK signed with the same release key over the previous version.
