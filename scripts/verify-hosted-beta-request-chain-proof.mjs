#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { readHostedReadinessConfig } from "./hosted-preview-readiness-config.mjs";
import { withNeonApiKey } from "./neon-cli-auth.mjs";

const config = readHostedReadinessConfig();
const DATABASE_NAME = process.env.OUTPOST_NEON_DATABASE_NAME ?? config.databaseName ?? "neondb";
const ROLE_NAME = process.env.OUTPOST_NEON_ROLE_NAME ?? "neondb_owner";
const APP_ORIGIN = normalizeHostedAppOrigin(
  process.env.OUTPOST_VERCEL_DEPLOYMENT_URL ?? process.env.NEXT_PUBLIC_OUTPOST_APP_URL
);
const RUN_ID = `beta_request_chain_${Date.now().toString(36)}`;
const OWNER_EMAIL = normalizeEmail(
  process.env.OUTPOST_HOSTED_BETA_REQUEST_CHAIN_EMAIL ?? `${RUN_ID}@beta-proof.outpost.local`
);
const OWNER_NAME =
  process.env.OUTPOST_HOSTED_BETA_REQUEST_CHAIN_OWNER_NAME?.trim() || "Hosted Beta Request Chain Owner";
const GYM_NAME =
  process.env.OUTPOST_HOSTED_BETA_REQUEST_CHAIN_GYM_NAME?.trim() || `Hosted Beta Request Chain Gym ${RUN_ID}`;
const LOCATION_HINT =
  process.env.OUTPOST_HOSTED_BETA_REQUEST_CHAIN_LOCATION?.trim() || "Protected Preview request chain proof";
const OWNER_PASSWORD = requireEnv("OUTPOST_OWNER_BETA_PASSWORD");
const REVIEWER_LABEL =
  process.env.OUTPOST_HOSTED_BETA_REQUEST_CHAIN_REVIEWER?.trim() || "Outpost hosted proof";
const RETAIN_PROOF_DATA = process.env.OUTPOST_HOSTED_BETA_REQUEST_CHAIN_RETAIN === "1";
const ARTIFACT_DIR = join("artifacts", "admin-launch-readiness", RUN_ID);
const TRIAGE_PACKET_PATH = join(ARTIFACT_DIR, "owner-beta-request-triage.json");
const FOLLOWTHROUGH_PACKET_PATH = join(ARTIFACT_DIR, "owner-beta-request-followthrough.json");
const EVIDENCE_PATH =
  process.env.OUTPOST_BETA_REQUEST_CHAIN_EVIDENCE_PATH ??
  join(ARTIFACT_DIR, "owner-beta-request-chain-proof.json");

