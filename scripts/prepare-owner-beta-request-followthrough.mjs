#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
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
      normalizedKey.includes("secret") ||
      normalizedKey.includes("apikey") ||
      normalizedKey.includes("authorization") ||
      normalizedKey.includes("credential") ||
      normalizedKey.includes("privatekey") ||
      normalizedKey.includes("jwt") ||
      normalizedKey.includes("signature") ||
      normalizedKey.includes("bypass");

    invariant(!secretKey, `${label} contains secret-shaped key ${path}.`);
    assertNoSecretShapedKeys(nestedValue, label, [...trail, key]);
  }
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function normalizePreviewOrigin(value, label) {
  const origin = value?.trim().replace(/\/+$/u, "");
  invariant(origin, `${label} required.`);
  assertNoSecretShapedValue(origin, label);
  invariant(/^https:\/\/[^/]+\.vercel\.app$/iu.test(origin), `${label} must be a protected HTTPS Vercel Preview URL.`);
  return origin;
}

function normalizeArtifactPath(value, label) {
  invariant(value?.trim(), `${label} required.`);
  assertNoSecretShapedValue(value, label);
  const artifactPath = isAbsolute(value) ? value : resolve(process.cwd(), value);
  const repoRelativePath = relative(process.cwd(), artifactPath);
  const isInsideRepo = repoRelativePath && !repoRelativePath.startsWith("..") && !isAbsolute(repoRelativePath);
  const isIgnoredArtifactPath = repoRelativePath === "artifacts" || repoRelativePath.startsWith(`artifacts${sep}`);
  invariant(!isInsideRepo || isIgnoredArtifactPath, `${label} must live under gitignored artifacts/ when repo-local.`);
  invariant(!existsSync(artifactPath), `${label} already exists at ${artifactPath}. Choose a fresh path.`);
  return artifactPath;
}

function sqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
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
    "Neon owner beta request follow-through query"
  );
}

function runPsqlJson(config, sql) {
  const tempDir = mkdtempSync(join(tmpdir(), "outpost-owner-beta-request-followthrough-"));
  const scriptPath = join(tempDir, "query.sql");
  try {
    writeFileSync(scriptPath, sql);
    const output = runNeonPsql(config, ["-t", "-A", "-v", "ON_ERROR_STOP=1", "-f", scriptPath]);
    const line = output
      .split(/\r?\n/u)
      .map((value) => value.trim())
      .filter((value) => value && !value.startsWith("INFO:") && value.startsWith("{"))[0];
    invariant(line, "Neon owner beta request follow-through query returned no data.");
    assertNoSecretShapedValue(line, "Neon owner beta request follow-through query output");
    return JSON.parse(line);
  } finally {
    rmSync(tempDir, { force: true, recursive: true });
  }
}

function requestSelectorSql() {
  const requestId = process.env.OUTPOST_BETA_REQUEST_FOLLOWTHROUGH_REQUEST_ID?.trim();
  const ownerEmail = process.env.OUTPOST_BETA_REQUEST_FOLLOWTHROUGH_OWNER_EMAIL?.trim().toLowerCase();
  invariant(
    requestId || ownerEmail,
    "Set OUTPOST_BETA_REQUEST_FOLLOWTHROUGH_REQUEST_ID or OUTPOST_BETA_REQUEST_FOLLOWTHROUGH_OWNER_EMAIL."
  );
  assertNoSecretShapedValue(requestId ?? "", "OUTPOST_BETA_REQUEST_FOLLOWTHROUGH_REQUEST_ID");
  assertNoSecretShapedValue(ownerEmail ?? "", "OUTPOST_BETA_REQUEST_FOLLOWTHROUGH_OWNER_EMAIL");

  if (requestId) {
    return `requests.id = ${sqlLiteral(requestId)}`;
  }

  invariant(ownerEmail?.match(/^[^@\s]+@[^@\s]+\.[^@\s]+$/u), "OUTPOST_BETA_REQUEST_FOLLOWTHROUGH_OWNER_EMAIL must be an email.");
  return `lower(requests.email::text) = ${sqlLiteral(ownerEmail)}`;
}

