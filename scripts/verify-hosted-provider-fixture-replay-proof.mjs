#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { Pool } from "@neondatabase/serverless";
import { withNeonApiKey } from "./neon-cli-auth.mjs";

const config = readProviderFixtureReplayConfig();
const DATABASE_NAME = process.env.OUTPOST_NEON_DATABASE_NAME ?? config.databaseName ?? "neondb";
const ROLE_NAME = process.env.OUTPOST_NEON_ROLE_NAME ?? "neondb_owner";
const APP_ORIGIN = normalizeHostedAppOrigin(
  process.env.OUTPOST_VERCEL_DEPLOYMENT_URL ?? process.env.NEXT_PUBLIC_OUTPOST_APP_URL
);
const INTERNAL_JOB_DRAIN_TOKEN = requireEnv("OUTPOST_INTERNAL_JOB_DRAIN_TOKEN");
const VERCEL_BYPASS_SECRET = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
const USE_VERCEL_CURL = process.env.OUTPOST_USE_VERCEL_CURL === "1";
const TENANT_ID = process.env.OUTPOST_PROVIDER_FIXTURE_TENANT_ID ?? "tenant_acme_fitness";
const LOCATION_ID = process.env.OUTPOST_PROVIDER_FIXTURE_LOCATION_ID ?? "loc_acme_fitness_main";
const RETELL_PROVIDER_CONNECTION_ID =
  process.env.OUTPOST_PROVIDER_FIXTURE_RETELL_CONNECTION_ID ?? "provider_retell_acme_fitness_preview";
const RESEND_PROVIDER_CONNECTION_ID =
  process.env.OUTPOST_PROVIDER_FIXTURE_RESEND_CONNECTION_ID ?? "provider_resend_acme_fitness_preview";
const RETELL_FIXTURE_PROVIDER_EVENT_ID = "retell_call_preview_001:call_ended";
const RESEND_FIXTURE_PROVIDER_EVENT_ID = "email_preview_001:email.received";
const RETELL_FIXTURE_PAYLOAD_REF = "fixture/tests/fixtures/retell/call-ended-gym-follow-up.json";
const RESEND_FIXTURE_PAYLOAD_REF = "fixture/tests/fixtures/resend/inbound-gym-freeze-request.json";
const RETELL_FIXTURE_TASK_ID = stableProviderId(
  "task_retell",
  `${TENANT_ID}:${RETELL_PROVIDER_CONNECTION_ID}:retell_call_preview_001:staff_follow_up`
);
const RESEND_FIXTURE_TASK_ID = stableProviderId(
  "task_resend",
  `${TENANT_ID}:${RESEND_PROVIDER_CONNECTION_ID}:email_preview_001:staff_follow_up`
);

