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
  invariant(!secretValue, `${label} contains secret-shaped value.`);
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
    invariant(!secretKey, `${label} contains secret-shaped key at ${path}.`);
    assertNoSecretShapedKeys(nestedValue, label, [...trail, key]);
  }
}

function sha256(source) {
  return createHash("sha256").update(source).digest("hex");
}

function sha256Slice(value, length = 16) {
  return createHash("sha256").update(String(value)).digest("hex").slice(0, length);
}

function sqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function requireSafeString(value, label) {
  invariant(typeof value === "string" && value.trim().length > 0, `${label} is required.`);
  const trimmed = value.trim();
  assertNoSecretShapedValue(trimmed, label);
  return trimmed;
}

function normalizeArtifactPath(rawPath, label) {
  invariant(rawPath?.trim(), `${label} is required.`);
  invariant(!rawPath.includes("\0"), `${label} cannot contain null bytes.`);
  assertNoSecretShapedValue(rawPath, label);
  const artifactPath = rawPath.trim();
  const resolvedPath = resolve(artifactPath);
  const repoRelativePath = relative(process.cwd(), resolvedPath);
  const isInsideRepo = repoRelativePath.length > 0 && !repoRelativePath.startsWith("..") && !isAbsolute(repoRelativePath);
  const isIgnoredArtifactPath = repoRelativePath === "artifacts" || repoRelativePath.startsWith(`artifacts${sep}`);
  invariant(!isInsideRepo || isIgnoredArtifactPath, `${label} must live under gitignored artifacts/ when repo-local.`);
  invariant(existsSync(artifactPath), `${label} was not found at ${artifactPath}.`);
  return artifactPath;
}

function normalizePreviewOrigin(rawUrl, label) {
  invariant(typeof rawUrl === "string" && rawUrl.trim().length > 0, `${label} required.`);
  assertNoSecretShapedValue(rawUrl, label);
  const url = new URL(rawUrl.trim());
  invariant(url.protocol === "https:", `${label} must be an https URL.`);
  invariant(url.hostname.endsWith(".vercel.app"), `${label} must be a protected Vercel Preview URL.`);
  return url.origin;
}