let cleanupArmed = false;
let proofRequestId = null;

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} required.`);
  }
  return value;
}

function invariant(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function normalizeEmail(email) {
  const normalized = email.trim().toLowerCase();
  invariant(/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(normalized), "Proof owner email must be valid.");
  assertNoSecretShapedValue(normalized, "proof owner email");
  return normalized;
}

function normalizeHostedAppOrigin(value) {
  invariant(value, "OUTPOST_VERCEL_DEPLOYMENT_URL or NEXT_PUBLIC_OUTPOST_APP_URL required.");
  assertNoSecretShapedValue(value, "hosted beta request chain app origin");
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Hosted beta request chain app origin must be a valid URL.");
  }
  invariant(url.protocol === "https:", "Hosted beta request chain proof must use an HTTPS Vercel Preview URL.");
  invariant(
    url.hostname.endsWith(".vercel.app"),
    "Hosted beta request chain proof must use a Vercel Preview URL."
  );
  invariant(
    url.hostname !== "outpost-preview-20260610.vercel.app" && url.hostname !== "outpost.vercel.app",
    "Hosted beta request chain proof must not target production-like Vercel origin."
  );
  invariant(!url.username && !url.password, "Hosted beta request chain app origin must not include credentials.");
  url.pathname = "";
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/u, "");
}

function assertNoSecretShapedValue(value, label) {
  const text = String(value);
  const secretValue =
    /\bBearer\s+[A-Za-z0-9._~+/=-]{12,}/u.test(text) ||
    /\bnapi_[A-Za-z0-9]{20,}\b/u.test(text) ||
    /\bpostgres(?:ql)?:\/\/[^:\s/@]+:[^@\s]+@/iu.test(text) ||
    /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}(?:\.[A-Za-z0-9_-]{8,})?\b/u.test(text) ||
    text.includes("__Secure-neon-auth") ||
    text.includes("outpost_neon_auth_session") ||
    /(?:password|token|cookie|api[_-]?key|authorization|credential|private[_-]?key|secret|bypass|signature|jwt)\s*[:=]/iu.test(
      text
    );

  invariant(!secretValue, `${label} contains secret-shaped value.`);
}

function assertProofSafety() {
  invariant(process.env.NEON_API_KEY, "NEON_API_KEY required hosted beta request chain proof.");
  invariant(config.branchName !== "production", "Refusing hosted beta request chain proof on Neon production.");
  invariant(
    config.branchName !== "outpost-neon-spike",
    "Refusing hosted beta request chain proof on Neon migration spike branch."
  );
  invariant(OWNER_PASSWORD.length >= 12, "OUTPOST_OWNER_BETA_PASSWORD must be at least 12 characters.");
  invariant(OWNER_PASSWORD !== "outpost-local-password", "Refusing reuse of local seed password.");
  invariant(OWNER_PASSWORD.toLowerCase() !== OWNER_EMAIL, "OUTPOST_OWNER_BETA_PASSWORD must not equal owner email.");
  invariant(
    OWNER_EMAIL.endsWith("@beta-proof.outpost.local"),
    "OUTPOST_HOSTED_BETA_REQUEST_CHAIN_EMAIL must use the disposable @beta-proof.outpost.local domain."
  );
  assertNoSecretShapedValue(REVIEWER_LABEL, "hosted beta request chain reviewer label");
}

function sqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function runCommand(command, label, env = process.env) {
  const result = spawnSync(command[0], command.slice(1), {
    cwd: process.cwd(),
    encoding: "utf8",
    env,
    stdio: ["ignore", "pipe", "pipe"]
  });
  const output = [result.stdout, result.stderr].filter(Boolean).join("\n");
  assertNoSecretShapedValue(output, label);

  if (result.status !== 0) {
    throw new Error(`${label} failed.\n${output}`);
  }

  return output.trim();
}

function runNpmScript(script, label, env = process.env) {
  return runCommand(["npm", "run", script], label, env);
}

function runNeonPsql(args) {
  return runCommand(
    [
      "neon",
      ...withNeonApiKey([
        "connection-string",
        config.branchName,
        "--project-id",
        config.projectId,
        "--database-name",
        DATABASE_NAME,
        "--role-name",
        ROLE_NAME,
        "--psql",
        "--",
        ...args
      ])
    ],
    "Neon psql hosted beta request chain proof"
  );
}

function runPsqlScript(sql) {
  const tempDir = mkdtempSync(join(tmpdir(), "outpost-hosted-beta-request-chain-"));
  const scriptPath = join(tempDir, "proof.sql");
  try {
    writeFileSync(scriptPath, sql);
    return runNeonPsql(["-t", "-A", "-q", "-v", "ON_ERROR_STOP=1", "-f", scriptPath]);
  } finally {
    rmSync(tempDir, { force: true, recursive: true });
  }
}

function parsePsqlJson(output, label) {
  const line = output
    .split(/\r?\n/u)
    .map((value) => value.trim())
    .find((value) => value && value.startsWith("{"));
  invariant(line, `${label} returned no JSON payload.`);
  assertNoSecretShapedValue(line, label);
  return JSON.parse(line);
}

async function authFetch(path, init = {}) {
  const response = await fetch(`${config.neonAuthUrl}${path}`, {
    ...init,
    headers: {
      Origin: APP_ORIGIN,
      ...(init.headers ?? {})
    }
  });
  const text = await response.text();
  let body = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { text };
    }
  }
  return { body, ok: response.ok, status: response.status };
}

async function getAnonymousJwt() {
  const response = await authFetch("/token/anonymous");
  if (!response.ok || !response.body?.token) {
    throw new Error(`Unable to fetch Neon Auth anonymous JWT: ${JSON.stringify(response.body)}`);
  }
  return response.body.token;
}

async function dataApiRpc(functionName, token, body) {
  const bearerToken = token ?? (await getAnonymousJwt());
  const response = await fetch(`${config.neonDataApiUrl}/rpc/${functionName}`, {
    body: JSON.stringify(body),
    headers: {
      Authorization: `Bearer ${bearerToken}`,
      "Content-Type": "application/json"
    },
    method: "POST"
  });
  const text = await response.text();
  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { text };
    }
  }
  if (!response.ok) {
    throw new Error(`Data API RPC ${functionName} failed: ${response.status} ${JSON.stringify(payload)}`);
  }
  return payload;
}

async function submitDisposableRequest() {
  const result = await dataApiRpc("submit_owner_beta_access_request", null, {
    p_company_website: "",
    p_gym_name: GYM_NAME,
    p_location_hint: LOCATION_HINT,
    p_note: "Disposable hosted beta request chain proof",
    p_owner_email: OWNER_EMAIL,
    p_owner_name: OWNER_NAME
  });

  if (result?.ok !== true || result?.status !== "received") {
    throw new Error(`Disposable request submit did not return generic received response: ${JSON.stringify(result)}`);
  }
}

function loadRequest() {
  return parsePsqlJson(
    runPsqlScript(`
      select jsonb_build_object(
        'id', requests.id,
        'email', lower(requests.email::text),
        'status', requests.status::text,
        'fulfilled', requests.fulfilled_at is not null,
        'grant_linked', requests.fulfilled_grant_id is not null
      )
      from owner_beta_access_requests requests
      where lower(requests.email::text) = lower(${sqlLiteral(OWNER_EMAIL)});
    `),
    "hosted beta request chain request lookup"
  );
}

function verifyChainRows(requestId) {
  return parsePsqlJson(
    runPsqlScript(`
      with request_row as (
        select *
        from owner_beta_access_requests
        where id = ${sqlLiteral(requestId)}
          and lower(email::text) = lower(${sqlLiteral(OWNER_EMAIL)})
      ),
      latest_triage as (
        select *
        from owner_beta_access_request_triage_receipts
        where request_id = ${sqlLiteral(requestId)}
          and app_origin = ${sqlLiteral(APP_ORIGIN)}
          and neon_branch_name = ${sqlLiteral(config.branchName)}
        order by recorded_at desc, id desc
        limit 1
      ),
      latest_outcome as (
        select *
        from owner_beta_access_request_followthrough_outcomes
        where request_id = ${sqlLiteral(requestId)}
          and app_origin = ${sqlLiteral(APP_ORIGIN)}
          and neon_branch_name = ${sqlLiteral(config.branchName)}
        order by recorded_at desc, id desc
        limit 1
      ),
      latest_fulfillment as (
        select *
        from owner_beta_access_fulfillment_receipts
        where request_id = ${sqlLiteral(requestId)}
        order by completed_at desc, id desc
        limit 1
      ),
      unexpected_live_provider_records as (
        select count(*)::int total
        from provider_connections
        where status not in ('not_configured', 'disabled', 'pending_review')
          or secret_ref is not null
          or nullif(external_account_label, '') is not null
      )
      select jsonb_build_object(
        'request_status', (select status::text from request_row),
        'request_fulfilled', (select fulfilled_at is not null from request_row),
        'grant_linked', (select fulfilled_grant_id is not null from request_row),
        'triage_ready', exists (
          select 1 from latest_triage
          where decision = 'ready_for_operator_fulfillment'
            and status = 'owner_beta_request_triage_recorded'
            and public_self_serve_launch_allowed = false
            and launch_enablement_allowed = false
        ),
        'outcome_recorded', exists (
          select 1 from latest_outcome outcome
          join latest_triage triage on true
          where outcome.outcome = 'operator_handoff_completed'
            and outcome.status = 'owner_beta_request_followthrough_outcome_recorded'
            and outcome.public_self_serve_launch_allowed = false
            and outcome.launch_enablement_allowed = false
            and outcome.summary->>'triage_receipt_id' = triage.id
            and outcome.summary->>'triage_packet_sha256' = triage.packet_sha256
        ),
        'fulfillment_recorded', exists (
          select 1 from latest_fulfillment
          where command_name = 'beta:operator:request-fulfillment'
            and status = 'recorded'
        ),
        'unexpected_live_provider_records', (select total from unexpected_live_provider_records)
      );
    `),
    "hosted beta request chain verification"
  );
}

function cleanupProofData() {
  if (!cleanupArmed) {
    return;
  }
  if (RETAIN_PROOF_DATA) {
    console.log("Disposable proof data retained because OUTPOST_HOSTED_BETA_REQUEST_CHAIN_RETAIN=1.");
    return;
  }

  invariant(proofRequestId, "Refusing cleanup without created disposable owner beta request id.");
  runPsqlScript(`
