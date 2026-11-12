import { spawnSync } from "node:child_process";

// Use npm's actual JS entry point on both Windows and Unix, without a shell.
const npm = process.env.npm_execpath;
if (!npm) throw new Error("Run this entry point with npm run ci:check.");

for (const script of [
  "check",
  "validate:release",
  "validate:updater",
  "validate:locales",
  "validate:atlas",
  "validate:models",
  "validate:interactions",
  "build",
  "build:pages",
  "build:client",
  "validate:client",
]) {
  const result = spawnSync(process.execPath, [npm, "run", script], { stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
