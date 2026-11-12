#!/usr/bin/env node

import { chmodSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { assertAllowedProjectId } from "./hosted-preview-readiness-config.mjs";
import { withNeonApiKey } from "./neon-cli-auth.mjs";
import { applyNeonMigrations, assertMigrationTargetReady } from "./apply-neon-migrations.mjs";

const PROJECT_ID = process.env.OUTPOST_NEON_PROJECT_ID ?? "outpost-test-project";
const BRANCH_NAME = process.env.OUTPOST_NEON_BRANCH_NAME ?? `outpost-vercel-preview-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${Date.now().toString(36)}`;
const PARENT_BRANCH = process.env.OUTPOST_NEON_PARENT_BRANCH ?? "production";
const DATABASE_NAME = process.env.OUTPOST_NEON_DATABASE_NAME ?? "neondb";
const ROLE_NAME = process.env.OUTPOST_NEON_ROLE_NAME ?? "neondb_owner";
const SEED_PASSWORD_PATH =
  process.env.OUTPOST_NEON_SEED_PASSWORD_FILE ?? join(tmpdir(), `${BRANCH_NAME}-seed-password`);

function invariant(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function runCommand(command, args, label, options = {}) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    ...options
  });

  if (result.status !== 0) {
    throw new Error(`${label} failed.\n${[result.stdout, result.stderr].filter(Boolean).join("\n")}`);
  }

  return result.stdout;
}

function runNeonJson(args, label) {
  return JSON.parse(runCommand("neon", withNeonApiKey([...args, "--output", "json"]), label));
}

function createOrLoadDataApi() {
  const getArgs = [
    "data-api",
    "get",
    "--project-id",
    PROJECT_ID,
    "--branch",
    BRANCH_NAME,
    "--database",
    DATABASE_NAME
  ];
  const createArgs = [
    "data-api",
    "create",
    "--project-id",
    PROJECT_ID,
    "--branch",
    BRANCH_NAME,
    "--database",
    DATABASE_NAME,
    "--auth-provider",
    "neon_auth",
    "--db-schemas",
    "public",
    "--db-anon-role",
    "anonymous",
    "--jwt-role-claim-key",
    ".role",
    "--db-aggregates-enabled"
  ];

  try {
    return runNeonJson(createArgs, "Neon Data API create");
  } catch (error) {
    const existingDataApi = runNeonJson(getArgs, "Neon Data API lookup after create failure");

    if (existingDataApi?.url) {
      return existingDataApi;
    }

    throw error;
  }
}

function branchExists(branchName) {
  const result = spawnSync(
    "neon",
    withNeonApiKey(["branches", "get", branchName, "--project-id", PROJECT_ID, "--output", "json"]),
    {
      cwd: process.cwd(),
      encoding: "utf8"
    }
  );

  if (result.status === 0) {
    return true;
  }

  const output = `${result.stdout}\n${result.stderr}`;
  if (output.match(/not found|404|does not exist/i)) {
    return false;
  }

  throw new Error(`Unable to check Neon branch ${branchName}.\n${output}`);
}

function loadDatabaseUrl(branchName) {
  const databaseUrl = runCommand(
    "neon",
    withNeonApiKey([
      "connection-string",
      branchName,
      "--project-id",
      PROJECT_ID,
      "--database-name",
      DATABASE_NAME,
      "--role-name",
      ROLE_NAME
    ]),
    "Neon connection string lookup"
  ).trim();

  invariant(databaseUrl.match(/^postgres(?:ql)?:\/\//), "Neon did not return a direct PostgreSQL connection string.");
  return databaseUrl;
}

function writeRotatedSeedPassword() {
  const password = `outpost-${randomBytes(24).toString("base64url")}`;
  writeFileSync(SEED_PASSWORD_PATH, `${password}\n`, { mode: 0o600 });
  chmodSync(SEED_PASSWORD_PATH, 0o600);
}

async function main() {
  assertAllowedProjectId(PROJECT_ID);
  invariant(BRANCH_NAME !== "production", "Refusing to prepare the Neon production branch for proof.");
  invariant(BRANCH_NAME !== "outpost-neon-spike", "Refusing to use the Neon migration spike branch for Vercel preview proof.");
  invariant(PARENT_BRANCH === "production", "Hosted proof branches must be created from the Neon production branch.");
  invariant(!BRANCH_NAME.includes(" "), "OUTPOST_NEON_BRANCH_NAME must not contain spaces.");
  invariant(!branchExists(BRANCH_NAME), `Neon branch ${BRANCH_NAME} already exists. Use a fresh branch name for rotated proof data.`);
  assertMigrationTargetReady({ databaseUrl: loadDatabaseUrl(PARENT_BRANCH) });

  const branch = runNeonJson(
    ["branches", "create", "--project-id", PROJECT_ID, "--parent", PARENT_BRANCH, "--name", BRANCH_NAME],
    "Neon proof branch creation"
  );
  applyNeonMigrations({ databaseUrl: loadDatabaseUrl(BRANCH_NAME) });

  const auth = runNeonJson(
    ["neon-auth", "enable", "--project-id", PROJECT_ID, "--branch", BRANCH_NAME, "--database-name", DATABASE_NAME],
    "Neon Auth enable"
  );
  const dataApi = createOrLoadDataApi();

  writeRotatedSeedPassword();

  console.log("Outpost hosted Neon proof branch prepared");
  console.log(`Project: ${PROJECT_ID}`);
  console.log(`Branch: ${BRANCH_NAME}`);
  console.log(`Branch id: ${branch.branch?.id ?? branch.id ?? "unknown"}`);
  console.log(`Neon Auth URL: ${auth.base_url}`);
  console.log(`Neon Data API URL: ${dataApi.url}`);
  console.log(`Rotated seed password file: ${SEED_PASSWORD_PATH}`);
  console.log("\nUse:");
  console.log(`OUTPOST_NEON_BRANCH_NAME='${BRANCH_NAME}'`);
  console.log(`NEXT_PUBLIC_NEON_AUTH_URL='${auth.base_url}'`);
  console.log(`NEXT_PUBLIC_NEON_DATA_API_URL='${dataApi.url}'`);
  console.log(`OUTPOST_NEON_SEED_PASSWORD="$(cat '${SEED_PASSWORD_PATH}')"`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
