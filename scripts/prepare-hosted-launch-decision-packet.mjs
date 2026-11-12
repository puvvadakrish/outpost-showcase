#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
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

function normalizeArtifactPath(rawPath, label, { mustExist }) {
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
  invariant(!mustExist || existsSync(artifactPath), `${label} was not found at ${artifactPath}.`);
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

function assertIncludes(values, expected, label) {
  invariant(Array.isArray(values), `${label} must be an array.`);
  invariant(values.includes(expected), `${label} must include ${expected}.`);
}

function normalizePreviewOrigin(rawOrigin, label) {
  invariant(rawOrigin?.trim(), `${label} is required.`);
  assertNoSecretShapedValue(rawOrigin, label);

  const value = rawOrigin.trim().startsWith("http") ? rawOrigin.trim() : `https://${rawOrigin.trim()}`;
  let url;

  try {
    url = new URL(value);
  } catch {
    throw new Error(`${label} must be a valid URL.`);
  }

  const localHosts = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);
  invariant(url.protocol === "https:", `${label} must use https.`);
  invariant(!localHosts.has(url.hostname), `${label} must not be local.`);
  invariant(url.hostname.endsWith(".vercel.app"), `${label} must target a Vercel Preview URL.`);
  invariant(
    url.hostname !== "outpost-preview-20260610.vercel.app" && url.hostname !== "outpost.vercel.app",
    `${label} must not target a production-like Vercel origin.`
  );
  invariant(!url.username && !url.password, `${label} must not include embedded credentials.`);
  url.pathname = "";
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/u, "");
}

function sqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function runCommand(command, env, label) {
  const result = spawnSync(command[0], command.slice(1), {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      ...env
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  const output = [result.stdout, result.stderr].filter(Boolean).join("\n");
  assertNoSecretShapedValue(output, label);

  if (result.status !== 0) {
    throw new Error(`${label} failed.\n${output}`);
  }

  return output.trim();
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
    {},
    "Neon hosted launch decision packet query"
  );
}

function runPsqlJson(config, sql) {
  const tempDir = mkdtempSync(join(tmpdir(), "outpost-hosted-launch-decision-"));
  const scriptPath = join(tempDir, "query.sql");

  try {
    writeFileSync(scriptPath, sql);
    const output = runNeonPsql(config, ["-t", "-A", "-v", "ON_ERROR_STOP=1", "-f", scriptPath]);
    const line = output
      .split(/\r?\n/u)
      .map((value) => value.trim())
      .filter((value) => value && !value.startsWith("INFO:"))[0];
    invariant(line, "Neon hosted launch decision packet query returned no data.");
    assertNoSecretShapedValue(line, "Neon hosted launch decision packet query output");
    return JSON.parse(line);
  } finally {
    rmSync(tempDir, { force: true, recursive: true });
  }
}

function validateBundle(bundle, bundlePath, launchBundleSha256, appOrigin, config) {
  invariant(bundle.status === "admin_launch_readiness_bundle_prepared", "launch bundle status is not prepared.");
  invariant(bundle.artifacts?.bundle_path === bundlePath, "launch bundle path does not match the configured bundle path.");
  invariant(bundle.public_self_serve_launch_allowed === false, "launch bundle must keep public self-serve blocked.");
  invariant(bundle.customer_observed_completion_claimed === true, "launch bundle must claim customer-observed completion.");
  invariant(normalizePreviewOrigin(bundle.preview_url, "launch bundle Preview URL") === appOrigin, "launch bundle Preview URL must match the configured Preview URL.");
  invariant(bundle.neon_proof_branch === config.branchName, "launch bundle Neon proof branch must match OUTPOST_NEON_BRANCH_NAME.");
  invariant(/^[a-f0-9]{64}$/u.test(launchBundleSha256), "launch bundle sha256 must be a hex digest.");

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
    "browser_approval_buttons",
    "invite_delivery",
    "notification_sending",
    "phone_provider_activation",
    "email_provider_activation",
    "billing",
    "pos",
    "access_control",
    "member_ledger_writes"
  ]) {
    assertIncludes(bundle.non_goals, nonGoal, "launch bundle non-goals");
  }
}

function packageRecordQuery({ appOrigin, branchName, launchBundleSha256 }) {
  return `
    with matching_launch_package as (
      select *
      from admin_launch_package_records
      where app_origin = ${sqlLiteral(appOrigin)}
        and neon_branch_name = ${sqlLiteral(branchName)}
        and launch_bundle_sha256 = ${sqlLiteral(launchBundleSha256)}
        and status = 'admin_launch_package_recorded'
        and customer_handoff_recorded = true
        and public_self_serve_launch_allowed = false
      order by recorded_at desc, id desc
      limit 1
    )
    select jsonb_build_object(
      'record_present', exists (select 1 from matching_launch_package),
      'record', (
        select jsonb_build_object(
          'id', id,
          'recorded_at', recorded_at,
          'gym_name', gym_name,
          'owner_label', owner_label,
          'owner_message_sha256', owner_message_sha256,
          'launch_bundle_path', launch_bundle_path,
          'public_self_serve_launch_allowed', public_self_serve_launch_allowed,
          'customer_handoff_recorded', customer_handoff_recorded
        )
        from matching_launch_package
      ),
      'public_self_serve_anomaly_count', (
        select count(*)
        from admin_launch_package_records
        where app_origin = ${sqlLiteral(appOrigin)}
          and neon_branch_name = ${sqlLiteral(branchName)}
          and public_self_serve_launch_allowed = true
      )
    )::text;
  `;
}

