#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { readHostedReadinessConfig } from "./hosted-preview-readiness-config.mjs";
import { withNeonApiKey } from "./neon-cli-auth.mjs";

const ROLE_NAME = process.env.OUTPOST_NEON_ROLE_NAME ?? "neondb_owner";
const VALID_DECISIONS = new Set(["reviewed_for_next_launch_slice", "changes_requested", "deferred"]);

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

function readPacket(path) {
  const source = readFileSync(path, "utf8");
  assertNoSecretShapedValue(source, "admin launch decision packet");

  try {
    const parsed = JSON.parse(source);
    assertNoSecretShapedKeys(parsed, "admin launch decision packet");
    assertNoSecretShapedValue(JSON.stringify(parsed), "admin launch decision packet");
    return {
      parsed,
      sha256: createHash("sha256").update(source).digest("hex")
    };
  } catch (error) {
    throw new Error(`Admin launch decision packet must be valid JSON: ${error instanceof Error ? error.message : error}`);
  }
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
  invariant(url.hostname.endsWith(".vercel.app"), `${label} must be a Vercel Preview URL.`);
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

function runCommand(args, env, label) {
  const result = spawnSync(args[0], args.slice(1), {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      ...env
    }
  });
  const output = [result.stdout, result.stderr].filter(Boolean).join("\n");
  assertNoSecretShapedValue(output, label);

  if (result.status !== 0) {
    throw new Error(`${label} failed.\n${output}`);
  }

  return output;
}

function sqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function sha256Slice(value, length = 12) {
  return createHash("sha256").update(String(value)).digest("hex").slice(0, length);
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
    "Neon admin launch decision record"
  );
}

function runPsqlScript(config, sql) {
  const tempDir = mkdtempSync(join(tmpdir(), "outpost-admin-launch-decision-record-"));
  const scriptPath = join(tempDir, "record.sql");

  try {
    writeFileSync(scriptPath, sql);
    return runNeonPsql(config, ["-t", "-A", "-v", "ON_ERROR_STOP=1", "-f", scriptPath]);
  } finally {
    rmSync(tempDir, { force: true, recursive: true });
  }
}

function runPsqlJson(config, sql) {
  const output = runPsqlScript(config, sql);
  const line = output
    .split(/\r?\n/u)
    .map((value) => value.trim())
    .filter(Boolean)[0];

  invariant(line, "Neon admin launch decision record query returned no data.");
  assertNoSecretShapedValue(line, "Neon admin launch decision record query output");
  return JSON.parse(line);
}

function validatePacket(packet, packetPath, packetSha256, config) {
  invariant(packet.status === "admin_launch_decision_packet_prepared", "packet status is not prepared.");
  invariant(packet.packet_kind === "manual_launch_review_packet", "packet kind must be manual_launch_review_packet.");
  invariant(packet.public_self_serve_launch_allowed === false, "packet must keep public self-serve blocked.");
  invariant(packet.launch_enablement_allowed === false, "packet must keep launch enablement blocked.");
  invariant(packet.requires_human_review === true, "packet must require human review.");
  invariant(packet.launch_package_recorded === true, "packet must reference a recorded launch package.");
  invariant(packet.artifacts?.packet_path === packetPath, "packet artifact path must match OUTPOST_ADMIN_LAUNCH_DECISION_PACKET_PATH.");
  invariant(packet.neon_proof_branch === config.branchName, "packet Neon proof branch must match OUTPOST_NEON_BRANCH_NAME.");
  invariant(/^[a-f0-9]{64}$/u.test(packetSha256), "packet sha256 must be a hex digest.");
  invariant(/^[a-f0-9]{64}$/u.test(packet.launch_bundle_sha256), "packet launch bundle sha256 must be a hex digest.");
  normalizePreviewOrigin(packet.preview_url, "packet Preview URL");

  invariant(
    packet.launch_package_record?.public_self_serve_launch_allowed === false,
    "packet package row must keep public self-serve blocked."
  );
  invariant(packet.launch_package_record?.customer_handoff_recorded === true, "packet package row must record customer handoff.");

  for (const blocked of [
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
  ]) {
    assertIncludes(packet.blocked_gates, blocked, "packet blocked gates");
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
    assertIncludes(packet.non_goals, nonGoal, "packet non-goals");
  }
}

