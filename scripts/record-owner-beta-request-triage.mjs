#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { readHostedReadinessConfig } from "./hosted-preview-readiness-config.mjs";
import { withNeonApiKey } from "./neon-cli-auth.mjs";

const ROLE_NAME = process.env.OUTPOST_NEON_ROLE_NAME ?? "neondb_owner";
const VALID_DECISIONS = new Set(["ready_for_operator_fulfillment", "needs_followup", "not_a_fit"]);

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
      normalizedKey.includes("jwt");

    invariant(!secretKey, `${label} contains secret-shaped key ${path}.`);
    assertNoSecretShapedKeys(nestedValue, label, [...trail, key]);
  }
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function sha256Slice(value) {
  return sha256(value).slice(0, 16);
}

function sqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function normalizeArtifactPath(rawPath, label) {
  invariant(rawPath?.trim(), `${label} required.`);
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

function requireSafeString(value, label) {
  invariant(typeof value === "string" && value.trim().length > 0, `${label} required.`);
  const trimmed = value.trim();
  assertNoSecretShapedValue(trimmed, label);
  return trimmed;
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
    "Neon owner beta request triage record"
  );
}

function runPsqlScript(config, sql) {
  const tempDir = mkdtempSync(join(tmpdir(), "outpost-owner-beta-request-triage-record-"));
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
  assertNoSecretShapedValue(source, "owner beta request triage packet");
  const packet = JSON.parse(source);
  assertNoSecretShapedKeys(packet, "owner beta request triage packet");
  return { packet, packetSha256: sha256(source) };
}

function validatePacket(packet, packetPath, config) {
  invariant(packet.status === "owner_beta_request_triage_packet_prepared", "packet status is not prepared.");
  invariant(packet.packet_kind === "owner_beta_request_triage", "packet kind must be owner beta request triage.");
  const expectedPreviewOrigin = normalizePreviewOrigin(
    process.env.OUTPOST_VERCEL_DEPLOYMENT_URL ?? process.env.NEXT_PUBLIC_OUTPOST_APP_URL,
    "OUTPOST_VERCEL_DEPLOYMENT_URL or NEXT_PUBLIC_OUTPOST_APP_URL"
  );
  invariant(normalizePreviewOrigin(packet.preview_url, "packet Preview URL") === expectedPreviewOrigin, "packet Preview URL must match env.");
  invariant(packet.neon_proof_branch === config.branchName, "packet Neon proof branch must match OUTPOST_NEON_BRANCH_NAME.");
  invariant(packet.public_self_serve_launch_allowed === false, "packet must keep public self-serve blocked.");
  invariant(packet.launch_enablement_allowed === false, "packet must keep launch enablement blocked.");
  invariant(packet.requires_human_review === true, "packet must require human review.");
  invariant(packet.request?.id, "packet request id missing.");
  invariant(packet.request?.owner_email?.match(/^[^@\s]+@[^@\s]+\.[^@\s]+$/u), "packet owner email missing.");
  invariant(Array.isArray(packet.still_blocked) && packet.still_blocked.includes("public owner self-signup"), "packet must keep self-serve blocked.");
  invariant(packetPath.includes("artifacts") || isAbsolute(packetPath), "packet path must be explicit artifact path.");
}

function recordSql({ config, record }) {
  return `
with matching_request as (
  select *
  from owner_beta_access_requests
  where id = ${sqlLiteral(record.requestId)}
    and lower(email::text) = ${sqlLiteral(record.ownerEmail)}
),
unexpected_live_provider_records as (
  select count(*)::integer as total
  from provider_connections providers
  where providers.status = 'live'
     or coalesce(providers.provider_account_id, '') <> ''
     or coalesce(providers.external_location_id, '') <> ''
),
inserted as (
  insert into owner_beta_access_request_triage_receipts (
    id,
    request_id,
    owner_email,
    app_origin,
    neon_branch_name,
    decision,
    packet_path,
    packet_sha256,
    reviewer_label,
    status,
    public_self_serve_launch_allowed,
    launch_enablement_allowed,
    review_note_present,
    summary,
    recorded_at
  )
  select
    ${sqlLiteral(record.id)},
    ${sqlLiteral(record.requestId)},
    ${sqlLiteral(record.ownerEmail)}::citext,
    ${sqlLiteral(record.appOrigin)},
    ${sqlLiteral(config.branchName)},
    ${sqlLiteral(record.decision)},
    ${sqlLiteral(record.packetPath)},
    ${sqlLiteral(record.packetSha256)},
    ${sqlLiteral(record.reviewerLabel)},
    'owner_beta_request_triage_recorded',
    false,
    false,
    ${record.reviewNotePresent ? "true" : "false"},
    ${sqlLiteral(JSON.stringify(record.summary))}::jsonb,
    ${sqlLiteral(record.recordedAt)}::timestamptz
  from matching_request
  where (select total from unexpected_live_provider_records) = 0
  on conflict (id) do nothing
  returning id
)
select jsonb_build_object(
  'matching_request', exists(select 1 from matching_request),
  'unexpected_live_provider_records', (select total from unexpected_live_provider_records),
  'inserted', exists(select 1 from inserted),
  'existing', exists(select 1 from owner_beta_access_request_triage_receipts where id = ${sqlLiteral(record.id)})
);
`;
}

