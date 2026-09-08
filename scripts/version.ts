import { readFile, writeFile } from "node:fs/promises";

const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const requestedVersion = process.argv[2];
const checkOnly = requestedVersion === "--check";

const packagePath = new URL("../package.json", import.meta.url);
const tauriConfigPath = new URL("../src-tauri/tauri.conf.json", import.meta.url);
const cargoManifestPath = new URL("../src-tauri/Cargo.toml", import.meta.url);
const cargoLockPath = new URL("../src-tauri/Cargo.lock", import.meta.url);

const packageJson = JSON.parse(await readFile(packagePath, "utf8"));
const tauriConfig = JSON.parse(await readFile(tauriConfigPath, "utf8"));
let cargoManifest = await readFile(cargoManifestPath, "utf8");
let cargoLock = await readFile(cargoLockPath, "utf8");

const cargoVersion = cargoManifest.match(
  /^\[package\][\s\S]*?^version = "([^"]+)"/m,
)?.[1];

if (!cargoVersion) {
  throw new Error("Could not read the application version from src-tauri/Cargo.toml");
}

function assertAligned(expectedTag?: string) {
  const versions = new Set([packageJson.version, tauriConfig.version, cargoVersion]);
  if (versions.size !== 1) {
    throw new Error(
      `Version mismatch: package.json=${packageJson.version}, tauri.conf.json=${tauriConfig.version}, Cargo.toml=${cargoVersion}`,
    );
  }

  const version = packageJson.version as string;
  if (!VERSION_PATTERN.test(version)) {
    throw new Error(`Invalid semantic version: ${version}`);
  }

  if (expectedTag && expectedTag !== `v${version}`) {
    throw new Error(`Release tag ${expectedTag} must match app version v${version}`);
  }

  console.log(`DiskVacuum version ${version} is aligned.`);
}

if (checkOnly) {
  assertAligned(process.env.GITHUB_REF_TYPE === "tag" ? process.env.GITHUB_REF_NAME : undefined);
  process.exit(0);
}

if (!requestedVersion || !VERSION_PATTERN.test(requestedVersion)) {
  throw new Error("Usage: bun run release:prepare <major.minor.patch>");
}

packageJson.version = requestedVersion;
tauriConfig.version = requestedVersion;
cargoManifest = cargoManifest.replace(
  /(^\[package\][\s\S]*?^version = ")[^"]+("$)/m,
  `$1${requestedVersion}$2`,
);
cargoLock = cargoLock.replace(
  /(\[\[package\]\]\nname = "disk-vacuum"\nversion = ")[^"]+("\n)/,
  `$1${requestedVersion}$2`,
);

await Promise.all([
  writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`),
  writeFile(tauriConfigPath, `${JSON.stringify(tauriConfig, null, "\t")}\n`),
  writeFile(cargoManifestPath, cargoManifest),
  writeFile(cargoLockPath, cargoLock),
]);

console.log(`Prepared DiskVacuum v${requestedVersion}.`);
console.log(`Next: review, commit, then push tag v${requestedVersion}.`);
