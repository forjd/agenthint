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

const before = new Map(generatedPaths.map((path) => [path, readFileSync(path, "utf8")]));

execFileSync("node", ["scripts/generate.mjs"], { stdio: "inherit" });

const stale = generatedPaths.filter((path) => readFileSync(path, "utf8") !== before.get(path));

if (stale.length > 0) {
  console.error("generated files are out of date:");
  for (const path of stale) {
    console.error(`  ${path}`);
  }
  console.error("Run `npm run generate` and commit the result.");
  process.exit(1);
}