function invariant(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function requireEnv(name) {
  const value = process.env[name];
  invariant(value, `${name} is required.`);
  return value;
}

function stableProviderId(prefix, value) {
  return `${prefix}_${createHash("sha256").update(value).digest("hex").slice(0, 24)}`;
}

function readProviderFixtureReplayConfig(env = process.env) {
  const branchName = env.OUTPOST_NEON_BRANCH_NAME?.trim();
  const projectId = env.OUTPOST_NEON_PROJECT_ID?.trim();
  const connectionString = env.OUTPOST_DATABASE_URL?.trim();

  if (connectionString) {
    invariant(
      branchName,
      "OUTPOST_NEON_BRANCH_NAME is required when OUTPOST_DATABASE_URL is used for provider fixture replay proof."
    );
    assertDatabaseUrl(connectionString);
    return {
      branchName,
      connectionString,
      databaseName: env.OUTPOST_NEON_DATABASE_NAME?.trim() || undefined,
      projectId
    };
  }

  invariant(projectId, "OUTPOST_NEON_PROJECT_ID is required when OUTPOST_DATABASE_URL is not provided.");
  invariant(branchName, "OUTPOST_NEON_BRANCH_NAME is required for provider fixture replay proof.");

  return {
    branchName,
    databaseName: env.OUTPOST_NEON_DATABASE_NAME?.trim() || undefined,
    projectId
  };
}

function normalizeHostedAppOrigin(rawOrigin) {
  invariant(rawOrigin, "OUTPOST_VERCEL_DEPLOYMENT_URL or NEXT_PUBLIC_OUTPOST_APP_URL is required.");

  let url;
  try {
    url = new URL(rawOrigin);
  } catch {
    throw new Error("Hosted provider fixture replay proof app origin must be a valid URL.");
  }

  invariant(url.protocol === "https:", "Hosted provider fixture replay proof must use an HTTPS Vercel Preview URL.");
  invariant(url.hostname.endsWith(".vercel.app"), "Hosted provider fixture replay proof must target a Vercel Preview URL.");
  invariant(
    !["127.0.0.1", "localhost", "::1", "[::1]"].includes(url.hostname),
    "Hosted provider fixture replay proof refuses local app origins."
  );
  url.pathname = "";
  url.search = "";
  url.hash = "";

  return url.toString().replace(/\/$/u, "");
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

function assertDatabaseUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("OUTPOST_DATABASE_URL must be a valid Postgres URL.");
  }

  invariant(
    url.protocol === "postgres:" || url.protocol === "postgresql:",
    "OUTPOST_DATABASE_URL must use postgres:// or postgresql://."
  );
  invariant(url.hostname, "OUTPOST_DATABASE_URL must include a host.");
}

function assertProofSafety() {
  invariant(config.branchName !== "production", "Refusing hosted provider fixture replay proof on Neon production.");
  invariant(
    config.branchName !== "outpost-neon-spike",
    "Refusing hosted provider fixture replay proof on the Neon migration spike branch."
  );
  invariant(TENANT_ID.length > 0, "OUTPOST_PROVIDER_FIXTURE_TENANT_ID must not be empty.");
  invariant(LOCATION_ID.length > 0, "OUTPOST_PROVIDER_FIXTURE_LOCATION_ID must not be empty.");
  invariant(RETELL_PROVIDER_CONNECTION_ID.length > 0, "OUTPOST_PROVIDER_FIXTURE_RETELL_CONNECTION_ID must not be empty.");
  invariant(RESEND_PROVIDER_CONNECTION_ID.length > 0, "OUTPOST_PROVIDER_FIXTURE_RESEND_CONNECTION_ID must not be empty.");
  for (const [label, value] of [
    ["tenant id", TENANT_ID],
    ["location id", LOCATION_ID],
    ["Retell provider connection id", RETELL_PROVIDER_CONNECTION_ID],
    ["Resend provider connection id", RESEND_PROVIDER_CONNECTION_ID]
  ]) {
    assertNoSecretShapedValue(value, label);
  }
}

function runCommand(args, label, env = process.env) {
  return runCommandResult(args, label, env).output;
}

function runCommandResult(args, label, env = process.env) {
  const result = spawnSync(args[0], args.slice(1), {
    cwd: process.cwd(),
    encoding: "utf8",
    env,
    stdio: ["ignore", "pipe", "pipe"]
  });

  if (result.status !== 0) {
    throw new Error(`${label} failed.\n${[result.stdout, result.stderr].filter(Boolean).join("\n")}`);
  }

  return {
    output: [result.stdout, result.stderr].filter(Boolean).join("\n"),
    stderr: result.stderr,
    stdout: result.stdout
  };
}

function getConnectionString() {
  if (config.connectionString) {
    return config.connectionString;
  }

  const output = runCommand(
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
        ROLE_NAME
      ])
    ],
    "Neon connection string lookup"
  ).trim();

  const connectionString = output.split(/\r?\n/u).find((line) => line.startsWith("postgres"));
  invariant(connectionString, "Neon connection string lookup did not return a database URL.");
  return connectionString;
}