function packageRecordQuery({ appOrigin, branchName, id, launchBundleSha256 }) {
  return `
    select jsonb_build_object(
      'record_present', exists (
        select 1
        from admin_launch_package_records
        where id = ${sqlLiteral(id)}
          and app_origin = ${sqlLiteral(appOrigin)}
          and neon_branch_name = ${sqlLiteral(branchName)}
          and launch_bundle_sha256 = ${sqlLiteral(launchBundleSha256)}
          and status = 'admin_launch_package_recorded'
          and customer_handoff_recorded = true
          and public_self_serve_launch_allowed = false
      ),
      'public_self_serve_anomaly_count', (
        select count(*)
        from admin_launch_package_records
        where app_origin = ${sqlLiteral(appOrigin)}
          and neon_branch_name = ${sqlLiteral(branchName)}
          and public_self_serve_launch_allowed = true
      ),
      'unexpected_live_provider_records', (
        select count(*)
        from provider_connections
        where status not in ('not_configured', 'disabled', 'pending_review')
           or secret_ref is not null
           or external_account_label is not null
      )
    )::text;
  `;
}

function validateHostedPackageRecord(config, record) {
  const result = runPsqlJson(
    config,
    packageRecordQuery({
      appOrigin: record.appOrigin,
      branchName: record.neonBranchName,
      id: record.launchPackageRecordId,
      launchBundleSha256: record.launchBundleSha256
    })
  );

  invariant(
    result.record_present === true,
    "No matching hosted admin launch package record exists for this packet id, Preview, Neon branch, and launch bundle."
  );
  invariant(
    Number(result.public_self_serve_anomaly_count) === 0,
    "A launch package record unexpectedly allowed public self-serve for this Preview and branch."
  );
  invariant(
    Number(result.unexpected_live_provider_records) === 0,
    "Hosted provider records unexpectedly include live-provider configuration."
  );
}

function requiredInput(name, label) {
  const value = process.env[name]?.trim();
  invariant(value, `${name} is required.`);
  assertNoSecretShapedValue(value, label);
  return value;
}

function recordDecision(config, record) {
  const result = runPsqlJson(
    config,
    `
      with inserted as (
        insert into admin_launch_decision_records (
          id,
          status,
          decision,
          reviewer_label,
          review_note,
          app_origin,
          neon_branch_name,
          launch_package_record_id,
          launch_bundle_sha256,
          decision_packet_sha256,
          decision_packet_path,
          public_self_serve_launch_allowed,
          launch_enablement_allowed,
          summary
        )
        values (
          ${sqlLiteral(record.id)},
          'admin_launch_decision_recorded',
          ${sqlLiteral(record.decision)},
          ${sqlLiteral(record.reviewerLabel)},
          ${sqlLiteral(record.reviewNote)},
          ${sqlLiteral(record.appOrigin)},
          ${sqlLiteral(record.neonBranchName)},
          ${sqlLiteral(record.launchPackageRecordId)},
          ${sqlLiteral(record.launchBundleSha256)},
          ${sqlLiteral(record.decisionPacketSha256)},
          ${sqlLiteral(record.decisionPacketPath)},
          false,
          false,
          ${sqlLiteral(JSON.stringify(record.summary))}::jsonb
        )
        on conflict on constraint admin_launch_decision_records_unique_packet_review do nothing
        returning id
      ),
      existing as (
        select id
        from admin_launch_decision_records
        where decision_packet_sha256 = ${sqlLiteral(record.decisionPacketSha256)}
          and reviewer_label = ${sqlLiteral(record.reviewerLabel)}
          and decision = ${sqlLiteral(record.decision)}
        limit 1
      )
      select jsonb_build_object(
        'record_id', coalesce((select id from inserted), (select id from existing)),
        'inserted', exists (select 1 from inserted),
        'expected_id', ${sqlLiteral(record.id)}
      )::text;
    `
  );

  invariant(result.record_id, "Admin launch decision record insert returned no id.");
  invariant(result.record_id === record.id, "Admin launch decision record id did not match the reviewer-specific business key.");
  return result;
}

