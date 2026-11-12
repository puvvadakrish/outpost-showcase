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

function sqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function normalizePreviewOrigin(rawOrigin, label) {
  invariant(typeof rawOrigin === "string" && rawOrigin.trim().length > 0, `${label} required.`);
  assertNoSecretShapedValue(rawOrigin, label);
  const value = rawOrigin.trim().startsWith("http") ? rawOrigin.trim() : `https://${rawOrigin.trim()}`;
  const url = new URL(value);
  const localHosts = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);
  invariant(url.protocol === "https:", `${label} must use https.`);
  invariant(!localHosts.has(url.hostname), `${label} must not be local.`);
  invariant(url.hostname.endsWith(".vercel.app"), `${label} must target Vercel Preview URL.`);
  invariant(
    url.hostname !== "outpost-preview-20260610.vercel.app" && url.hostname !== "outpost.vercel.app",
    `${label} must not target production-like Vercel origin.`
  );
  invariant(!url.username && !url.password, `${label} must not include embedded credentials.`);
  return url.origin;
}

function normalizeArtifactPath(rawPath, label, { mustExist }) {
  invariant(rawPath?.trim(), `${label} required.`);
  invariant(!rawPath.includes("\0"), `${label} cannot contain null bytes.`);
  assertNoSecretShapedValue(rawPath, label);
  const artifactPath = rawPath.trim();
  const resolvedPath = resolve(artifactPath);
  const repoRelativePath = relative(process.cwd(), resolvedPath);
  const isInsideRepo = repoRelativePath.length > 0 && !repoRelativePath.startsWith("..") && !isAbsolute(repoRelativePath);
  const isIgnoredArtifactPath = repoRelativePath === "artifacts" || repoRelativePath.startsWith(`artifacts${sep}`);
  invariant(!isInsideRepo || isIgnoredArtifactPath, `${label} must live under gitignored artifacts/ when repo-local.`);

  if (mustExist) {
    invariant(existsSync(artifactPath), `${label} was not found at ${artifactPath}.`);
  } else {
    invariant(!existsSync(artifactPath), `${label} already exists at ${artifactPath}.`);
  }

  return artifactPath;
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
    "Neon owner beta request triage packet query"
  );
}

function runPsqlJson(config, sql) {
  const tempDir = mkdtempSync(join(tmpdir(), "outpost-owner-beta-request-triage-"));
  const scriptPath = join(tempDir, "query.sql");

  try {
    writeFileSync(scriptPath, sql);
    const output = runNeonPsql(config, ["-t", "-A", "-v", "ON_ERROR_STOP=1", "-f", scriptPath]);
    const line = output
      .split(/\r?\n/u)
      .map((value) => value.trim())
      .filter((value) => value && !value.startsWith("INFO:") && value.startsWith("{"))[0];
    invariant(line, "Neon owner beta request triage packet query returned no data.");
    assertNoSecretShapedValue(line, "Neon owner beta request triage packet query output");
    return JSON.parse(line);
  } finally {
    rmSync(tempDir, { force: true, recursive: true });
  }
}

function requestSelectorSql() {
  const requestId = process.env.OUTPOST_BETA_REQUEST_TRIAGE_REQUEST_ID?.trim();
  const ownerEmail = process.env.OUTPOST_BETA_REQUEST_TRIAGE_OWNER_EMAIL?.trim().toLowerCase();

  invariant(requestId || ownerEmail, "Set OUTPOST_BETA_REQUEST_TRIAGE_REQUEST_ID or OUTPOST_BETA_REQUEST_TRIAGE_OWNER_EMAIL.");
  assertNoSecretShapedValue(requestId ?? "", "OUTPOST_BETA_REQUEST_TRIAGE_REQUEST_ID");
  assertNoSecretShapedValue(ownerEmail ?? "", "OUTPOST_BETA_REQUEST_TRIAGE_OWNER_EMAIL");

  if (requestId) {
    return `requests.id = ${sqlLiteral(requestId)}`;
  }

  invariant(ownerEmail?.match(/^[^@\s]+@[^@\s]+\.[^@\s]+$/u), "OUTPOST_BETA_REQUEST_TRIAGE_OWNER_EMAIL must be an email.");
  return `lower(requests.email::text) = ${sqlLiteral(ownerEmail)}`;
}

