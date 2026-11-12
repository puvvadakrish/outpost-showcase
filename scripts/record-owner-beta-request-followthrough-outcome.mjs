#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative, resolve, sep } from "node:path";

import { readHostedReadinessConfig } from "./hosted-preview-readiness-config.mjs";
import { withNeonApiKey } from "./neon-cli-auth.mjs";

const ROLE_NAME = process.env.OUTPOST_NEON_ROLE_NAME ?? "neondb_owner";
const VALID_OUTCOMES = new Set([
  "operator_handoff_completed",
  "followup_required",
  "deferred_not_ready"
]);

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
    /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}(?:\.[A-Za-z0-9_-]{8,})?\b/u.test(
      text
    ) ||
    text.includes("__Secure-neon-auth") ||
    text.includes("outpost_neon_auth_session") ||
    /(?:password|token|cookie|api[_-]?key|authorization|credential|private[_-]?key|secret|bypass|signature|jwt)\s*[:=]/iu.test(
      text
    );

  invariant(!secretValue, `${label} contains secret-shaped value.`);
}

function assertNoSecretShapedKeys(value, label, trail = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      assertNoSecretShapedKeys(item, label, [...trail, String(index)])
    );
    return;
  }

  if (!value || typeof value !== "object") {
    assertNoSecretShapedValue(value ?? "", label);
    return;
  }

  Object.entries(value).forEach(([key, nestedValue]) => {
    invariant(
      !/(password|token|cookie|api[_-]?key|authorization|credential|private[_-]?key|secret|bypass|signature|jwt)/iu.test(
        key
      ),
      `${label} contains secret-shaped key ${[...trail, key].join(".")}.`
    );
    assertNoSecretShapedKeys(nestedValue, label, [...trail, key]);
  });
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function sha256Slice(value) {
  return sha256(value).slice(0, 12);
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
  const isInsideRepo =
    repoRelativePath.length > 0 &&
    !repoRelativePath.startsWith("..") &&
    !isAbsolute(repoRelativePath);
  const isIgnoredArtifactPath =
    repoRelativePath === "artifacts" ||
    repoRelativePath.startsWith(`artifacts${sep}`);

  invariant(
    !isInsideRepo || isIgnoredArtifactPath,
    `${label} must live under gitignored artifacts/ when repo-local.`
  );
  invariant(existsSync(artifactPath), `${label} was not found at ${artifactPath}.`);
  return artifactPath;
}

function normalizePreviewOrigin(value, label) {
  invariant(value, `${label} required.`);
  assertNoSecretShapedValue(value, label);
  const url = new URL(value.startsWith("http") ? value : `https://${value}`);
  invariant(url.protocol === "https:", `${label} must use https.`);
  invariant(
    url.hostname.endsWith(".vercel.app"),
    `${label} must be a protected Vercel Preview URL.`
  );
  invariant(!url.username && !url.password, `${label} must not include embedded credentials.`);
  return url.origin;
}

function requireSafeString(value, label) {
  invariant(value, `${label} required.`);
  const trimmed = value.trim();
  assertNoSecretShapedValue(trimmed, label);
  invariant(trimmed.length > 0, `${label} cannot be empty.`);
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
    "Neon owner beta request follow-through outcome record"
  );
}

function runPsqlScript(config, sql) {
  const tempDir = mkdtempSync(
    join(tmpdir(), "outpost-owner-beta-request-followthrough-outcome-")
  );
  const scriptPath = join(tempDir, "record.sql");

  try {
    writeFileSync(scriptPath, sql);
    return runNeonPsql(config, [
      "-t",
      "-A",
      "-v",
      "ON_ERROR_STOP=1",
      "-f",
      scriptPath
    ]);
  } finally {
    rmSync(tempDir, { force: true, recursive: true });
  }
}

function readPacket(path) {
  const source = readFileSync(path, "utf8");
  assertNoSecretShapedValue(source, "owner beta request follow-through packet");
  const packet = JSON.parse(source);
  assertNoSecretShapedKeys(packet, "owner beta request follow-through packet");
  return { packet, packetSha256: sha256(source) };
}

