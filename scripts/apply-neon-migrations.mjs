#!/usr/bin/env node

import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const MIGRATIONS_DIR = fileURLToPath(new URL("../neon/migrations", import.meta.url));
const BASELINE_CONFIRMATION = "schema-verified";
const GREENFIELD_CONFIRMATION = "neon-auth-only-public-empty";

export function migrationVersionExists(version) {
  return readdirSync(MIGRATIONS_DIR).some((file) => file.startsWith(`${version}_`) && file.endsWith(".sql"));
}

export function atlasApplyArgs(
  databaseUrl,
  baselineVersion,
  baselineConfirmation,
  greenfieldConfirmation
) {
  if (!databaseUrl?.match(/^postgres(?:ql)?:\/\//)) {
    throw new Error("A direct PostgreSQL OUTPOST_DATABASE_URL is required.");
  }

  const args = [
    "migrate",
    "apply",
    "--env",
    "outpost",
    "--revisions-schema",
    "public",
    "--lock-timeout",
    "30s"
  ];

  if (baselineVersion) {
    if (greenfieldConfirmation) {
      throw new Error("Baseline and greenfield migration adoption cannot be combined.");
    }
    if (!baselineVersion.match(/^\d{14}$/) || !migrationVersionExists(baselineVersion)) {
      throw new Error("OUTPOST_NEON_BASELINE_VERSION must name an existing 14-digit migration version.");
    }
    if (baselineConfirmation !== BASELINE_CONFIRMATION) {
      throw new Error(
        `Set OUTPOST_NEON_BASELINE_CONFIRMATION=${BASELINE_CONFIRMATION} only after completing the schema-verification runbook.`
      );
    }
    args.push("--baseline", baselineVersion);
  } else if (greenfieldConfirmation) {
    if (greenfieldConfirmation !== GREENFIELD_CONFIRMATION) {
      throw new Error(
        `OUTPOST_NEON_GREENFIELD_CONFIRMATION must equal ${GREENFIELD_CONFIRMATION} after proving the public schema is empty.`
      );
    }
    args.push("--allow-dirty");
  }

  return args;
}

export function migrationStatusHasLedger(status) {
  return Array.isArray(status?.Applied) && status.Applied.length > 0;
}

export function assertMigrationTargetReady({
  databaseUrl,
  baselineVersion = process.env.OUTPOST_NEON_BASELINE_VERSION,
  baselineConfirmation = process.env.OUTPOST_NEON_BASELINE_CONFIRMATION,
  greenfieldConfirmation = process.env.OUTPOST_NEON_GREENFIELD_CONFIRMATION
}) {
  if (!databaseUrl?.match(/^postgres(?:ql)?:\/\//)) {
    throw new Error("A direct PostgreSQL OUTPOST_DATABASE_URL is required.");
  }

  const result = spawnSync(
    "atlas",
    [
      "migrate",
      "status",
      "--env",
      "outpost",
      "--revisions-schema",
      "public",
      "--format",
      "{{ json . }}"
    ],
    {
    cwd: ROOT,
    encoding: "utf8",
    env: { ...process.env, OUTPOST_DATABASE_URL: databaseUrl },
    stdio: ["ignore", "pipe", "pipe"]
    }
  );

  if (result.status === 0) {
    let status;
    try {
      status = JSON.parse(result.stdout);
    } catch {
      throw new Error("Atlas returned an unreadable migration status.");
    }

    if (migrationStatusHasLedger(status)) {
      if (baselineVersion || baselineConfirmation || greenfieldConfirmation) {
        throw new Error("This database already has a migration ledger. Unset the migration adoption variables.");
      }
      return "ledger";
    }

    if (greenfieldConfirmation) {
      atlasApplyArgs(databaseUrl, undefined, undefined, greenfieldConfirmation);
      return "verified-greenfield";
    }
    if (!baselineVersion) {
      throw new Error(
        "OUTPOST_NEON_BASELINE_VERSION is required because this target has no migration ledger."
      );
    }
    atlasApplyArgs(databaseUrl, baselineVersion, baselineConfirmation);
    return "verified-baseline";
  }

  const output = [result.stdout, result.stderr].filter(Boolean).join("\n");
  throw new Error(`Atlas could not inspect the target migration ledger.\n${output}`);
}

export function applyNeonMigrations({
  databaseUrl,
  baselineVersion = process.env.OUTPOST_NEON_BASELINE_VERSION,
  baselineConfirmation = process.env.OUTPOST_NEON_BASELINE_CONFIRMATION,
  greenfieldConfirmation = process.env.OUTPOST_NEON_GREENFIELD_CONFIRMATION
}) {
  const result = spawnSync(
    "atlas",
    atlasApplyArgs(databaseUrl, baselineVersion, baselineConfirmation, greenfieldConfirmation),
    {
    cwd: ROOT,
    encoding: "utf8",
    env: { ...process.env, OUTPOST_DATABASE_URL: databaseUrl },
    stdio: ["ignore", "inherit", "pipe"]
    }
  );

  if (result.error?.code === "ENOENT") {
    throw new Error("Atlas CLI is required. Install it from https://atlasgo.io/getting-started/.");
  }
  if (result.error) {
    throw new Error(`Atlas migration process failed: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(
      `Atlas migration apply failed. If this database predates the migration ledger, complete docs/runbooks/neon-migration-ledger.md before setting a baseline.\n${result.stderr ?? ""}`
    );
  }

  return "";
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const output = applyNeonMigrations({ databaseUrl: process.env.OUTPOST_DATABASE_URL });
    if (output) {
      process.stdout.write(`${output}\n`);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