function loadRequest(config, appOrigin) {
  return runPsqlJson(
    config,
    `
with selected_request as (
  select
    requests.id,
    lower(requests.email::text) as email,
    requests.owner_name,
    requests.gym_name,
    requests.location_hint,
    nullif(requests.note, '') is not null as note_present,
    requests.status::text as status,
    requests.request_count,
    requests.created_at,
    requests.updated_at,
    requests.last_requested_at,
    requests.fulfilled_at is not null as fulfilled,
    requests.fulfilled_grant_id is not null as grant_linked
  from owner_beta_access_requests requests
  where ${requestSelectorSql()}
  limit 1
),
unexpected_live_provider_records as (
  select count(*)::integer as total
  from provider_connections providers
  where providers.status = 'live'
     or coalesce(providers.provider_account_id, '') <> ''
     or coalesce(providers.external_location_id, '') <> ''
)
select jsonb_build_object(
  'found', exists(select 1 from selected_request),
  'app_origin', ${sqlLiteral(appOrigin)},
  'neon_branch_name', ${sqlLiteral(config.branchName)},
  'unexpected_live_provider_records', (select total from unexpected_live_provider_records),
  'request', coalesce((select to_jsonb(selected_request) from selected_request), 'null'::jsonb)
);
`
  );
}

function buildPacket({ appOrigin, config, request, unexpectedLiveProviderRecords }) {
  invariant(request, "No matching owner beta access request found.");
  invariant(unexpectedLiveProviderRecords === 0, "Hosted branch has unexpected live provider records.");

  return {
    status: "owner_beta_request_triage_packet_prepared",
    packet_kind: "owner_beta_request_triage",
    generated_at: new Date().toISOString(),
    preview_url: appOrigin,
    neon_proof_branch: config.branchName,
    request: {
      id: request.id,
      owner_email: request.email,
      owner_name: request.owner_name,
      gym_name: request.gym_name,
      location_hint: request.location_hint,
      note_present: request.note_present,
      status: request.status,
      request_count: request.request_count,
      created_at: request.created_at,
      last_requested_at: request.last_requested_at,
      fulfillment: {
        fulfilled: request.fulfilled,
        grant_linked: request.grant_linked
      }
    },
    public_self_serve_launch_allowed: false,
    launch_enablement_allowed: false,
    requires_human_review: true,
    completion_record_command: "npm run admin:beta-request:triage-record",
    triage_checklist: [
      "Confirm the request belongs to a real gym operator before separate fulfillment.",
      "Review owner, gym, location, note-present flag, hosted branch, and protected Preview URL.",
      "Do not approve in the browser, send invites, create Auth users, or expose temporary credentials.",
      "Record triage only with a customer-safe reviewer label and decision.",
      "Keep phone/email providers, notifications, billing, POS, access control, and member-ledger writes blocked."
    ],
    still_blocked: [
      "public owner self-signup",
      "browser approval buttons",
      "invite delivery or notification sending",
      "phone or email provider activation",
      "billing, POS, access control, member-ledger writes"
    ]
  };
}

function main() {
  const config = readHostedReadinessConfig();
  invariant(config.branchName !== "production", "Refusing request triage packet against Neon production branch.");
  invariant(config.branchName !== "outpost-neon-spike", "Refusing request triage packet against migration spike branch.");

  const appOrigin = normalizePreviewOrigin(
    process.env.OUTPOST_VERCEL_DEPLOYMENT_URL ?? process.env.NEXT_PUBLIC_OUTPOST_APP_URL,
    "OUTPOST_VERCEL_DEPLOYMENT_URL or NEXT_PUBLIC_OUTPOST_APP_URL"
  );
  const packetPath = normalizeArtifactPath(
    process.env.OUTPOST_BETA_REQUEST_TRIAGE_PACKET_PATH,
    "OUTPOST_BETA_REQUEST_TRIAGE_PACKET_PATH",
    { mustExist: false }
  );

  const result = loadRequest(config, appOrigin);
  const packet = buildPacket({
    appOrigin,
    config,
    request: result.request,
    unexpectedLiveProviderRecords: result.unexpected_live_provider_records
  });

  assertNoSecretShapedKeys(packet, "owner beta request triage packet");
  assertNoSecretShapedValue(JSON.stringify(packet), "owner beta request triage packet");
  mkdirSync(dirname(packetPath), { recursive: true });
  writeFileSync(packetPath, `${JSON.stringify(packet, null, 2)}\n`);

  console.log(`Owner beta request triage packet wrote ${packetPath}`);
  console.log(`Request: ${packet.request.id}`);
  console.log(`Owner: ${packet.request.owner_email}`);
  console.log(`Packet sha256: ${sha256(readFileSync(packetPath, "utf8"))}`);
  console.log("Public self-serve launch: blocked");
  console.log("Live providers: blocked");
}

main();