function validatePacket(packet, config) {
  invariant(
    packet.status === "owner_beta_request_followthrough_prepared",
    "packet status is not prepared."
  );
  invariant(
    packet.packet_kind === "owner_beta_request_followthrough",
    "packet kind must be owner beta request follow-through."
  );
  const expectedPreviewOrigin = normalizePreviewOrigin(
    process.env.OUTPOST_VERCEL_DEPLOYMENT_URL ??
      process.env.NEXT_PUBLIC_OUTPOST_APP_URL,
    "OUTPOST_VERCEL_DEPLOYMENT_URL or NEXT_PUBLIC_OUTPOST_APP_URL"
  );
  invariant(
    normalizePreviewOrigin(packet.preview_url, "packet Preview URL") ===
      expectedPreviewOrigin,
    "packet Preview URL must match env."
  );
  invariant(
    packet.neon_proof_branch === config.branchName,
    "packet Neon proof branch must match OUTPOST_NEON_BRANCH_NAME."
  );
  invariant(
    packet.public_self_serve_launch_allowed === false,
    "packet must keep public self-serve blocked."
  );
  invariant(
    packet.launch_enablement_allowed === false,
    "packet must keep launch enablement blocked."
  );
  invariant(packet.requires_human_review === true, "packet must require human review.");
  invariant(packet.request?.id, "packet request id missing.");
  invariant(
    packet.request?.owner_email?.match(/^[^@\s]+@[^@\s]+\.[^@\s]+$/u),
    "packet owner email missing."
  );
  invariant(
    packet.triage_receipt?.decision === "ready_for_operator_fulfillment",
    "packet triage receipt is not ready for operator fulfillment."
  );
  invariant(packet.triage_receipt?.id, "packet triage receipt id missing.");
  invariant(
    packet.triage_receipt?.packet_sha256?.match(/^[a-f0-9]{64}$/u),
    "packet triage receipt packet digest missing."
  );
}

function insertOutcome(config, record) {
  const summary = JSON.stringify(record.summary);
  assertNoSecretShapedValue(
    summary,
    "owner beta request follow-through outcome summary"
  );
  const sql = `
with matching_request as (
  select requests.id, lower(requests.email::text) owner_email
  from owner_beta_access_requests requests
  where requests.id = ${sqlLiteral(record.requestId)}
    and lower(requests.email::text) = lower(${sqlLiteral(record.ownerEmail)})
    and requests.status in ('new', 'reviewing', 'approved')
  limit 1
),
latest_triage as (
  select receipts.id, receipts.packet_sha256
  from owner_beta_access_request_triage_receipts receipts
  join matching_request requests on requests.id = receipts.request_id
  where receipts.app_origin = ${sqlLiteral(record.appOrigin)}
    and receipts.neon_branch_name = ${sqlLiteral(record.neonBranchName)}
    and receipts.public_self_serve_launch_allowed = false
    and receipts.launch_enablement_allowed = false
    and receipts.status = 'owner_beta_request_triage_recorded'
  order by receipts.recorded_at desc, receipts.id desc
  limit 1
),
matching_triage as (
  select receipts.id
  from owner_beta_access_request_triage_receipts receipts
  join matching_request requests on requests.id = receipts.request_id
  join latest_triage latest on latest.id = receipts.id
  where receipts.app_origin = ${sqlLiteral(record.appOrigin)}
    and receipts.neon_branch_name = ${sqlLiteral(record.neonBranchName)}
    and receipts.id = ${sqlLiteral(record.triageReceiptId)}
    and receipts.packet_sha256 = ${sqlLiteral(record.triagePacketSha256)}
    and receipts.decision = 'ready_for_operator_fulfillment'
    and receipts.status = 'owner_beta_request_triage_recorded'
    and receipts.public_self_serve_launch_allowed = false
    and receipts.launch_enablement_allowed = false
  order by receipts.recorded_at desc, receipts.id desc
  limit 1
),
unexpected_live_provider_records as (
  select count(*)::integer total
  from provider_connections
  where status not in ('not_configured', 'disabled', 'pending_review')
    or secret_ref is not null
    or nullif(external_account_label, '') is not null
),
inserted as (
  insert into owner_beta_access_request_followthrough_outcomes (
    id,
    request_id,
    owner_email,
    app_origin,
    neon_branch_name,
    outcome,
    followthrough_packet_path,
    followthrough_packet_sha256,
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
    requests.id,
    requests.owner_email,
    ${sqlLiteral(record.appOrigin)},
    ${sqlLiteral(record.neonBranchName)},
    ${sqlLiteral(record.outcome)},
    ${sqlLiteral(record.packetPath)},
    ${sqlLiteral(record.packetSha256)},
    ${sqlLiteral(record.reviewerLabel)},
    'owner_beta_request_followthrough_outcome_recorded',
    false,
    false,
    ${record.reviewNotePresent ? "true" : "false"},
    ${sqlLiteral(summary)}::jsonb,
    ${sqlLiteral(record.recordedAt)}::timestamptz
  from matching_request requests
  where exists (select 1 from matching_triage)
    and (select total from unexpected_live_provider_records) = 0
  on conflict (id) do nothing
  returning id,
    request_id,
    lower(owner_email::text) owner_email,
    outcome,
    status,
    recorded_at,
    public_self_serve_launch_allowed,
    launch_enablement_allowed
)
select jsonb_build_object(
  'matching_request', exists(select 1 from matching_request),
  'matching_triage', exists(select 1 from matching_triage),
  'unexpected_live_provider_records', (select total from unexpected_live_provider_records),
  'inserted', exists(select 1 from inserted),
  'existing', exists(select 1 from owner_beta_access_request_followthrough_outcomes where id = ${sqlLiteral(record.id)}),
  'row', (select jsonb_build_object(
    'id', id,
    'request_id', request_id,
    'owner_email', owner_email,
    'outcome', outcome,
    'status', status,
    'recorded_at', recorded_at,
    'public_self_serve_launch_allowed', public_self_serve_launch_allowed,
    'launch_enablement_allowed', launch_enablement_allowed
  ) from inserted)
);
`;
  const output = runPsqlScript(config, sql);
  const line = output
    .split(/\r?\n/u)
    .map((value) => value.trim())
    .find((value) => value.startsWith("{"));

  invariant(
    line,
    "No owner beta request follow-through outcome record result returned."
  );
  assertNoSecretShapedValue(
    line,
    "owner beta request follow-through outcome record output"
  );
  return JSON.parse(line);
}

