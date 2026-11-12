#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readHostedReadinessConfig } from "./hosted-preview-readiness-config.mjs";
import { withNeonApiKey } from "./neon-cli-auth.mjs";

const DEPLOYMENT_URL = normalizeDeploymentUrl(process.env.OUTPOST_VERCEL_DEPLOYMENT_URL ?? process.argv[2]);
const PROOF_STARTED_AT = new Date().toISOString();

function invariant(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function normalizeDeploymentUrl(rawUrl) {
  invariant(rawUrl, "OUTPOST_VERCEL_DEPLOYMENT_URL or a deployment URL argument is required.");
  const withProtocol = rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`;
  let url;

  try {
    url = new URL(withProtocol);
  } catch {
    throw new Error("OUTPOST_VERCEL_DEPLOYMENT_URL is not a valid URL.");
  }

  const localHosts = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);
  invariant(url.protocol === "https:", "Vercel preview proof must use an https deployment URL.");
  invariant(!localHosts.has(url.hostname), "Refusing Vercel preview proof against a local app URL.");
  invariant(url.hostname.endsWith(".vercel.app"), "Vercel preview proof must target a vercel.app deployment URL.");
  url.pathname = "";
  url.search = "";
  url.hash = "";

  return url.toString().replace(/\/$/u, "");
}

function runCommand(args, label, options = {}) {
  const result = spawnSync(args[0], args.slice(1), {
    cwd: process.cwd(),
    encoding: "utf8",
    env: process.env,
    ...options
  });

  if (result.status !== 0) {
    throw new Error(`${label} failed.\n${[result.stdout, result.stderr].filter(Boolean).join("\n")}`);
  }

  return result.stdout;
}

function runVercelJson(args, label) {
  return JSON.parse(runCommand(["vercel", ...args, "--format", "json"], label));
}

function runNeonJson(args, label) {
  const output = runCommand(["neon", ...withNeonApiKey([...args, "--output", "json"])], label);
  return output.trim() ? JSON.parse(output) : null;
}

function sqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function runNeonPsql(config, args) {
  return runCommand(
    ["neon", ...withNeonApiKey([
      "connection-string",
      config.branchName,
      "--project-id",
      config.projectId,
      "--database-name",
      config.databaseName,
      "--role-name",
      process.env.OUTPOST_NEON_ROLE_NAME ?? "neondb_owner",
      "--psql",
      "--",
      ...args
    ])],
    "Neon hosted proof record"
  );
}

function runPsqlScript(config, sql) {
  const tempDir = mkdtempSync(join(tmpdir(), "outpost-vercel-preview-proof-"));
  const scriptPath = join(tempDir, "proof.sql");

  try {
    writeFileSync(scriptPath, sql);
    return runNeonPsql(config, ["-v", "ON_ERROR_STOP=1", "-f", scriptPath]);
  } finally {
    rmSync(tempDir, { force: true, recursive: true });
  }
}

function assertDeploymentReady(deployment) {
  const readyState = deployment.readyState ?? deployment.state ?? deployment.status;

  invariant(readyState === "READY" || readyState === "ready", `Vercel deployment is not ready: ${readyState ?? "unknown"}`);
  invariant(
    deployment.target !== "production",
    "Refusing Vercel preview proof against a production deployment target."
  );
}

function ensureNeonAuthTrustedDomain(config, deploymentUrl) {
  const domains = runNeonJson(
    ["neon-auth", "domain", "list", "--project-id", config.projectId, "--branch", config.branchName],
    "Neon Auth trusted domain list"
  );

  if (Array.isArray(domains) && domains.some((entry) => entry?.domain === deploymentUrl)) {
    return;
  }

  runCommand(
    ["neon", ...withNeonApiKey(["neon-auth", "domain", "add", deploymentUrl, "--project-id", config.projectId, "--branch", config.branchName])],
    "Neon Auth trusted domain add"
  );
}

function recordVercelPreviewProofRun(config) {
  const completedAt = new Date().toISOString();
  const summary = {
    founder_admin_readiness: "passed",
    hosted_beta_workflow: "passed",
    neon_auth_trusted_domain: "verified",
    preview_deployment: "ready"
  };

  runPsqlScript(
    config,
    `
      insert into hosted_proof_runs (
        id,
        proof_kind,
        status,
        neon_branch_name,
        app_origin,
        started_at,
        completed_at,
        summary
      )
      values (
        ${sqlLiteral(`proof_vercel_preview_${Date.now().toString(36)}`)},
        'vercel_preview_verify',
        'passed',
        ${sqlLiteral(config.branchName)},
        ${sqlLiteral(DEPLOYMENT_URL)},
        ${sqlLiteral(PROOF_STARTED_AT)}::timestamptz,
        ${sqlLiteral(completedAt)}::timestamptz,
        ${sqlLiteral(JSON.stringify(summary))}::jsonb
      );
    `
  );
}

async function main() {
  const config = readHostedReadinessConfig();
  const deployment = runVercelJson(["inspect", DEPLOYMENT_URL, "--wait", "--timeout", "180s"], "Vercel deployment inspect");
  assertDeploymentReady(deployment);
  ensureNeonAuthTrustedDomain(config, DEPLOYMENT_URL);

  process.env.OUTPOST_NEON_PROJECT_ID = config.projectId;
  process.env.OUTPOST_NEON_BRANCH_NAME = config.branchName;
  process.env.NEXT_PUBLIC_NEON_AUTH_URL = config.neonAuthUrl;
  process.env.NEXT_PUBLIC_NEON_DATA_API_URL = config.neonDataApiUrl;
  process.env.OUTPOST_NEON_SEED_PASSWORD = config.seedPassword;
  process.env.NEXT_PUBLIC_OUTPOST_APP_URL = DEPLOYMENT_URL;
  process.env.OUTPOST_USE_VERCEL_CURL = process.env.OUTPOST_USE_VERCEL_CURL ?? "1";

  console.log("Outpost Vercel preview proof");
  console.log(`Deployment: ${DEPLOYMENT_URL}`);
  console.log(`Neon branch: ${config.branchName}`);
  console.log("Mode: Vercel Preview + hosted Neon Auth/Data API owner/staff workflow, no live providers\n");

  runCommand(["npm", "run", "hosted:beta-workflow"], "Hosted beta workflow against Vercel Preview", {
    stdio: ["ignore", "inherit", "pipe"]
  });
  runCommand(
    ["npm", "run", "hosted:admin-portal-readiness"],
    "Hosted admin portal readiness against Vercel Preview",
    {
      stdio: ["ignore", "inherit", "pipe"]
    }
  );
  recordVercelPreviewProofRun(config);
  console.log("Vercel Preview proof record appended.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
