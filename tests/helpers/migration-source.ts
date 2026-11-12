import { readdirSync, readFileSync } from "node:fs";

export function readMigrationSource() {
  return readdirSync("neon/migrations")
    .filter((file) => file.endsWith(".sql"))
    .sort()
    .map((file) => readFileSync(`neon/migrations/${file}`, "utf8"))
    .join("\n");
}
