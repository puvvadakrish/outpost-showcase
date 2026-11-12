#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { readHostedReadinessConfig } from "./hosted-preview-readiness-config.mjs";
import { withNeonApiKey } from "./neon-cli-auth.mjs";

const config = readHostedReadinessConfig();
const DATABASE_NAME = process.env.OUTPOST_NEON_DATABASE_NAME ?? config.databaseName ?? "neondb";
const ROLE_NAME = process.env.OUTPOST_NEON_ROLE_NAME ?? "neondb_owner";
const REQUEST_EMAIL = normalizeEmail(requireEnv("OUTPOST_OWNER_BETA_REQUEST_EMAIL"));
const ALLOW_BLOCKED_REPORT = process.env.OUTPOST_OWNER_BETA_PREFLIGHT_ALLOW_BLOCKED === "1";

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
  invariant(process.env.NEON_API_KEY, "NEON_API_KEY is required for beta request fulfillment preflight.");
  invariant(config.branchName !== "production", "Refusing beta request preflight on Neon production.");
  invariant(
    config.branchName !== "outpost-neon-spike",
    "Refusing beta request preflight on the Neon migration spike branch."
  );
}

function sqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function shellSingleQuote(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`;
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

function parsePsqlJson(output) {
  const payload = output
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("INFO:"))[0];

  return payload ? JSON.parse(payload) : null;
}

function loadRequestPreflight() {
  return parsePsqlJson(
    runNeonPsql([
      "-t",
      "-A",
      "-c",
      `
        with request_rows as (
          select
            requests.id,
            lower(requests.email::text) as email,
            requests.owner_name,
            requests.gym_name,
            requests.location_hint,
            requests.status::text as status,
            requests.request_count,
            requests.last_requested_at,
            requests.fulfilled_at,
            requests.fulfilled_grant_id,
            nullif(requests.note, '') is not null as note_present,
            nullif(requests.fulfillment_note, '') is not null as fulfillment_note_present,
            grants.id as grant_id,
            grants.status::text as grant_status,
            app_users.id as user_id,
            app_users.external_auth_id is not null as auth_linked,
            owner_memberships.tenant_id,
            tenants.name as tenant_name,
            (
              select count(*)
                from provider_connections providers
                where providers.tenant_id = owner_memberships.tenant_id
                  and (
                    providers.status not in ('not_configured', 'disabled', 'pending_review')
                    or providers.secret_ref is not null
                    or nullif(providers.external_account_label, '') is not null
                  )
            ) as unexpected_live_provider_records
          from owner_beta_access_requests requests
          left join owner_beta_access_grants grants
            on lower(grants.email::text) = lower(requests.email::text)
          left join users app_users
            on lower(app_users.email::text) = lower(requests.email::text)
          left join tenant_memberships owner_memberships
            on owner_memberships.user_id = app_users.id
           and owner_memberships.role = 'owner'
           and owner_memberships.invite_status = 'active'
          left join tenants
            on tenants.id = owner_memberships.tenant_id
          where requests.email = ${sqlLiteral(REQUEST_EMAIL)}::citext
          limit 1
        )
        select to_jsonb(request_rows)
        from request_rows;
      `
    ])
  );
}

function classifyPreflight(request) {
  if (!request) {
    return {
      detail: "No beta access request exists for this email.",
      reasons: ["Submit the owner beta access request from /owner/sign-in before fulfillment."],
      state: "blocked",
      title: "Preflight blocked"
    };
  }

  const blockingReasons = [];
  const attentionReasons = [];
  const unexpectedLiveRecords = Number(request.unexpected_live_provider_records ?? 0);

  if (request.status === "declined") {
    blockingReasons.push("Request is declined.");
  }

  if (request.status === "superseded") {
    blockingReasons.push("Request is superseded; use the latest request for this owner email.");
  }

  if (request.fulfilled_at || request.fulfilled_grant_id) {
    blockingReasons.push("Request already has fulfillment recorded.");
  }

  if (unexpectedLiveRecords > 0) {
    blockingReasons.push("Unexpected live-provider records exist for the linked tenant.");
  }

  if (request.grant_id) {
    attentionReasons.push(
      request.grant_status === "active"
        ? "An owner beta access grant already exists."
        : `An owner beta access grant already exists with status ${request.grant_status ?? "unknown"}.`
    );
  }

  if (request.user_id) {
    attentionReasons.push("An app user already exists for this owner email.");
  }

  if (request.auth_linked) {
    attentionReasons.push("The owner email is already linked to Neon Auth.");
  }

  if (request.tenant_id) {
    attentionReasons.push(`Workspace bootstrap already exists for ${request.tenant_name ?? request.tenant_id}.`);
  }

  if (blockingReasons.length > 0) {
    return {
      detail: "Do not run fulfillment until the blocking condition is resolved.",
      reasons: blockingReasons,
      state: "blocked",
      title: "Preflight blocked"
    };
  }

  if (attentionReasons.length > 0) {
    return {
      detail: "Review existing access state before running the fulfillment command.",
      reasons: attentionReasons,
      state: "attention",
      title: "Needs operator review"
    };
  }

  return {
    detail: "Dry-run checks show this request is ready for CLI fulfillment.",
    reasons: [
      "Request is active and unfulfilled.",
      "No existing owner grant, app user, workspace, or live-provider surprise was found."
    ],
    state: "ready",
    title: "Ready for CLI fulfillment"
  };
}

function fulfillmentCommand() {
  return [
    `OUTPOST_OWNER_BETA_REQUEST_EMAIL=${shellSingleQuote(REQUEST_EMAIL)}`,
    `OUTPOST_OWNER_BETA_PASSWORD='<temporary-password>'`,
    `OUTPOST_OWNER_BETA_REQUEST_FULFILLMENT_NOTE='<operator-note-without-secrets>'`,
    "npm run beta:operator:request-fulfillment"
  ].join(" \\\n  ");
}

function printReport(request, preflight) {
  console.log("Outpost beta access request preflight");
  console.log(`Project: ${config.projectId}`);
  console.log(`Branch: ${config.branchName}`);
  console.log(`Request owner email: ${REQUEST_EMAIL}`);
  console.log("Mode: dry-run preflight, no hosted rows written, no invite delivery, no live providers\n");

  if (request) {
    console.log(`Request: ${request.id}`);
    console.log(`Gym: ${request.gym_name}`);
    console.log(`Owner: ${request.owner_name}`);
    console.log(`Current status: ${request.status}`);
    console.log(`Request count: ${request.request_count}`);
    console.log(`Last requested: ${request.last_requested_at}`);
  }

  console.log(`\n${preflight.title}`);
  console.log(`State: ${preflight.state}`);
  console.log(preflight.detail);

  for (const reason of preflight.reasons) {
    console.log(`- ${reason}`);
  }

  console.log("\nNext command when preflight is ready:");
  console.log(fulfillmentCommand());
  console.log("\nDry-run complete; no hosted rows were written.");
  console.log("Invite delivery, public self-serve, live providers, billing, POS, access control, and member-ledger writes remain blocked.");
}

async function main() {
  assertOperatorSafety();

  const request = loadRequestPreflight();
  const preflight = classifyPreflight(request);
  printReport(request, preflight);

  if (preflight.state === "blocked" && !ALLOW_BLOCKED_REPORT) {
    process.exitCode = 2;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