function main() {
  const config = readHostedReadinessConfig();
  invariant(
    config.branchName !== "production",
    "Refusing request follow-through outcome record against Neon production branch."
  );
  invariant(
    config.branchName !== "outpost-neon-spike",
    "Refusing request follow-through outcome record against migration spike branch."
  );

  const packetPath = normalizeArtifactPath(
    process.env.OUTPOST_BETA_REQUEST_FOLLOWTHROUGH_PATH,
    "OUTPOST_BETA_REQUEST_FOLLOWTHROUGH_PATH"
  );
  const { packet, packetSha256 } = readPacket(packetPath);
  validatePacket(packet, config);

  const outcome = requireSafeString(
    process.env.OUTPOST_BETA_REQUEST_FOLLOWTHROUGH_OUTCOME,
    "OUTPOST_BETA_REQUEST_FOLLOWTHROUGH_OUTCOME"
  );
  invariant(
    VALID_OUTCOMES.has(outcome),
    "OUTPOST_BETA_REQUEST_FOLLOWTHROUGH_OUTCOME must be operator_handoff_completed, followup_required, or deferred_not_ready."
  );

  const recordedAt =
    process.env.OUTPOST_BETA_REQUEST_FOLLOWTHROUGH_RECORDED_AT ??
    new Date().toISOString();
  invariant(
    !Number.isNaN(Date.parse(recordedAt)),
    "OUTPOST_BETA_REQUEST_FOLLOWTHROUGH_RECORDED_AT must be valid date."
  );
  const reviewerLabel = requireSafeString(
    process.env.OUTPOST_BETA_REQUEST_FOLLOWTHROUGH_REVIEWER_LABEL,
    "OUTPOST_BETA_REQUEST_FOLLOWTHROUGH_REVIEWER_LABEL"
  );
  const reviewNotePresent =
    process.env.OUTPOST_BETA_REQUEST_FOLLOWTHROUGH_REVIEW_NOTE_PRESENT === "true";
  const appOrigin = normalizePreviewOrigin(packet.preview_url, "packet Preview URL");
  const relativePacketPath = relative(process.cwd(), packetPath);
  const record = {
    appOrigin,
    id: `owner_beta_request_followthrough_${packetSha256.slice(0, 16)}_${sha256Slice(
      `${reviewerLabel}:${outcome}:${recordedAt}`
    )}`,
    neonBranchName: config.branchName,
    outcome,
    ownerEmail: packet.request.owner_email.toLowerCase(),
    packetPath: relativePacketPath,
    packetSha256,
    recordedAt,
    requestId: packet.request.id,
    reviewNotePresent,
    reviewerLabel,
    triagePacketSha256: packet.triage_receipt.packet_sha256,
    triageReceiptId: packet.triage_receipt.id,
    summary: {
      blocked_gates: [
        "Public self-serve launch",
        "Invite delivery",
        "Phone/email providers",
        "Notifications",
        "Billing, POS, access control, member-ledger writes"
      ],
      followthrough_packet_status: packet.status,
      launch_enablement_allowed: false,
      outcome,
      public_self_serve_launch_allowed: false,
      triage_decision: packet.triage_receipt.decision,
      triage_packet_sha256: packet.triage_receipt.packet_sha256,
      triage_receipt_id: packet.triage_receipt.id
    }
  };
  assertNoSecretShapedKeys(
    record,
    "owner beta request follow-through outcome record"
  );

  const result = insertOutcome(config, record);
  assertNoSecretShapedKeys(
    result,
    "owner beta request follow-through outcome result"
  );
  invariant(
    result.matching_request === true,
    "No active owner beta access request matched follow-through packet."
  );
  invariant(
    result.matching_triage === true,
    "No ready owner beta access triage receipt matched follow-through packet."
  );
  invariant(
    result.unexpected_live_provider_records === 0,
    "Unexpected live provider records present; refusing follow-through outcome record."
  );
  invariant(
    result.inserted === true || result.existing === true,
    "Owner beta request follow-through outcome was not recorded."
  );

  console.log(
    JSON.stringify(
      {
        result,
        status: "owner_beta_request_followthrough_outcome_recorded"
      },
      null,
      2
    )
  );
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