async function withPool(connectionString, callback) {
  const pool = new Pool({ connectionString });
  try {
    return await callback(pool);
  } finally {
    await pool.end();
  }
}

async function ensureFixtureProviderConnectionStubs(pool) {
  const tenant = await pool.query("select id from tenants where id = $1", [TENANT_ID]);
  invariant(tenant.rows.length === 1, `Fixture tenant ${TENANT_ID} is missing on the hosted proof branch.`);

  const location = await pool.query("select id from locations where tenant_id = $1 and id = $2", [TENANT_ID, LOCATION_ID]);
  invariant(location.rows.length === 1, `Fixture location ${LOCATION_ID} is missing on the hosted proof branch.`);

  const unsafe = await pool.query(
    `
      select id, status, secret_ref
        from provider_connections
       where tenant_id = $1
         and id = any($2::text[])
         and (status = 'pending_review'::provider_connection_status or secret_ref is not null)
    `,
    [TENANT_ID, [RETELL_PROVIDER_CONNECTION_ID, RESEND_PROVIDER_CONNECTION_ID]]
  );
  invariant(unsafe.rows.length === 0, "Fixture provider connection stubs must not be pending_review or carry secret_ref.");

  await pool.query(
    `
      insert into provider_connections (
        id, tenant_id, location_id, channel, provider_key, status,
        external_account_label, secret_ref, disabled_reason
      )
      values
        ($1, $3, $4, 'phone', 'retell', 'not_configured',
         'Retell fixture normalization proof stub', null,
         'fixture normalization proof only - live provider remains blocked'),
        ($2, $3, $4, 'email', 'resend', 'not_configured',
         'Resend fixture normalization proof stub', null,
         'fixture normalization proof only - live provider remains blocked')
      on conflict (id) do update
        set status = 'not_configured',
            external_account_label = excluded.external_account_label,
            secret_ref = null,
            disabled_reason = excluded.disabled_reason,
            updated_at = now()
      where provider_connections.status in ('not_configured', 'disabled')
        and provider_connections.secret_ref is null
    `,
    [RETELL_PROVIDER_CONNECTION_ID, RESEND_PROVIDER_CONNECTION_ID, TENANT_ID, LOCATION_ID]
  );

  const stubs = await pool.query(
    `
      select id
        from provider_connections
       where tenant_id = $1
         and location_id = $2
         and id = any($3::text[])
         and status = 'not_configured'::provider_connection_status
         and secret_ref is null
    `,
    [TENANT_ID, LOCATION_ID, [RETELL_PROVIDER_CONNECTION_ID, RESEND_PROVIDER_CONNECTION_ID]]
  );
  invariant(stubs.rows.length === 2, "Fixture provider connection stubs were not prepared safely.");
}

async function drainHostedJobs() {
  if (USE_VERCEL_CURL) {
    return drainHostedJobsWithVercelCurl();
  }

  const headers = {
    Authorization: `Bearer ${INTERNAL_JOB_DRAIN_TOKEN}`,
    "Content-Type": "application/json"
  };
  if (VERCEL_BYPASS_SECRET) {
    headers["x-vercel-protection-bypass"] = VERCEL_BYPASS_SECRET;
  }

  const response = await fetch(`${APP_ORIGIN}/api/internal/jobs/drain?batch=10`, {
    headers,
    method: "POST"
  });
  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { text };
  }

  invariant(
    body?.error?.message !== "Protected deployment",
    "Hosted job drain hit Vercel Deployment Protection. Re-run with OUTPOST_USE_VERCEL_CURL=1 or VERCEL_AUTOMATION_BYPASS_SECRET."
  );
  invariant(response.ok, `Hosted job drain failed with ${response.status}: ${JSON.stringify(body)}`);
  invariant(body?.ok === true, `Hosted job drain returned an unsuccessful body: ${JSON.stringify(body)}`);
  invariant(body.failed === 0, `Hosted job drain reported failed jobs: ${JSON.stringify(body)}`);
  invariant(body.settlementFailed === 0, `Hosted job drain reported settlement failures: ${JSON.stringify(body)}`);

  return {
    claimed: body.claimed,
    succeeded: body.succeeded,
    workerId: body.workerId
  };
}

