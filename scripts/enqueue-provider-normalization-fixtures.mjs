#!/usr/bin/env node

import { Pool } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";

const DEFAULT_TENANT_ID = "tenant_acme_fitness";
const DEFAULT_LOCATION_ID = "loc_acme_fitness_main";
const DEFAULT_RETELL_PROVIDER_CONNECTION_ID = "provider_retell_acme_fitness_preview";
const DEFAULT_RESEND_PROVIDER_CONNECTION_ID = "provider_resend_acme_fitness_preview";

function invariant(condition, message) {
  if (!condition) throw new Error(message);
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
    /(?:password|token|cookie|api[_-]?key|authorization|credential|private[_-]?key|secret|bypass|signature|jwt)["']?\s*[:=]/iu.test(text);

  invariant(!secretValue, `${label} contains secret-shaped value.`);
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

function readJsonFixture(path) {
  const raw = readFileSync(path, "utf8");
  assertNoSecretShapedValue(raw, path);
  return JSON.parse(raw);
}

function contextFromEnv(provider) {
  return {
    tenant_id: process.env.OUTPOST_PROVIDER_FIXTURE_TENANT_ID ?? DEFAULT_TENANT_ID,
    location_id: process.env.OUTPOST_PROVIDER_FIXTURE_LOCATION_ID ?? DEFAULT_LOCATION_ID,
    provider_connection_id:
      provider === "retell"
        ? process.env.OUTPOST_PROVIDER_FIXTURE_RETELL_CONNECTION_ID ?? DEFAULT_RETELL_PROVIDER_CONNECTION_ID
        : process.env.OUTPOST_PROVIDER_FIXTURE_RESEND_CONNECTION_ID ?? DEFAULT_RESEND_PROVIDER_CONNECTION_ID
  };
}

export function selectedFixtureKinds(rawKind = process.env.OUTPOST_PROVIDER_FIXTURE_KIND ?? "all") {
  const kind = rawKind.trim().toLowerCase();
  if (kind === "all") return ["retell", "resend"];
  if (kind === "retell" || kind === "resend") return [kind];
  throw new Error("OUTPOST_PROVIDER_FIXTURE_KIND must be retell, resend, or all.");
}

export function buildFixtureJob(provider) {
  if (provider === "retell") {
    const payload = readJsonFixture("tests/fixtures/retell/call-ended-gym-follow-up.json");
    const context = contextFromEnv("retell");
    const externalId = payload.call_id;
    invariant(typeof externalId === "string" && externalId, "Retell fixture call_id required.");
    return {
      kind: "provider.retell.call_ended.normalize",
      payloadVersion: 1,
      dedupeKey: `provider.retell.call_ended.normalize:${context.tenant_id}:${context.provider_connection_id}:${externalId}`,
      tenantId: context.tenant_id,
      payload: {
        context,
        payload_ref: "fixture/tests/fixtures/retell/call-ended-gym-follow-up.json",
        provider_payload: payload,
        received_at: "2026-07-07T12:00:00.000Z"
      }
    };
  }

  if (provider === "resend") {
    const payload = readJsonFixture("tests/fixtures/resend/inbound-gym-freeze-request.json");
    const context = contextFromEnv("resend");
    const externalId = payload.message_id;
    invariant(typeof externalId === "string" && externalId, "Resend fixture message_id required.");
    return {
      kind: "provider.resend.email_received.normalize",
      payloadVersion: 1,
      dedupeKey: `provider.resend.email_received.normalize:${context.tenant_id}:${context.provider_connection_id}:${externalId}`,
      tenantId: context.tenant_id,
      payload: {
        context,
        payload_ref: "fixture/tests/fixtures/resend/inbound-gym-freeze-request.json",
        provider_payload: payload,
        received_at: "2026-07-07T15:26:00.000Z"
      }
    };
  }

  throw new Error(`Unsupported provider fixture: ${provider}`);
}

async function enqueueJob(pool, job) {
  const result = await pool.query(
    "select (enqueue_job($1, $2::jsonb, $3, $4, $5)).id as id",
    [
      job.kind,
      JSON.stringify(job.payload),
      job.payloadVersion,
      job.dedupeKey,
      job.tenantId
    ]
  );
  return result.rows[0]?.id;
}

export async function enqueueProviderNormalizationFixtures() {
  const connectionString = process.env.OUTPOST_DATABASE_URL;
  invariant(connectionString, "OUTPOST_DATABASE_URL required.");
  assertDatabaseUrl(connectionString);

  const pool = new Pool({ connectionString });
  try {
    const jobs = selectedFixtureKinds().map((kind) => buildFixtureJob(kind));
    const enqueued = [];
    for (const job of jobs) {
      const id = await enqueueJob(pool, job);
      invariant(id, `enqueue_job returned no id for ${job.kind}.`);
      enqueued.push({ id, kind: job.kind, dedupeKey: job.dedupeKey });
    }
    return enqueued;
  } finally {
    await pool.end();
  }
}

async function main() {
  const enqueued = await enqueueProviderNormalizationFixtures();
  console.log("Provider normalization fixture jobs enqueued");
  for (const job of enqueued) {
    console.log(`${job.kind}: ${job.id}`);
  }
  console.log("Drain separately through /api/internal/jobs/drain with the internal token.");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