function followThroughQuery({ appOrigin, branchName }) {
  const selector = requestSelectorSql();

  return `
with matching_request as (
  select
    requests.id,
    lower(requests.email::text) as owner_email,
    requests.owner_name,
    requests.gym_name,
    requests.location_hint,
    requests.status,
    requests.request_count,
    requests.created_at,
    requests.last_requested_at,
    exists (
      select 1
      from owner_beta_access_grants grants
      where lower(grants.email::text) = lower(requests.email::text)
        and grants.status = 'active'
    ) as grant_present
  from owner_beta_access_requests requests
  where ${selector}
  order by requests.last_requested_at desc, requests.id desc
  limit 1
),
latest_triage as (
  select receipts.*
  from owner_beta_access_request_triage_receipts receipts
  join matching_request requests on requests.id = receipts.request_id
  where receipts.app_origin = ${sqlLiteral(appOrigin)}
    and receipts.neon_branch_name = ${sqlLiteral(branchName)}
    and receipts.public_self_serve_launch_allowed = false
    and receipts.launch_enablement_allowed = false
    and receipts.status = 'owner_beta_request_triage_recorded'
  order by receipts.recorded_at desc, receipts.id desc
  limit 1
),
unexpected_provider_records as (
  select count(*)::int as count
  from provider_connections
  where status not in ('not_configured', 'disabled', 'pending_review')
    or secret_ref is not null
    or nullif(external_account_label, '') is not null
)
select jsonb_build_object(
  'request_present', exists (select 1 from matching_request),
  'triage_present', exists (select 1 from latest_triage),
  'unexpected_live_provider_records', (select count from unexpected_provider_records),
  'request', (select jsonb_build_object(
    'id', id,
    'owner_email', owner_email,
    'owner_name', owner_name,
    'gym_name', gym_name,
    'location_hint', location_hint,
    'status', status,
    'request_count', request_count,
    'created_at', created_at,
    'last_requested_at', last_requested_at,
    'grant_present', grant_present
  ) from matching_request),
  'triage_receipt', (select jsonb_build_object(
    'id', id,
    'decision', decision,
    'packet_path', packet_path,
    'packet_sha256', packet_sha256,
    'reviewer_label', reviewer_label,
    'review_note_present', review_note_present,
    'recorded_at', recorded_at
  ) from latest_triage)
)::text as result;
`;
}

function buildPacket({ appOrigin, config, queryResult }) {
  invariant(queryResult.request_present === true, "No matching owner beta request found.");
  invariant(queryResult.triage_present === true, "No reviewed owner beta request triage receipt found.");
  invariant(queryResult.unexpected_live_provider_records === 0, "Unexpected live provider records found.");
  invariant(queryResult.triage_receipt?.decision === "ready_for_operator_fulfillment", "Latest triage decision is not ready for operator fulfillment.");
  invariant(queryResult.triage_receipt?.packet_sha256?.match(/^[a-f0-9]{64}$/u), "Triage receipt packet digest missing.");

  return {
    status: "owner_beta_request_followthrough_prepared",
    packet_kind: "owner_beta_request_followthrough",
    generated_at: new Date().toISOString(),
    preview_url: appOrigin,
    neon_proof_branch: config.branchName,
    request: queryResult.request,
    triage_receipt: queryResult.triage_receipt,
    public_self_serve_launch_allowed: false,
    launch_enablement_allowed: false,
    requires_human_review: true,
    next_operator_commands: [
      "npm run beta:operator:request-preflight",
      "npm run beta:operator:request-fulfillment",
      "npm run hosted:request-fulfillment-proof",
      "npm run hosted:owner-handoff:prepare"
    ],
    followthrough_checklist: [
      "Confirm reviewer decision is ready_for_operator_fulfillment before provisioning access.",
      "Run owner access preflight and fulfillment only from terminal with rotated temporary password material outside the repo.",
      "Run disposable hosted request fulfillment proof after fulfillment.",
      "Prepare owner handoff artifacts before scheduling customer-observed session.",
      "Keep browser approval buttons, public self-signup, invite delivery, notifications, phone/email providers, billing, POS, access control, and member-ledger writes blocked."
    ],
    still_blocked: [
      "public owner self-signup",
      "browser approval or fulfillment buttons",
      "invite delivery or notification sending",
      "phone or email provider activation",
      "billing, POS, access control, member-ledger writes"
    ]
  };
}

async function main() {
  const config = readHostedReadinessConfig();
  invariant(config.branchName !== "production", "Refusing request follow-through against Neon production branch.");
  invariant(config.branchName !== "outpost-neon-spike", "Refusing request follow-through against migration spike branch.");
  const appOrigin = normalizePreviewOrigin(
    process.env.OUTPOST_VERCEL_DEPLOYMENT_URL ?? process.env.NEXT_PUBLIC_OUTPOST_APP_URL,
    "OUTPOST_VERCEL_DEPLOYMENT_URL or NEXT_PUBLIC_OUTPOST_APP_URL"
  );
  const packetPath = normalizeArtifactPath(
    process.env.OUTPOST_BETA_REQUEST_FOLLOWTHROUGH_PATH,
    "OUTPOST_BETA_REQUEST_FOLLOWTHROUGH_PATH"
  );
  const queryResult = runPsqlJson(config, followThroughQuery({ appOrigin, branchName: config.branchName }));
  const packet = buildPacket({ appOrigin, config, queryResult });
  assertNoSecretShapedKeys(packet, "owner beta request follow-through packet");
  const serialized = `${JSON.stringify(packet, null, 2)}\n`;
  assertNoSecretShapedValue(serialized, "owner beta request follow-through packet");
  mkdirSync(dirname(packetPath), { recursive: true });
  writeFileSync(packetPath, serialized);
  console.log(`Owner beta request follow-through packet wrote ${packetPath}`);
  console.log(`Request: ${packet.request.id}`);
  console.log(`Owner: ${packet.request.owner_email}`);
  console.log(`Packet sha256: ${sha256(serialized)}`);
  console.log("Public self-serve launch: blocked");
  console.log("Live providers: blocked");
}

main();
