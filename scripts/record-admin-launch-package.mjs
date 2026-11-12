#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { readHostedReadinessConfig } from "./hosted-preview-readiness-config.mjs";
import { withNeonApiKey } from "./neon-cli-auth.mjs";

const ROLE_NAME = process.env.OUTPOST_NEON_ROLE_NAME ?? "neondb_owner";

function invariant(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertNoSecretShapedValue(value, label) {
  const text = String(value);
  const secretValue =
    /\bBearer\s+[A-Za-z0-9._~+/=-]{12,}/u.test(text) ||
    /\bpostgres(?:ql)?:\/\/[^:\s/@]+:[^@\s]+@/iu.test(text) ||
    /\bnapi_[A-Za-z0-9]{20,}\b/u.test(text) ||
    /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}(?:\.[A-Za-z0-9_-]{8,})?\b/u.test(text) ||
    text.includes("__Secure-neon-auth") ||
    text.includes("outpost_neon_auth_session") ||
    /(?:password|token|cookie|api[_-]?key|authorization|credential|private[_-]?key|secret|bypass|signature|jwt)\s*[:=]/iu.test(
      text
    );

  invariant(!secretValue, `${label} contains a secret-shaped value.`);
}

function assertNoSecretShapedKeys(value, label, trail = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoSecretShapedKeys(item, label, [...trail, String(index)]));
    return;
  }

  if (!value || typeof value !== "object") {
    return;
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/gu, "");
    const path = [...trail, key].join(".");
    const secretKey =
      normalizedKey.includes("password") ||
      normalizedKey.includes("token") ||
      normalizedKey.includes("cookie") ||
      normalizedKey.includes("apikey") ||
      normalizedKey.includes("authorization") ||
      normalizedKey.includes("credential") ||
      normalizedKey.includes("privatekey") ||
      normalizedKey.includes("secret") ||
      normalizedKey.includes("bypass") ||
      normalizedKey.includes("signature") ||
      normalizedKey.includes("jwt");

    invariant(!secretKey, `${label} contains a secret-shaped key at ${path}.`);
    assertNoSecretShapedKeys(nestedValue, label, [...trail, key]);
  }
}

function normalizeArtifactPath(rawPath, label) {
  invariant(rawPath?.trim(), `${label} is required.`);
  invariant(!rawPath.includes("\0"), `${label} cannot contain null bytes.`);
  assertNoSecretShapedValue(rawPath, label);

  const artifactPath = rawPath.trim();
  const resolvedPath = resolve(artifactPath);
  const repoRelativePath = relative(process.cwd(), resolvedPath);
  const isInsideRepo =
    repoRelativePath.length > 0 && !repoRelativePath.startsWith("..") && !isAbsolute(repoRelativePath);
  const isIgnoredArtifactPath = repoRelativePath === "artifacts" || repoRelativePath.startsWith(`artifacts${sep}`);

  invariant(!isInsideRepo || isIgnoredArtifactPath, `${label} must live under gitignored artifacts/ when repo-local.`);
  invariant(existsSync(artifactPath), `${label} was not found at ${artifactPath}.`);
  return artifactPath;
}

function readJsonArtifact(path, label) {
  const source = readFileSync(path, "utf8");
  assertNoSecretShapedValue(source, label);

  try {
    const parsed = JSON.parse(source);
    assertNoSecretShapedKeys(parsed, label);
    assertNoSecretShapedValue(JSON.stringify(parsed), label);
    return {
      parsed,
      sha256: createHash("sha256").update(source).digest("hex")
    };
  } catch (error) {
    throw new Error(`${label} must be valid JSON: ${error instanceof Error ? error.message : error}`);
  }
}

function readTextArtifact(path, label) {
  const source = readFileSync(path, "utf8");
  assertNoSecretShapedValue(source, label);
  return {
    source,
    sha256: createHash("sha256").update(source).digest("hex")
  };
}

function assertIncludes(values, expected, label) {
  invariant(Array.isArray(values), `${label} must be an array.`);
  invariant(values.includes(expected), `${label} must include ${expected}.`);
}

function normalizePreviewOrigin(rawUrl, label) {
  invariant(typeof rawUrl === "string" && rawUrl.trim(), `${label} is required.`);
  assertNoSecretShapedValue(rawUrl, label);

  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error(`${label} is not a valid URL.`);
  }

  const localHosts = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);
  invariant(url.protocol === "https:", `${label} must use https.`);
  invariant(!localHosts.has(url.hostname), `${label} must not be local.`);
  invariant(!url.username && !url.password, `${label} must not include embedded credentials.`);
  url.pathname = "";
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/u, "");
}

function validateLaunchBundle(bundle, bundlePath, config) {
  invariant(bundle.status === "admin_launch_readiness_bundle_prepared", "launch bundle status is not prepared.");
  invariant(bundle.public_self_serve_launch_allowed === false, "launch bundle must keep public self-serve blocked.");
  invariant(bundle.customer_observed_completion_claimed === true, "launch bundle must claim customer-observed completion.");
  invariant(bundle.artifacts?.bundle_path === bundlePath, "launch bundle artifact path must match OUTPOST_ADMIN_LAUNCH_READINESS_BUNDLE_PATH.");
  const appOrigin = normalizePreviewOrigin(bundle.preview_url, "launch bundle Preview URL");
  invariant(appOrigin === normalizePreviewOrigin(process.env.NEXT_PUBLIC_OUTPOST_APP_URL ?? appOrigin, "configured app origin"), "launch bundle Preview URL must match NEXT_PUBLIC_OUTPOST_APP_URL when set.");
  invariant(bundle.neon_proof_branch === config.branchName, "launch bundle Neon proof branch must match OUTPOST_NEON_BRANCH_NAME.");

  for (const gate of [
    "Protected Preview proof",
    "Operator fulfillment path",
    "Reset and rollback readiness",
    "Customer-observed handoff"
  ]) {
    assertIncludes(bundle.ready_gates, gate, "launch bundle ready gates");
  }

  for (const gate of [
    "Live-provider and billing gates",
    "Public self-serve launch",
    "Invite delivery",
    "Member-ledger writes"
  ]) {
    assertIncludes(bundle.blocked_gates, gate, "launch bundle blocked gates");
  }

  for (const nonGoal of [
    "public_self_signup",
    "invite_delivery",
    "phone_provider_activation",
    "email_provider_activation",
    "billing",
    "pos",
    "access_control",
    "member_ledger_writes"
  ]) {
    assertIncludes(bundle.non_goals, nonGoal, "launch bundle non-goals");
  }

  return appOrigin;
}

