#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import {
  assertHostedNeonBranchServiceUrls,
  readHostedReadinessConfig
} from "./hosted-preview-readiness-config.mjs";
import { withNeonApiKey } from "./neon-cli-auth.mjs";

const config = readHostedReadinessConfig();

function runNeonJson(args, label) {
  const result = spawnSync("neon", withNeonApiKey([...args, "--output", "json"]), {
    cwd: process.cwd(),
    encoding: "utf8"
  });

  if (result.status !== 0) {
    throw new Error(`${label} failed.\n${[result.stdout, result.stderr].filter(Boolean).join("\n")}`);
  }

  return JSON.parse(result.stdout);
}

const branch = runNeonJson(["branches", "get", config.branchName, "--project-id", config.projectId], "Neon branch lookup");
const authStatus = runNeonJson(
  ["neon-auth", "status", "--project-id", config.projectId, "--branch", config.branchName],
  "Neon Auth status lookup"
);
const dataApiStatus = runNeonJson(
  [
    "data-api",
    "get",
    "--project-id",
    config.projectId,
    "--branch",
    config.branchName,
    "--database",
    config.databaseName
  ],
  "Neon Data API status lookup"
);

assertHostedNeonBranchServiceUrls(config, branch, authStatus, dataApiStatus);

process.env.OUTPOST_NEON_PROJECT_ID = config.projectId;
process.env.OUTPOST_NEON_BRANCH_NAME = config.branchName;
process.env.NEXT_PUBLIC_NEON_AUTH_URL = config.neonAuthUrl;
process.env.NEXT_PUBLIC_NEON_DATA_API_URL = config.neonDataApiUrl;
process.env.OUTPOST_NEON_SEED_PASSWORD = config.seedPassword;

// Hosted Neon readiness uses the same Auth/Data API verifier after the hosted
// config has failed closed. It does not open live-provider gates.
await import("./verify-neon-spike-readiness.mjs");