function parseJsonCommandOutput(output, label) {
  const candidates = output
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("{") && line.endsWith("}"));
  const raw = candidates.at(-1);
  invariant(raw, `${label} did not return a JSON body.`);
  return JSON.parse(raw);
}

function drainHostedJobsWithVercelCurl() {
  const result = runCommandResult(
    [
      "vercel",
      "curl",
      "/api/internal/jobs/drain?batch=10",
      "--deployment",
      APP_ORIGIN,
      "--",
      "--request",
      "POST",
      "--header",
      `Authorization: Bearer ${INTERNAL_JOB_DRAIN_TOKEN}`,
      "--header",
      "Content-Type: application/json"
    ],
    "Vercel protected hosted job drain"
  );
  const body = parseJsonCommandOutput(result.stdout, "Vercel protected hosted job drain");

  invariant(body?.ok === true, `Hosted job drain returned an unsuccessful body: ${JSON.stringify(body)}`);
  invariant(body.failed === 0, `Hosted job drain reported failed jobs: ${JSON.stringify(body)}`);
  invariant(body.settlementFailed === 0, `Hosted job drain reported settlement failures: ${JSON.stringify(body)}`);

  return {
    claimed: body.claimed,
    succeeded: body.succeeded,
    workerId: body.workerId
  };
}