function main() {
  const config = readHostedReadinessConfig();
  invariant(config.branchName !== "production", "Refusing admin launch decision record against the Neon production branch.");
  invariant(config.branchName !== "outpost-neon-spike", "Refusing admin launch decision record against the migration spike branch.");

  const packetPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_LAUNCH_DECISION_PACKET_PATH,
    "OUTPOST_ADMIN_LAUNCH_DECISION_PACKET_PATH"
  );
  runCommand(
    ["node", "scripts/inspect-admin-launch-decision-packet.mjs"],
    { OUTPOST_ADMIN_LAUNCH_DECISION_PACKET_PATH: packetPath },
    "admin launch decision packet inspection"
  );

  const decision = requiredInput("OUTPOST_ADMIN_LAUNCH_DECISION", "admin launch decision");
  invariant(VALID_DECISIONS.has(decision), "OUTPOST_ADMIN_LAUNCH_DECISION must be reviewed_for_next_launch_slice, changes_requested, or deferred.");
  const reviewerLabel = requiredInput("OUTPOST_ADMIN_LAUNCH_DECISION_REVIEWER", "admin launch decision reviewer");
  const reviewNote = requiredInput("OUTPOST_ADMIN_LAUNCH_DECISION_NOTE", "admin launch decision note");
  invariant(reviewNote.length >= 12, "OUTPOST_ADMIN_LAUNCH_DECISION_NOTE must include a short non-secret review note.");

  const { parsed: packet, sha256: packetSha256 } = readPacket(packetPath);
  validatePacket(packet, packetPath, packetSha256, config);
  const appOrigin = normalizePreviewOrigin(packet.preview_url, "packet Preview URL");
  const reviewerDigest = sha256Slice(reviewerLabel);
  const recordId = `admin_launch_decision_${packetSha256.slice(0, 16)}_${decision}_${reviewerDigest}`;

  const record = {
    appOrigin,
    decision,
    decisionPacketPath: packetPath,
    decisionPacketSha256: packetSha256,
    id: recordId,
    launchBundleSha256: packet.launch_bundle_sha256,
    launchPackageRecordId: packet.launch_package_record.id,
    neonBranchName: config.branchName,
    reviewerLabel,
    reviewNote,
    summary: {
      blocked_gates: packet.blocked_gates,
      decision_boundary:
        "This record captures manual review only. It does not approve public self-serve, browser approval, invite delivery, providers, billing, POS, access control, or member-ledger writes.",
      launch_enablement_allowed: false,
      non_goals: packet.non_goals,
      packet_kind: packet.packet_kind,
      public_self_serve_launch_allowed: false,
      ready_evidence: packet.ready_evidence
    }
  };

  assertNoSecretShapedValue(JSON.stringify(record), "admin launch decision record");
  validateHostedPackageRecord(config, record);
  const recordResult = recordDecision(config, record);

  console.log(recordResult.inserted ? "Admin launch decision record imported." : "Admin launch decision record already existed.");
  console.log(`Preview: ${record.appOrigin}`);
  console.log(`Neon branch: ${record.neonBranchName}`);
  console.log(`Decision: ${record.decision}`);
  console.log(`Packet sha256: ${record.decisionPacketSha256}`);
  console.log("Public self-serve launch: blocked");
  console.log("Launch enablement: blocked");
  console.log("Live-provider and billing gates: blocked");
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