function runCommand(command, label) {
  const result = spawnSync(command[0], command.slice(1), {
    cwd: process.cwd(),
    encoding: "utf8",
    env: process.env,
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
    [
      "neon",
      ...withNeonApiKey([
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
      ])
    ],
    "Neon operator self-serve rehearsal record"
  );
}

function runPsqlScript(config, sql) {
  const tempDir = mkdtempSync(join(tmpdir(), "outpost-operator-self-serve-rehearsal-"));
  const scriptPath = join(tempDir, "record.sql");
  try {
    writeFileSync(scriptPath, sql);
    return runNeonPsql(config, ["-t", "-A", "-v", "ON_ERROR_STOP=1", "-f", scriptPath]);
  } finally {
    rmSync(tempDir, { force: true, recursive: true });
  }
}

function readPacket(path) {
  const source = readFileSync(path, "utf8");
  assertNoSecretShapedValue(source, "operator self-serve rehearsal packet");
  const packet = JSON.parse(source);
  assertNoSecretShapedKeys(packet, "operator self-serve rehearsal packet");
  return { packet, packetSha256: sha256(source) };
}

function validatePacket(packet, config) {
  invariant(packet.status === "operator_self_serve_rehearsal_packet_prepared", "packet status is not prepared.");
  invariant(packet.packet_kind === "operator_assisted_self_serve_rehearsal", "packet kind must be operator-assisted rehearsal.");
  const expectedPreviewOrigin = normalizePreviewOrigin(
    process.env.OUTPOST_VERCEL_DEPLOYMENT_URL ?? process.env.NEXT_PUBLIC_OUTPOST_APP_URL,
    "OUTPOST_VERCEL_DEPLOYMENT_URL or NEXT_PUBLIC_OUTPOST_APP_URL"
  );
  invariant(normalizePreviewOrigin(packet.preview_url, "packet Preview URL") === expectedPreviewOrigin, "packet Preview URL must match env.");
  invariant(packet.neon_proof_branch === config.branchName, "packet Neon proof branch must match OUTPOST_NEON_BRANCH_NAME.");
  invariant(packet.public_self_serve_launch_allowed === false, "packet must keep public self-serve blocked.");
  invariant(packet.launch_enablement_allowed === false, "packet must keep launch enablement blocked.");
  invariant(packet.requires_human_review === true, "packet must require human review.");
  invariant(packet.followthrough_artifact_sha256?.match(/^[a-f0-9]{64}$/u), "packet follow-through artifact digest missing.");
  invariant(packet.launch_decision_record?.id, "packet launch decision record id missing.");
  invariant(packet.launch_decision_record?.decision_packet_sha256?.match(/^[a-f0-9]{64}$/u), "packet decision packet digest missing.");
  invariant(Array.isArray(packet.still_blocked) && packet.still_blocked.includes("public owner self-signup"), "packet must keep self-serve blocked.");
  invariant(Array.isArray(packet.operator_rehearsal_checklist) && packet.operator_rehearsal_checklist.length >= 3, "packet checklist is incomplete.");
}

function recordSql({ config, record }) {
  return `
with matching_decision as (
  select *
  from admin_launch_decision_records
  where id = ${sqlLiteral(record.launchDecisionRecordId)}
    and app_origin = ${sqlLiteral(record.appOrigin)}
    and neon_branch_name = ${sqlLiteral(config.branchName)}
    and decision = 'reviewed_for_next_launch_slice'
    and status = 'admin_launch_decision_recorded'
    and public_self_serve_launch_allowed = false
    and launch_enablement_allowed = false
  limit 1
),
inserted as (
  insert into operator_self_serve_rehearsal_records (
    id,
    status,
    app_origin,
    neon_branch_name,
    launch_decision_record_id,
    followthrough_artifact_sha256,
    rehearsal_packet_sha256,
    rehearsal_packet_path,
    operator_label,
    owner_label,
    gym_name,
    observed_at,
    public_self_serve_launch_allowed,
    launch_enablement_allowed,
    summary
  )
  select
    ${sqlLiteral(record.id)},
    'operator_self_serve_rehearsal_recorded',
    ${sqlLiteral(record.appOrigin)},
    ${sqlLiteral(config.branchName)},
    id,
    ${sqlLiteral(record.followthroughArtifactSha256)},
    ${sqlLiteral(record.rehearsalPacketSha256)},
    ${sqlLiteral(record.rehearsalPacketPath)},
    ${sqlLiteral(record.operatorLabel)},
    ${sqlLiteral(record.ownerLabel)},
    ${sqlLiteral(record.gymName)},
    ${sqlLiteral(record.observedAt)}::timestamptz,
    false,
    false,
    ${sqlLiteral(JSON.stringify(record.summary))}::jsonb
  from matching_decision
  on conflict (id) do nothing
  returning id
)
select jsonb_build_object(
  'matching_decision_present', exists (select 1 from matching_decision),
  'inserted_id', (select id from inserted),
  'existing_id', (
    select id
    from operator_self_serve_rehearsal_records
    where id = ${sqlLiteral(record.id)}
    limit 1
  )
)::text;
`;
}

function parsePsqlJson(output) {
  const line = output
    .split(/\r?\n/u)
    .map((value) => value.trim())
    .filter((value) => value && !value.startsWith("INFO:") && value.startsWith("{"))[0];
  invariant(line, "Neon operator rehearsal record query returned no data.");
  assertNoSecretShapedValue(line, "Neon operator rehearsal record query output");
  return JSON.parse(line);
}

function main() {
  const config = readHostedReadinessConfig();
  invariant(config.branchName !== "production", "Refusing operator rehearsal record against Neon production branch.");
  invariant(config.branchName !== "outpost-neon-spike", "Refusing operator rehearsal record against migration spike branch.");
  const packetPath = normalizeArtifactPath(
    process.env.OUTPOST_OPERATOR_SELF_SERVE_REHEARSAL_PACKET_PATH,
    "OUTPOST_OPERATOR_SELF_SERVE_REHEARSAL_PACKET_PATH"
  );
  const { packet, packetSha256 } = readPacket(packetPath);
  validatePacket(packet, config);
  const observedAt = process.env.OUTPOST_OPERATOR_SELF_SERVE_REHEARSAL_OBSERVED_AT ?? new Date().toISOString();
  invariant(!Number.isNaN(Date.parse(observedAt)), "OUTPOST_OPERATOR_SELF_SERVE_REHEARSAL_OBSERVED_AT must be a valid date when set.");
  const record = {
    id: `operator_self_serve_rehearsal_${packetSha256.slice(0, 16)}_${sha256Slice(`${process.env.OUTPOST_OPERATOR_SELF_SERVE_REHEARSAL_OPERATOR_LABEL}:${observedAt}`)}`,
    appOrigin: packet.preview_url,
    followthroughArtifactSha256: packet.followthrough_artifact_sha256,
    gymName: requireSafeString(process.env.OUTPOST_OPERATOR_SELF_SERVE_REHEARSAL_GYM_NAME, "OUTPOST_OPERATOR_SELF_SERVE_REHEARSAL_GYM_NAME"),
    launchDecisionRecordId: packet.launch_decision_record.id,
    observedAt,
    operatorLabel: requireSafeString(process.env.OUTPOST_OPERATOR_SELF_SERVE_REHEARSAL_OPERATOR_LABEL, "OUTPOST_OPERATOR_SELF_SERVE_REHEARSAL_OPERATOR_LABEL"),
    ownerLabel: requireSafeString(process.env.OUTPOST_OPERATOR_SELF_SERVE_REHEARSAL_OWNER_LABEL, "OUTPOST_OPERATOR_SELF_SERVE_REHEARSAL_OWNER_LABEL"),
    rehearsalPacketPath: packetPath,
    rehearsalPacketSha256: packetSha256,
    summary: {
      checklist_count: packet.operator_rehearsal_checklist.length,
      still_blocked: packet.still_blocked,
      completion_basis: "operator_observed_rehearsal_packet",
      public_self_serve_launch_allowed: false,
      launch_enablement_allowed: false
    }
  };
  assertNoSecretShapedKeys(record, "operator self-serve rehearsal record");
  assertNoSecretShapedValue(JSON.stringify(record), "operator self-serve rehearsal record");
  const result = parsePsqlJson(runPsqlScript(config, recordSql({ config, record })));
  invariant(result.matching_decision_present === true, "No matching reviewed launch decision record exists for packet.");
  invariant(result.inserted_id || result.existing_id, "Operator rehearsal record was not inserted or found.");
  console.log(`Operator-assisted self-serve rehearsal record imported: ${result.inserted_id ?? result.existing_id}`);
  console.log(`Preview: ${record.appOrigin}`);
  console.log(`Neon branch: ${config.branchName}`);
  console.log("Public self-serve launch: blocked");
  console.log("Live providers: blocked");
}

main();
