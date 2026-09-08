# DiskVacuum self-updater

DiskVacuum checks the latest published GitHub release shortly after launch. When a newer signed version exists, the top bar and Settings page offer **Update and restart** with download progress.

## One-time signing setup

Generate a password-protected updater key on a trusted machine. Never add the private key or its password to Git:

```bash
bun tauri signer generate -w "$HOME/.tauri/disk-vacuum-updater.key"
```

Copy the public key printed by the command into the GitHub repository variable `DISK_VACUUM_UPDATER_PUBLIC_KEY`. Add the private key file contents as the GitHub Actions secret `TAURI_SIGNING_PRIVATE_KEY`, and its password as `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`.

For a signed local build, copy `.env.example` to `.env` and fill in the public key, private-key path, and password. The `release:build` command loads the ignored `.env` explicitly before running Tauri.

Back up the private key and password securely. Losing them prevents existing installations from accepting future updates. Replacing the public key also breaks updates for already-installed copies.

## Publish a release

GitHub Releases hosts both the installers and `latest.json`, so no separate update server is required.

1. Prepare the next semantic version with one command:

   ```bash
   bun run release:prepare 0.2.0
   ```

   This keeps `package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, and `src-tauri/Cargo.lock` aligned.
2. Review and commit the version change.
3. Push a matching tag, for example `v0.2.0`. CI rejects a tag that does not match the embedded application version.
4. The release workflow builds Linux AppImage and Intel/Apple Silicon macOS bundles, signs updater artifacts, publishes them, and uploads `latest.json`.
5. Test from an installed older build. Development mode can check the channel but cannot safely simulate replacing an installed bundle.

The first installed public build must already contain `DISK_VACUUM_UPDATER_PUBLIC_KEY`; otherwise that installation cannot verify or install later updates.

macOS distribution signing/notarization is separate from Tauri updater signing and must be configured before a public macOS release.
