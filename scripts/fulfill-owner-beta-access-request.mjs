#!/usr/bin/env node

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readHostedReadinessConfig } from "./hosted-preview-readiness-config.mjs";
import { withNeonApiKey } from "./neon-cli-auth.mjs";

const config = readHostedReadinessConfig();
const DATABASE_NAME = process.env.OUTPOST_NEON_DATABASE_NAME ?? config.databaseName ?? "neondb";
const ROLE_NAME = process.env.OUTPOST_NEON_ROLE_NAME ?? "neondb_owner";
const COMMAND_NAME = "beta:operator:request-fulfillment";
const REQUEST_EMAIL = normalizeEmail(requireEnv("OUTPOST_OWNER_BETA_REQUEST_EMAIL"));
const TEMPORARY_PASSWORD = requireEnv("OUTPOST_OWNER_BETA_PASSWORD");
const FULFILLMENT_NOTE =
  process.env.OUTPOST_OWNER_BETA_REQUEST_FULFILLMENT_NOTE?.trim() ||
  `Operator fulfilled beta access request on ${new Date().toISOString()}`;

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required.`);
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
  invariant(/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(normalized), "OUTPOST_OWNER_BETA_REQUEST_EMAIL must be an email address.");
  assertNoSecretShapedValue(normalized, "OUTPOST_OWNER_BETA_REQUEST_EMAIL");

  return normalized;
}

function assertNoSecretShapedValue(value, label) {
  const text = String(value);
  const secretValue =
    /\bBearer\s+[A-Za-z0-9._~+/=-]{12,}/u.test(text) ||
    /\bnapi_[A-Za-z0-9]{20,}\b/u.test(text) ||
    /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}(?:\.[A-Za-z0-9_-]{8,})?\b/u.test(text) ||
    text.includes("__Secure-neon-auth") ||
    text.includes("outpost_neon_auth_session") ||
    /(?:password|token|cookie|api[_-]?key|authorization|credential|private[_-]?key|secret|bypass|signature|jwt)\s*[:=]/iu.test(
      text
    );

  invariant(!secretValue, `${label} contains a secret-shaped value.`);
}

function assertOperatorSafety() {
  invariant(process.env.NEON_API_KEY, "NEON_API_KEY is required for beta request fulfillment.");
  invariant(config.branchName !== "production", "Refusing to fulfill beta access requests on Neon production.");
  invariant(
    config.branchName !== "outpost-neon-spike",
    "Refusing to fulfill beta access requests on the Neon migration spike branch."
  );
  invariant(TEMPORARY_PASSWORD.length >= 12, "OUTPOST_OWNER_BETA_PASSWORD must be at least 12 characters.");
  invariant(
    TEMPORARY_PASSWORD !== "outpost-local-password",
    "Refusing to use the local seed password for a hosted beta owner."
  );
  invariant(TEMPORARY_PASSWORD.toLowerCase() !== REQUEST_EMAIL, "OUTPOST_OWNER_BETA_PASSWORD must not equal the owner email.");
  invariant(FULFILLMENT_NOTE.length <= 500, "OUTPOST_OWNER_BETA_REQUEST_FULFILLMENT_NOTE must be 500 characters or fewer.");
  assertNoSecretShapedValue(FULFILLMENT_NOTE, "OUTPOST_OWNER_BETA_REQUEST_FULFILLMENT_NOTE");
}

function sqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function sqlJsonLiteral(value) {
  return `${sqlLiteral(JSON.stringify(value))}::jsonb`;
}

function stableReceiptId(requestId) {
  return `owner_beta_fulfillment_receipt_${createHash("sha256").update(requestId).digest("hex")}`;
}

function runNeonPsql(args) {
  const result = spawnSync(
    "neon",
    withNeonApiKey([
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
    ]),
    {
      cwd: process.cwd(),
      encoding: "utf8",
      env: process.env
    }
  );

  if (result.status !== 0) {
    throw new Error([result.stdout, result.stderr].filter(Boolean).join("\n"));
  }

  return result.stdout;
}

function runPsqlScript(sql) {
  const tempDir = mkdtempSync(join(tmpdir(), "outpost-beta-request-fulfillment-"));
  const scriptPath = join(tempDir, "operator.sql");

  try {
    writeFileSync(scriptPath, sql);
    return runNeonPsql(["-t", "-A", "-q", "-v", "ON_ERROR_STOP=1", "-f", scriptPath]);
  } finally {
    rmSync(tempDir, { force: true, recursive: true });
  }
}

function parsePsqlJson(output) {
  const payload = output
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("INFO:"))[0];

  return payload ? JSON.parse(payload) : null;
}

function summarizeProvisionerOutput(output) {
  const trimmed = output.trim();

  if (!trimmed) {
    return "Owner beta access provisioner completed.";
  }

  assertNoSecretShapedValue(trimmed, "owner beta access provisioner output");

  return trimmed;
}

function loadRequest() {
  return parsePsqlJson(
    runNeonPsql([
      "-t",
      "-A",
      "-c",
      `
        select to_jsonb(requests)
        from (
          select
            id,
            lower(email::text) as email,
            owner_name,
            gym_name,
            location_hint,
            status::text as status,
            request_count,
            fulfilled_at,
            fulfilled_grant_id
          from owner_beta_access_requests
          where email = ${sqlLiteral(REQUEST_EMAIL)}::citext
        ) requests;
      `
    ])
  );
}

function markRequestReviewing(requestId) {
  const output = runPsqlScript(`
    update owner_beta_access_requests
       set status = 'reviewing',
           updated_at = now()
     where id = ${sqlLiteral(requestId)}
       and fulfilled_at is null
       and status in ('new', 'reviewing', 'approved')
    returning to_jsonb(owner_beta_access_requests);
  `);

  const reviewing = parsePsqlJson(output);
  invariant(reviewing?.id === requestId, "Unable to mark beta access request reviewing.");
}

function runOwnerAccessProvisioner(request) {
  const result = spawnSync("node", ["scripts/provision-owner-beta-access.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      OUTPOST_OWNER_BETA_EMAIL: request.email,
      OUTPOST_OWNER_BETA_NAME: request.owner_name,
      OUTPOST_OWNER_BETA_NOTE: `Beta access request ${request.id} for ${request.gym_name}`,
      OUTPOST_OWNER_BETA_PASSWORD: TEMPORARY_PASSWORD
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  if (result.status !== 0) {
    throw new Error([result.stdout, result.stderr].filter(Boolean).join("\n"));
  }

  return [result.stdout, result.stderr].filter(Boolean).join("\n");
}

function markRequestFulfilled(requestId) {
  const output = runPsqlScript(`
    with target_grant as (
      select id
      from owner_beta_access_grants
      where email = ${sqlLiteral(REQUEST_EMAIL)}::citext
        and status = 'active'
      limit 1
    ),
    updated_request as (
      update owner_beta_access_requests
         set status = 'approved',
             fulfilled_at = now(),
             fulfilled_grant_id = (select id from target_grant),
             fulfillment_note = ${sqlLiteral(FULFILLMENT_NOTE)},
             updated_at = now()
       where id = ${sqlLiteral(requestId)}
         and fulfilled_at is null
         and exists (select 1 from target_grant)
      returning id, lower(email::text) as email, status::text as status, fulfilled_at, fulfilled_grant_id
    )
    select to_jsonb(updated_request)
    from updated_request;
  `);

  const fulfilled = parsePsqlJson(output);
  invariant(fulfilled?.fulfilled_grant_id, "Unable to link the fulfilled request to an active owner beta access grant.");

  return fulfilled;
}

function recordFulfillmentReceipt(fulfilled) {
  const summary = {
    grant_linked: true,
    no_live_provider_claim: true,
    request_status: fulfilled.status,
    scope: "operator_cli_fulfillment_receipt"
  };

  assertNoSecretShapedValue(JSON.stringify(summary), "fulfillment receipt summary");

  const output = runPsqlScript(`
    insert into owner_beta_access_fulfillment_receipts (
      id,
      request_id,
      owner_email,
      fulfilled_grant_id,
      command_name,
      neon_branch_name,
      status,
      completed_at,
      summary
    ) values (
      ${sqlLiteral(stableReceiptId(fulfilled.id))},
      ${sqlLiteral(fulfilled.id)},
      ${sqlLiteral(fulfilled.email)}::citext,
      ${sqlLiteral(fulfilled.fulfilled_grant_id)},
      ${sqlLiteral(COMMAND_NAME)},
      ${sqlLiteral(config.branchName)},
      'recorded',
      ${sqlLiteral(fulfilled.fulfilled_at)}::timestamptz,
      ${sqlJsonLiteral(summary)}
    )
    on conflict (id) do nothing
    returning to_jsonb(owner_beta_access_fulfillment_receipts);
  `);

  return parsePsqlJson(output) ?? {
    id: stableReceiptId(fulfilled.id),
    command_name: COMMAND_NAME,
    neon_branch_name: config.branchName,
    status: "recorded",
    completed_at: fulfilled.fulfilled_at
  };
}

async function main() {
  assertOperatorSafety();

  console.log("Outpost beta access request fulfillment");
  console.log(`Project: ${config.projectId}`);
  console.log(`Branch: ${config.branchName}`);
  console.log(`Request owner email: ${REQUEST_EMAIL}`);
  console.log("Mode: operator-managed request fulfillment, no invite delivery, no live providers\n");

  const request = loadRequest();
  invariant(request, `No owner beta access request found for ${REQUEST_EMAIL}.`);
  invariant(request.email === REQUEST_EMAIL, "Loaded beta access request email mismatch.");
  invariant(request.status !== "declined", "Refusing to fulfill a declined beta access request.");
  invariant(request.status !== "superseded", "Refusing to fulfill a superseded beta access request.");
  invariant(!request.fulfilled_at, "This beta access request is already fulfilled.");
  invariant(!request.fulfilled_grant_id, "This beta access request already has a fulfilled grant link.");

  console.log(`Request: ${request.id}`);
  console.log(`Gym: ${request.gym_name}`);
  console.log(`Owner: ${request.owner_name}`);
  console.log(`Current status: ${request.status}`);

  markRequestReviewing(request.id);
  console.log("Request marked reviewing.");

  const provisionerOutput = runOwnerAccessProvisioner(request);
  console.log(summarizeProvisionerOutput(provisionerOutput));

  const fulfilled = markRequestFulfilled(request.id);
  const receipt = recordFulfillmentReceipt(fulfilled);
  console.log(`\nRequest fulfilled: ${fulfilled.id}`);
  console.log(`Status: ${fulfilled.status}`);
  console.log(`Fulfilled at: ${fulfilled.fulfilled_at}`);
  console.log("Grant linkage recorded without exposing temporary credentials.");
  console.log(`Fulfillment receipt recorded: ${receipt.id}`);
  console.log(`Receipt command: ${receipt.command_name}`);
  console.log(`Receipt branch: ${receipt.neon_branch_name}`);

  console.log("\nNext:");
  console.log(`- Generate a customer-safe packet for ${request.gym_name}: npm run beta:owner-handoff:packet`);
  console.log("- Share the temporary password out of band only after the protected Preview proof is green.");
  console.log("- Keep invite delivery, public self-serve, live providers, billing, POS, and member-ledger writes blocked.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
