# DiskVacuum self-updater

DiskVacuum checks the latest published GitHub release shortly after launch. When a newer signed version exists, the top bar and Settings page offer **Update and restart** with download progress.

## One-time signing setup

Generate a password-protected updater key on a trusted machine. Never add the private key or its password to Git:

```bash
bun tauri signer generate -w "$HOME/.tauri/disk-vacuum-updater.key"
```

The public key is committed in `src-tauri/tauri.conf.json` because it is safe and must be embedded in every installation. Add the private key file contents as the GitHub Actions secret `TAURI_SIGNING_PRIVATE_KEY`, and its password as `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`.

For a signed local build, copy `.env.example` to `.env` and fill in the `TAURI_SIGNING_PRIVATE_KEY` set to the private-key path and its password. The `release:build` command loads the ignored `.env` explicitly before running Tauri.

Back up the private key and password securely. Losing them prevents existing installations from accepting future updates. Replacing the public key also breaks updates for already-installed copies.

## Publish a release

GitHub Releases hosts both the installers and `latest.json`, so no separate update server is required.

1. Prepare the next semantic version with one command:

   ```bash
   bun run release:prepare 0.2.0
   ```

   This keeps `package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, and `src-tauri/Cargo.lock` aligned.
2. Review and commit the version change.
3. Publish the committed version with one guarded command:

   ```bash
   bun run release:publish
   ```

   It verifies aligned versions, a clean `main` branch, and an unused local and remote tag before pushing `main` and the matching tag. CI rejects a tag that does not match the embedded application version.
4. Update `release-notes.md` with short bullets under **Bug fixes**, **Performance improvements**, and **Cleanup improvements**. The release workflow uses this file for the concise in-app “What is new” cards, then appends GitHub's generated notes to the GitHub Release page.
5. The release workflow builds Linux, Windows, and Intel/Apple Silicon macOS bundles, signs updater artifacts, publishes them, and uploads `latest.json`.
6. Test from an installed older build. Development mode can check the channel but cannot safely simulate replacing an installed bundle.

The first installed public build must already contain the configured updater public key; otherwise that installation cannot verify or install later updates.

macOS distribution signing/notarization is separate from Tauri updater signing and must be configured before a public macOS release.

The current in-app updater is desktop-only. Android releases include a signed APK, but Android update discovery and installation must use an Android-specific distribution flow (normally Google Play in-app updates, or a separately implemented signed-APK updater). The desktop `latest.json` does not contain an Android updater target.