delete from owner_beta_access_request_followthrough_outcomes where request_id = ${sqlLiteral(proofRequestId)};
delete from owner_beta_access_request_triage_receipts where request_id = ${sqlLiteral(proofRequestId)};
delete from owner_beta_access_fulfillment_receipts where request_id = ${sqlLiteral(proofRequestId)};
delete from owner_beta_access_requests where id = ${sqlLiteral(proofRequestId)} and lower(email::text) = lower(${sqlLiteral(OWNER_EMAIL)});
delete from owner_beta_access_grants where lower(email::text) = lower(${sqlLiteral(OWNER_EMAIL)});
delete from users
where lower(email::text) = lower(${sqlLiteral(OWNER_EMAIL)})
  and not exists (select 1 from tenant_memberships where tenant_memberships.user_id = users.id);
delete from neon_auth."user" where lower(email) = lower(${sqlLiteral(OWNER_EMAIL)});
`);
}

async function main() {
  assertProofSafety();
  mkdirSync(ARTIFACT_DIR, { recursive: true });

  console.log("Outpost hosted beta request chain proof");
  console.log(`Project: ${config.projectId}`);
  console.log(`Branch: ${config.branchName}`);
  console.log(`Preview: ${APP_ORIGIN}`);
  console.log(`Disposable request: ${OWNER_EMAIL}`);
  console.log("Mode: request -> triage -> follow-through outcome -> fulfillment -> admin ledger verification\n");

  try {
  runNpmScript("hosted:readiness", "Hosted readiness");
  await submitDisposableRequest();
  const request = loadRequest();
  invariant(request?.id, "Disposable owner beta request row was not created.");
  proofRequestId = request.id;
  cleanupArmed = true;

  runNpmScript("admin:beta-request:triage-packet", "Prepare beta request triage packet", {
      ...process.env,
      OUTPOST_BETA_REQUEST_TRIAGE_PACKET_PATH: TRIAGE_PACKET_PATH,
      OUTPOST_BETA_REQUEST_TRIAGE_REQUEST_ID: request.id,
      OUTPOST_VERCEL_DEPLOYMENT_URL: APP_ORIGIN
    });
    runNpmScript("admin:beta-request:triage-record", "Record beta request triage", {
      ...process.env,
      OUTPOST_BETA_REQUEST_TRIAGE_DECISION: "ready_for_operator_fulfillment",
      OUTPOST_BETA_REQUEST_TRIAGE_PACKET_PATH: TRIAGE_PACKET_PATH,
      OUTPOST_BETA_REQUEST_TRIAGE_REVIEWER_LABEL: REVIEWER_LABEL,
      OUTPOST_BETA_REQUEST_TRIAGE_REVIEW_NOTE_PRESENT: "true",
      OUTPOST_VERCEL_DEPLOYMENT_URL: APP_ORIGIN
    });
    runNpmScript("admin:beta-request:followthrough", "Prepare beta request follow-through", {
      ...process.env,
      OUTPOST_BETA_REQUEST_FOLLOWTHROUGH_PATH: FOLLOWTHROUGH_PACKET_PATH,
      OUTPOST_BETA_REQUEST_FOLLOWTHROUGH_REQUEST_ID: request.id,
      OUTPOST_VERCEL_DEPLOYMENT_URL: APP_ORIGIN
    });
    runNpmScript("admin:beta-request:followthrough-record", "Record beta request follow-through outcome", {
      ...process.env,
      OUTPOST_BETA_REQUEST_FOLLOWTHROUGH_OUTCOME: "operator_handoff_completed",
      OUTPOST_BETA_REQUEST_FOLLOWTHROUGH_PATH: FOLLOWTHROUGH_PACKET_PATH,
      OUTPOST_BETA_REQUEST_FOLLOWTHROUGH_REVIEWER_LABEL: REVIEWER_LABEL,
      OUTPOST_BETA_REQUEST_FOLLOWTHROUGH_REVIEW_NOTE_PRESENT: "true",
      OUTPOST_VERCEL_DEPLOYMENT_URL: APP_ORIGIN
    });
    runNpmScript("beta:operator:request-fulfillment", "Fulfill beta request", {
      ...process.env,
      NEXT_PUBLIC_OUTPOST_APP_URL: APP_ORIGIN,
      OUTPOST_OWNER_BETA_PASSWORD: OWNER_PASSWORD,
      OUTPOST_OWNER_BETA_REQUEST_EMAIL: OWNER_EMAIL,
      OUTPOST_OWNER_BETA_REQUEST_FULFILLMENT_NOTE: "Disposable hosted beta request chain proof"
    });

    const verification = verifyChainRows(request.id);
    invariant(verification.request_status === "approved", "Request was not approved after fulfillment.");
    invariant(verification.request_fulfilled === true, "Request was not marked fulfilled.");
    invariant(verification.grant_linked === true, "Request was not linked to owner beta grant.");
    invariant(verification.triage_ready === true, "Ready triage receipt was not recorded.");
    invariant(verification.outcome_recorded === true, "Follow-through outcome was not recorded for latest triage.");
    invariant(verification.fulfillment_recorded === true, "Fulfillment receipt was not recorded.");
    invariant(
      verification.unexpected_live_provider_records === 0,
      "Hosted beta request chain proof unexpectedly found live provider records."
    );

    console.log(
      JSON.stringify(
        {
          app_origin: APP_ORIGIN,
          branch: config.branchName,
          cleanup: RETAIN_PROOF_DATA ? "retained" : "cleanup_requested",
          no_live_provider_gates_blocked: verification.unexpected_live_provider_records === 0,
          proof: "hosted_beta_request_chain",
          request_id: request.id,
          status: "passed",
          wrote_at: new Date().toISOString()
        },
        null,
        2
      )
    );
    mkdirSync(dirname(EVIDENCE_PATH), { recursive: true });
    writeFileSync(
      EVIDENCE_PATH,
      `${JSON.stringify(
        {
          app_origin: APP_ORIGIN,
          branch: config.branchName,
          cleanup: RETAIN_PROOF_DATA ? "retained" : "cleanup_requested",
          no_live_provider_gates_blocked: verification.unexpected_live_provider_records === 0,
          proof: "hosted_beta_request_chain",
          request_id: request.id,
          status: "passed",
          wrote_at: new Date().toISOString()
        },
        null,
        2
      )}\n`
    );
    console.log(`Evidence: ${EVIDENCE_PATH}`);
  } finally {
    cleanupProofData();
  }
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  try {
    cleanupProofData();
  } catch (cleanupError) {
    console.error(cleanupError instanceof Error ? `Cleanup failed: ${cleanupError.message}` : cleanupError);
  }
  process.exit(1);
}