function validateOwnerMessage(message) {
  invariant(message.includes("Invite delivery: blocked"), "owner handoff message must keep invite delivery blocked.");
  invariant(message.includes("Customer-observed completion: pending"), "owner handoff message must not claim completion.");
  invariant(message.includes("Next step"), "owner handoff message must include a next step.");
}

function sqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function runCommand(args, label) {
  const result = spawnSync(args[0], args.slice(1), {
    cwd: process.cwd(),
    encoding: "utf8",
    env: process.env
  });

  if (result.status !== 0) {
    throw new Error(`${label} failed.\n${[result.stdout, result.stderr].filter(Boolean).join("\n")}`);
  }

  return result.stdout;
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
      ROLE_NAME,
      "--psql",
      "--",
      ...args
    ])],
    "Neon admin launch package record"
  );
}

function runPsqlScript(config, sql) {
  const tempDir = mkdtempSync(join(tmpdir(), "outpost-admin-launch-package-"));
  const scriptPath = join(tempDir, "record.sql");

  try {
    writeFileSync(scriptPath, sql);
    return runNeonPsql(config, ["-v", "ON_ERROR_STOP=1", "-f", scriptPath]);
  } finally {
    rmSync(tempDir, { force: true, recursive: true });
  }
}

function recordLaunchPackage(config, record) {
  runPsqlScript(
    config,
    `
      insert into admin_launch_package_records (
        id,
        status,
        app_origin,
        neon_branch_name,
        gym_name,
        owner_label,
        launch_bundle_sha256,
        owner_message_sha256,
        launch_bundle_path,
        owner_message_path,
        customer_handoff_recorded,
        public_self_serve_launch_allowed,
        summary
      )
      values (
        ${sqlLiteral(record.id)},
        'admin_launch_package_recorded',
        ${sqlLiteral(record.appOrigin)},
        ${sqlLiteral(record.neonBranchName)},
        ${sqlLiteral(record.gymName)},
        ${sqlLiteral(record.ownerLabel)},
        ${sqlLiteral(record.launchBundleSha256)},
        ${sqlLiteral(record.ownerMessageSha256)},
        ${sqlLiteral(record.launchBundlePath)},
        ${sqlLiteral(record.ownerMessagePath)},
        ${record.customerHandoffRecorded ? "true" : "false"},
        false,
        ${sqlLiteral(JSON.stringify(record.summary))}::jsonb
      )
      on conflict (id) do nothing;
    `
  );
}

function main() {
  const config = readHostedReadinessConfig();
  invariant(config.branchName !== "production", "Refusing admin launch package import against the Neon production branch.");

  const launchBundlePath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_LAUNCH_READINESS_BUNDLE_PATH,
    "OUTPOST_ADMIN_LAUNCH_READINESS_BUNDLE_PATH"
  );
  const ownerMessagePath = normalizeArtifactPath(
    process.env.OUTPOST_BETA_HANDOFF_MESSAGE_PATH,
    "OUTPOST_BETA_HANDOFF_MESSAGE_PATH"
  );
  const { parsed: launchBundle, sha256: launchBundleSha256 } = readJsonArtifact(
    launchBundlePath,
    "admin launch readiness bundle"
  );
  const { source: ownerMessage, sha256: ownerMessageSha256 } = readTextArtifact(
    ownerMessagePath,
    "beta owner handoff message"
  );
  const appOrigin = validateLaunchBundle(launchBundle, launchBundlePath, config);
  validateOwnerMessage(ownerMessage);

  const record = {
    appOrigin,
    customerHandoffRecorded: launchBundle.customer_observed_completion_claimed === true,
    gymName: String(launchBundle.gym ?? "Unknown gym"),
    id: `admin_launch_package_${launchBundleSha256.slice(0, 16)}_${ownerMessageSha256.slice(0, 16)}`,
    launchBundlePath,
    launchBundleSha256,
    neonBranchName: config.branchName,
    ownerLabel: String(launchBundle.owner_email ?? "unknown-owner"),
    ownerMessagePath,
    ownerMessageSha256,
    summary: {
      blocked_gates: launchBundle.blocked_gates,
      command_sequence: launchBundle.command_sequence,
      launch_bundle_status: launchBundle.status,
      non_goals: launchBundle.non_goals,
      owner_message: "prepared",
      public_self_serve_launch_allowed: false
    }
  };

  assertNoSecretShapedValue(JSON.stringify(record), "admin launch package record");
  recordLaunchPackage(config, record);

  console.log("Admin launch package record imported.");
  console.log(`Preview: ${record.appOrigin}`);
  console.log(`Neon branch: ${record.neonBranchName}`);
  console.log(`Gym: ${record.gymName}`);
  console.log(`Launch bundle sha256: ${record.launchBundleSha256}`);
  console.log(`Owner message sha256: ${record.ownerMessageSha256}`);
  console.log("Public self-serve launch: blocked");
  console.log("Live-provider and billing gates: blocked");
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
