import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const generatedPaths = [
  "src/generated-rules.ts",
  "src/generated-messages.ts",
  "crates/agenthint/src/generated_rules.rs",
  "crates/agenthint/src/generated_messages.rs",
  "python/agenthint/detection-rules.json",
  "python/agenthint/messages.json",
];

function reportStale(paths) {
  console.error("generated files are out of date:");
  for (const path of paths) {
    console.error(`  ${path}`);
  }
  console.error("Run `npm run generate` and commit the result.");
  process.exit(1);
}

function readSnapshot(path) {
  try {
    return readFileSync(path, "utf8");
  } catch {
    reportStale([path]);
  }
}

const before = new Map(generatedPaths.map((path) => [path, readSnapshot(path)]));

execFileSync(process.execPath, ["scripts/generate.mjs"], { stdio: "inherit" });

const stale = generatedPaths.filter((path) => readSnapshot(path) !== before.get(path));

if (stale.length > 0) {
  reportStale(stale);
}