function parseRecordResult(output) {
  const line = output
    .split(/\r?\n/u)
    .map((value) => value.trim())
    .filter((value) => value && !value.startsWith("INFO:") && value.startsWith("{"))[0];
  invariant(line, "No owner beta request triage record result returned.");
  assertNoSecretShapedValue(line, "owner beta request triage record output");
  return JSON.parse(line);
}

function main() {
  const config = readHostedReadinessConfig();
  invariant(config.branchName !== "production", "Refusing request triage record against Neon production branch.");
  invariant(config.branchName !== "outpost-neon-spike", "Refusing request triage record against migration spike branch.");

  const packetPath = normalizeArtifactPath(
    process.env.OUTPOST_BETA_REQUEST_TRIAGE_PACKET_PATH,
    "OUTPOST_BETA_REQUEST_TRIAGE_PACKET_PATH"
  );
  const { packet, packetSha256 } = readPacket(packetPath);
  validatePacket(packet, packetPath, config);

  const decision = requireSafeString(process.env.OUTPOST_BETA_REQUEST_TRIAGE_DECISION, "OUTPOST_BETA_REQUEST_TRIAGE_DECISION");
  invariant(VALID_DECISIONS.has(decision), "OUTPOST_BETA_REQUEST_TRIAGE_DECISION must be ready_for_operator_fulfillment, needs_followup, or not_a_fit.");

  const recordedAt = process.env.OUTPOST_BETA_REQUEST_TRIAGE_RECORDED_AT ?? new Date().toISOString();
  invariant(!Number.isNaN(Date.parse(recordedAt)), "OUTPOST_BETA_REQUEST_TRIAGE_RECORDED_AT must be a valid date when set.");

  const reviewerLabel = requireSafeString(process.env.OUTPOST_BETA_REQUEST_TRIAGE_REVIEWER_LABEL, "OUTPOST_BETA_REQUEST_TRIAGE_REVIEWER_LABEL");
  const reviewNotePresent = process.env.OUTPOST_BETA_REQUEST_TRIAGE_REVIEW_NOTE_PRESENT === "true";
  const record = {
    id: `owner_beta_request_triage_${packetSha256.slice(0, 16)}_${sha256Slice(`${reviewerLabel}:${decision}:${recordedAt}`)}`,
    appOrigin: normalizePreviewOrigin(packet.preview_url, "packet Preview URL"),
    decision,
    ownerEmail: packet.request.owner_email.toLowerCase(),
    packetPath,
    packetSha256,
    recordedAt,
    requestId: packet.request.id,
    reviewerLabel,
    reviewNotePresent,
    summary: {
      request_status: packet.request.status,
      request_count: packet.request.request_count,
      note_present: packet.request.note_present,
      public_self_serve_launch_allowed: false,
      launch_enablement_allowed: false
    }
  };

  assertNoSecretShapedKeys(record, "owner beta request triage record");
  assertNoSecretShapedValue(JSON.stringify(record), "owner beta request triage record");
  const result = parseRecordResult(runPsqlScript(config, recordSql({ config, record })));

  invariant(result.matching_request === true, "No matching owner beta access request exists for packet.");
  invariant(result.unexpected_live_provider_records === 0, "Hosted branch has unexpected live provider records.");
  invariant(result.inserted === true || result.existing === true, "Owner beta request triage record was not inserted.");

  console.log(`Owner beta request triage record ${result.inserted ? "inserted" : "already existed"}: ${record.id}`);
  console.log(`Request: ${record.requestId}`);
  console.log(`Decision: ${record.decision}`);
  console.log("Public self-serve launch: blocked");
  console.log("Live providers: blocked");
}

main();