function buildPacket({ appOrigin, bundle, bundlePath, config, launchBundleSha256, packageRecord, packetPath }) {
  const packet = {
    status: "admin_launch_decision_packet_prepared",
    packet_kind: "manual_launch_review_packet",
    generated_at: new Date().toISOString(),
    preview_url: appOrigin,
    neon_proof_branch: config.branchName,
    public_self_serve_launch_allowed: false,
    launch_enablement_allowed: false,
    requires_human_review: true,
    launch_package_recorded: true,
    launch_bundle_sha256: launchBundleSha256,
    artifacts: {
      packet_path: packetPath,
      launch_bundle_path: bundlePath,
      export_path: bundle.artifacts.export_path,
      promotion_path: bundle.artifacts.promotion_path,
      release_note_path: bundle.artifacts.release_note_path
    },
    launch_package_record: {
      id: packageRecord.id,
      recorded_at: packageRecord.recorded_at,
      gym_name: packageRecord.gym_name,
      owner_label: packageRecord.owner_label,
      owner_message_sha256: packageRecord.owner_message_sha256,
      customer_handoff_recorded: packageRecord.customer_handoff_recorded,
      public_self_serve_launch_allowed: packageRecord.public_self_serve_launch_allowed
    },
    ready_evidence: [
      "Protected Preview proof",
      "Admin portal proof",
      "Customer-observed handoff",
      "Operator fulfillment path",
      "Reset and rollback readiness",
      "Launch package record"
    ],
    blocked_gates: [
      "Public self-serve launch",
      "Browser approval buttons",
      "Invite delivery",
      "Notification sending",
      "Phone provider activation",
      "Email provider activation",
      "Billing",
      "POS",
      "Access control",
      "Member-ledger writes"
    ],
    non_goals: [
      "public_self_signup",
      "browser_approval_buttons",
      "invite_delivery",
      "notification_sending",
      "phone_provider_activation",
      "email_provider_activation",
      "billing",
      "pos",
      "access_control",
      "member_ledger_writes"
    ],
    review_boundary:
      "This packet is a manual review artifact only. It does not approve launch, enable public self-serve, send invites, activate providers, or mutate member systems.",
    next_step:
      "Attach this packet to human launch review. Any future launch-enabling slice must be separately planned, reviewed, and proven."
  };

  assertNoSecretShapedKeys(packet, "admin launch decision packet");
  assertNoSecretShapedValue(JSON.stringify(packet), "admin launch decision packet");
  return packet;
}

function main() {
  const config = readHostedReadinessConfig();
  invariant(config.branchName !== "production", "Refusing launch decision packet against the Neon production branch.");
  invariant(config.branchName !== "outpost-neon-spike", "Refusing launch decision packet against the migration spike branch.");

  const bundlePath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_LAUNCH_READINESS_BUNDLE_PATH,
    "OUTPOST_ADMIN_LAUNCH_READINESS_BUNDLE_PATH",
    { mustExist: true }
  );
  const packetPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_LAUNCH_DECISION_PACKET_PATH,
    "OUTPOST_ADMIN_LAUNCH_DECISION_PACKET_PATH",
    { mustExist: false }
  );
  const appOrigin = normalizePreviewOrigin(
    process.env.OUTPOST_VERCEL_DEPLOYMENT_URL ?? process.env.NEXT_PUBLIC_OUTPOST_APP_URL,
    "OUTPOST_VERCEL_DEPLOYMENT_URL or NEXT_PUBLIC_OUTPOST_APP_URL"
  );

  runCommand(
    ["node", "scripts/inspect-admin-launch-readiness-bundle.mjs"],
    { OUTPOST_ADMIN_LAUNCH_READINESS_BUNDLE_PATH: bundlePath },
    "admin launch readiness bundle inspection"
  );

  const { parsed: bundle, sha256: launchBundleSha256 } = readJsonArtifact(bundlePath, "admin launch readiness bundle");
  validateBundle(bundle, bundlePath, launchBundleSha256, appOrigin, config);

  const packageRecordResult = runPsqlJson(
    config,
    packageRecordQuery({
      appOrigin,
      branchName: config.branchName,
      launchBundleSha256
    })
  );
  invariant(packageRecordResult.record_present === true, "No matching hosted admin launch package record exists for this Preview, Neon branch, and launch bundle.");
  invariant(
    Number(packageRecordResult.public_self_serve_anomaly_count) === 0,
    "A launch package record unexpectedly allowed public self-serve for this Preview and branch."
  );

  const packet = buildPacket({
    appOrigin,
    bundle,
    bundlePath,
    config,
    launchBundleSha256,
    packageRecord: packageRecordResult.record,
    packetPath
  });

  mkdirSync(dirname(packetPath), { recursive: true });
  writeFileSync(packetPath, `${JSON.stringify(packet, null, 2)}\n`);

  console.log(`Admin launch decision packet wrote ${packetPath}`);
  console.log(`Preview: ${packet.preview_url}`);
  console.log(`Neon branch: ${packet.neon_proof_branch}`);
  console.log(`Launch bundle sha256: ${packet.launch_bundle_sha256}`);
  console.log("Manual launch review: required");
  console.log("Public self-serve launch: blocked");
  console.log("Live-provider and billing gates: blocked");
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