async function verifyPersistedFixtureRows(pool) {
  const result = await pool.query(
    `
      with expected_events(provider_key, provider_connection_id, provider_event_id, event_type, payload_ref, task_id) as (
        values
          ('retell', $2::text, $5::text, 'retell.call_ended', $6::text, $7::text),
          ('resend', $3::text, $8::text, 'resend.email_received', $9::text, $10::text)
      ),
      matched_events as (
        select
          expected_events.provider_key,
          expected_events.task_id,
          expected_events.payload_ref as expected_payload_ref,
          channel_events.id,
          channel_events.provider_event_id,
          channel_events.event_type,
          channel_events.payload_digest,
          channel_events.payload_ref,
          channel_events.processing_status
        from expected_events
        join channel_events
          on channel_events.tenant_id = $1
         and channel_events.provider_connection_id = expected_events.provider_connection_id
         and channel_events.provider_event_id = expected_events.provider_event_id
         and channel_events.event_type = expected_events.event_type
         and channel_events.payload_ref = expected_events.payload_ref
         and channel_events.processing_status = 'normalized'
      ),
      source_linked_task_events as (
        select
          expected_events.provider_key,
          tasks.id as task_id,
          tasks.intent,
          task_events.note
        from expected_events
        join tasks
          on tasks.tenant_id = $1
         and tasks.location_id = $4
         and tasks.id = expected_events.task_id
        join matched_events
          on matched_events.provider_key = expected_events.provider_key
         and matched_events.task_id = expected_events.task_id
        join task_events
          on task_events.tenant_id = tasks.tenant_id
         and task_events.location_id = tasks.location_id
         and task_events.task_id = tasks.id
         and task_events.event_type = 'source_linked'
         and task_events.note = concat(
           'Provider normalized source: ',
           expected_events.event_type,
           '; reference: ',
           expected_events.payload_ref,
           '; live providers remain blocked.'
         )
         and task_events.note like '%live providers remain blocked.%'
      )
      select jsonb_build_object(
        'event_count', (select count(*) from matched_events),
        'providers', coalesce((select jsonb_agg(provider_key order by provider_key) from matched_events), '[]'::jsonb),
        'rows', coalesce(
          (
            select jsonb_agg(
              jsonb_build_object(
                'provider_key', provider_key,
                'event_type', event_type,
                'payload_digest_prefix', left(payload_digest, 12),
                'payload_ref', payload_ref,
                'processing_status', processing_status
              )
              order by provider_key
            )
            from matched_events
          ),
          '[]'::jsonb
        ),
        'task_count',
          (
            select count(*)
              from tasks
             where tenant_id = $1
               and location_id = $4
               and intent in ('membership_options', 'membership_freeze_question')
          ),
        'usage_event_count',
          (
            select count(*)
              from usage_events
             where tenant_id = $1
               and location_id = $4
               and meter in (
                 'call_completed'::usage_meter,
                 'email_received'::usage_meter,
                 'task_created'::usage_meter,
                 'voice_seconds'::usage_meter
               )
          ),
        'source_linked_task_event_count',
          (
            select count(*)
              from source_linked_task_events
          ),
        'source_linked_rows',
          coalesce(
            (
              select jsonb_agg(
                jsonb_build_object(
                  'task_id', task_id,
                  'provider_key', provider_key,
                  'intent', intent,
                  'source_note', note
                )
                order by provider_key
              )
              from source_linked_task_events
            ),
            '[]'::jsonb
          )
      ) as proof
    `,
    [
      TENANT_ID,
      RETELL_PROVIDER_CONNECTION_ID,
      RESEND_PROVIDER_CONNECTION_ID,
      LOCATION_ID,
      RETELL_FIXTURE_PROVIDER_EVENT_ID,
      RETELL_FIXTURE_PAYLOAD_REF,
      RETELL_FIXTURE_TASK_ID,
      RESEND_FIXTURE_PROVIDER_EVENT_ID,
      RESEND_FIXTURE_PAYLOAD_REF,
      RESEND_FIXTURE_TASK_ID
    ]
  );

  const proof = result.rows[0]?.proof;
  invariant(proof?.event_count === 2, `Expected two normalized provider events, got ${JSON.stringify(proof)}.`);
  invariant(proof.task_count >= 2, `Expected fixture-created task rows, got ${JSON.stringify(proof)}.`);
  invariant(proof.usage_event_count >= 5, `Expected fixture usage rows, got ${JSON.stringify(proof)}.`);
  invariant(
    proof.source_linked_task_event_count === 2,
    `Expected fixture task source-link events, got ${JSON.stringify(proof)}.`
  );
  assertNoSecretShapedValue(JSON.stringify(proof), "provider fixture replay proof summary");

  return proof;
}

async function main() {
  assertProofSafety();
  const connectionString = getConnectionString();

  const proof = await withPool(connectionString, async (pool) => {
    await ensureFixtureProviderConnectionStubs(pool);
    runCommand(["npm", "run", "admin:provider-fixtures:enqueue"], "Provider fixture enqueue", {
      ...process.env,
      OUTPOST_DATABASE_URL: connectionString
    });
    const drain = await drainHostedJobs();
    return {
      drain,
      persisted: await verifyPersistedFixtureRows(pool)
    };
  });

  console.log("Hosted provider fixture replay proof passed");
  console.log(
    JSON.stringify(
      {
        app_origin: APP_ORIGIN,
        branch_name: config.branchName,
        drain_claimed: proof.drain.claimed,
        drain_succeeded: proof.drain.succeeded,
        event_count: proof.persisted.event_count,
        providers: proof.persisted.providers,
        task_count: proof.persisted.task_count,
        usage_event_count: proof.persisted.usage_event_count,
        source_linked_task_event_count: proof.persisted.source_linked_task_event_count,
        rows: proof.persisted.rows,
        source_linked_rows: proof.persisted.source_linked_rows,
        blocked_gates: [
          "live_provider_calls",
          "invite_delivery",
          "billing",
          "pos",
          "access_control",
          "member_ledger_writes",
          "public_self_serve"
        ]
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
