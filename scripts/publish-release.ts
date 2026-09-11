import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const packageJson = JSON.parse(
  await readFile(new URL("package.json", root), "utf8"),
) as { version: string };
const tag = `v${packageJson.version}`;

async function run(command: string[], capture = false) {
  const process = Bun.spawn(command, {
    cwd: root.pathname,
    stdin: "inherit",
    stdout: capture ? "pipe" : "inherit",
    stderr: "inherit",
  });
  const output = capture ? await new Response(process.stdout).text() : "";
  const exitCode = await process.exited;
  return { exitCode, output: output.trim() };
}

const versionCheck = await run(["bun", "scripts/version.ts", "--check"]);
if (versionCheck.exitCode !== 0) process.exit(versionCheck.exitCode);

const branch = await run(["git", "branch", "--show-current"], true);
if (branch.output !== "main") {
  throw new Error(`Release publishing must run from main, not ${branch.output || "a detached HEAD"}.`);
}

const status = await run(["git", "status", "--porcelain"], true);
if (status.output) {
  throw new Error("Commit all release changes before publishing. The worktree is not clean.");
}

const localTag = await run(["git", "tag", "--list", tag], true);
if (localTag.output) {
  throw new Error(`${tag} already exists locally. Prepare a newer version instead of moving a release tag.`);
}

const remoteTag = await run(
  ["git", "ls-remote", "--exit-code", "--tags", "origin", `refs/tags/${tag}`],
  true,
);
if (remoteTag.exitCode === 0) {
  throw new Error(`${tag} already exists on origin. Prepare a newer version instead.`);
}
if (remoteTag.exitCode !== 2) {
  throw new Error("Could not verify tags on origin. Check network access and authentication.");
}

console.log(`Publishing DiskVacuum ${tag}…`);
if ((await run(["git", "push", "origin", "main"])).exitCode !== 0) process.exit(1);
if ((await run(["git", "tag", "-a", tag, "-m", `DiskVacuum ${tag}`])).exitCode !== 0) process.exit(1);
if ((await run(["git", "push", "origin", tag])).exitCode !== 0) process.exit(1);

console.log(`${tag} was pushed. Follow the Release DiskVacuum workflow in GitHub Actions.`);
