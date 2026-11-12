#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { spawnSync } from "node:child_process";
import { readHostedReadinessConfig } from "./hosted-preview-readiness-config.mjs";
import { withNeonApiKey } from "./neon-cli-auth.mjs";

const config = readHostedReadinessConfig();
const DATABASE_NAME = process.env.OUTPOST_NEON_DATABASE_NAME ?? config.databaseName ?? "neondb";
const ROLE_NAME = process.env.OUTPOST_NEON_ROLE_NAME ?? "neondb_owner";
const OWNER_EMAIL = normalizeOptionalEmail(process.env.OUTPOST_BETA_READINESS_OWNER_EMAIL);
const EVIDENCE_PATH = normalizeOptionalArtifactPath(
  process.env.OUTPOST_BETA_READINESS_EVIDENCE_PATH,
  "OUTPOST_BETA_READINESS_EVIDENCE_PATH"
);
const PACKET_PATH = normalizeOptionalArtifactPath(
  process.env.OUTPOST_BETA_HANDOFF_PACKET_PATH,
  "OUTPOST_BETA_HANDOFF_PACKET_PATH"
);
const COMPLETION_PATH = normalizeOptionalArtifactPath(
  process.env.OUTPOST_BETA_HANDOFF_COMPLETION_PATH,
  "OUTPOST_BETA_HANDOFF_COMPLETION_PATH"
);
const SEEDED_TENANT_IDS = ["tenant_acme_fitness", "tenant_crossfit_north"];

function invariant(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function normalizeOptionalEmail(value) {
  if (!value?.trim()) {
    return "";
  }

  const normalized = value.trim().toLowerCase();
  invariant(/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(normalized), "OUTPOST_BETA_READINESS_OWNER_EMAIL must be an email address.");
  assertNoSecretShapedValue(normalized, "OUTPOST_BETA_READINESS_OWNER_EMAIL");

  return normalized;
}

function normalizeOptionalArtifactPath(rawPath, label) {
  if (!rawPath?.trim()) {
    return "";
  }

  const artifactPath = rawPath.trim();
  invariant(!artifactPath.includes("\0"), `${label} cannot contain null bytes.`);
  assertNoSecretShapedValue(artifactPath, label);

  const resolvedPath = resolve(artifactPath);
  const repoRelativePath = relative(process.cwd(), resolvedPath);
  const isInsideRepo =
    repoRelativePath.length > 0 && !repoRelativePath.startsWith("..") && !isAbsolute(repoRelativePath);
  const isIgnoredArtifactPath = repoRelativePath === "artifacts" || repoRelativePath.startsWith(`artifacts${sep}`);

  invariant(!isInsideRepo || isIgnoredArtifactPath, `${label} must live under gitignored artifacts/ when repo-local.`);

  return artifactPath;
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

    invariant(!secretKey, `${label} contains a secret-shaped key at ${path}.`);
    assertNoSecretShapedKeys(nestedValue, label, [...trail, key]);
  }
}

function sqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
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

  return payload ? JSON.parse(payload) : [];
}

function assertOperatorSafety() {
  invariant(process.env.NEON_API_KEY, "NEON_API_KEY is required for beta owner readiness inspection.");
  invariant(config.branchName !== "production", "Refusing beta owner readiness inspection on Neon production.");
  invariant(
    config.branchName !== "outpost-neon-spike",
    "Refusing beta owner readiness inspection on the Neon migration spike branch."
  );
}

function buildGrantSourceSql() {
  if (OWNER_EMAIL) {
    return `
      select
        coalesce(grants.email, requested.email) as email,
        grants.id,
        grants.display_name,
        grants.status,
        nullif(grants.note, '') is not null as note_present,
        grants.created_at,
        grants.updated_at
      from (select ${sqlLiteral(OWNER_EMAIL)}::citext as email) requested
      left join owner_beta_access_grants grants
        on grants.email = requested.email
    `;
  }

  return `
    select
      grants.email,
      grants.id,
      grants.display_name,
      grants.status,
      nullif(grants.note, '') is not null as note_present,
      grants.created_at,
      grants.updated_at
    from owner_beta_access_grants grants
    order by grants.updated_at desc, grants.email asc
    limit 25
  `;
}

function readinessSql() {
  const seededTenantIds = `array[${SEEDED_TENANT_IDS.map((id) => sqlLiteral(id)).join(", ")}]::text[]`;

  return `
    begin transaction read only;

    with target_grants as (
      ${buildGrantSourceSql()}
    ),
    owner_rows as (
      select
        lower(target_grants.email::text) as owner_email,
        target_grants.id as grant_id,
        coalesce(target_grants.status::text, 'missing') as grant_status,
        target_grants.display_name,
        coalesce(target_grants.note_present, false) as note_present,
        target_grants.created_at as grant_created_at,
        target_grants.updated_at as grant_updated_at,
        app_users.id as user_id,
        app_users.external_auth_id is not null as auth_linked,
        app_users.created_at as app_user_created_at,
        memberships.tenant_id,
        memberships.invite_status::text as owner_membership_status,
        tenants.name as tenant_name,
        tenants.status::text as tenant_status,
        tenants.billing_mode::text as billing_mode,
        tenants.created_at as tenant_created_at,
        (
          select count(*)
          from tenant_memberships all_memberships
          where all_memberships.user_id = app_users.id
        ) as owner_membership_count
      from target_grants
      left join users app_users
        on lower(app_users.email::text) = lower(target_grants.email::text)
      left join tenant_memberships memberships
        on memberships.user_id = app_users.id
       and memberships.role = 'owner'
       and memberships.invite_status = 'active'
      left join tenants
        on tenants.id = memberships.tenant_id
    )
    select coalesce(jsonb_agg(jsonb_build_object(
      'owner_email', owner_email,
      'grant', jsonb_build_object(
        'present', grant_id is not null,
        'status', grant_status,
        'display_name_present', nullif(display_name, '') is not null,
        'note_present', note_present,
        'created_at', grant_created_at,
        'updated_at', grant_updated_at
      ),
      'owner_account', jsonb_build_object(
        'app_user_present', user_id is not null,
        'auth_linked', coalesce(auth_linked, false),
        'created_at', app_user_created_at
      ),
      'tenant_bootstrap', jsonb_build_object(
        'tenant_id', tenant_id,
        'tenant_name', tenant_name,
        'tenant_status', tenant_status,
        'billing_mode', billing_mode,
        'owner_membership_status', owner_membership_status,
        'created_at', tenant_created_at,
        'locations_count', coalesce((select count(*) from locations where locations.tenant_id = owner_rows.tenant_id), 0),
        'manual_sources_count', coalesce((select count(*) from source_documents where source_documents.tenant_id = owner_rows.tenant_id and source_type = 'manual'), 0),
        'review_answers_count', coalesce((select count(*) from answer_bank_entries where answer_bank_entries.tenant_id = owner_rows.tenant_id and approval_status in ('draft', 'conflict')), 0),
        'approved_answers_count', coalesce((select count(*) from answer_bank_entries where answer_bank_entries.tenant_id = owner_rows.tenant_id and approval_status = 'approved'), 0),
        'open_tasks_count', coalesce((select count(*) from tasks where tasks.tenant_id = owner_rows.tenant_id and status in ('new', 'needs_human', 'in_progress')), 0),
        'terminal_tasks_count', coalesce((select count(*) from tasks where tasks.tenant_id = owner_rows.tenant_id and status in ('done', 'ignored')), 0),
        'audit_events_count', coalesce((select count(*) from audit_events where audit_events.tenant_id = owner_rows.tenant_id), 0)
      ),
      'provider_gate', jsonb_build_object(
        'state', case
          when coalesce((select count(*) from provider_connections where provider_connections.tenant_id = owner_rows.tenant_id and (status not in ('not_configured', 'disabled', 'pending_review') or secret_ref is not null or external_account_label is not null)), 0) = 0
            then 'blocked'
          else 'attention'
        end,
        'unexpected_live_records', coalesce((select count(*) from provider_connections where provider_connections.tenant_id = owner_rows.tenant_id and (status not in ('not_configured', 'disabled', 'pending_review') or secret_ref is not null or external_account_label is not null)), 0)
      ),
      'rollback_readiness', jsonb_build_object(
        'state', case
          when tenant_id is null then 'not_applicable'
          when tenant_id = any (${seededTenantIds}) then 'blocked_seeded_tenant'
          when tenant_name not like '% Dry Run %' then 'manual_review_required'
          when owner_membership_count <> 1 then 'manual_review_required'
          else 'dry_run_rollback_ready'
        end,
        'reason', case
          when tenant_id is null then 'No tenant bootstrap is present for this beta owner.'
          when tenant_id = any (${seededTenantIds}) then 'Seeded tenants are never rollback targets.'
          when tenant_name not like '% Dry Run %' then 'Non-dry-run customer tenants require explicit manual review before rollback.'
          when owner_membership_count <> 1 then 'Owner has memberships outside this tenant, so automatic rollback is unsafe.'
          else 'Disposable Dry Run tenant shape matches the guarded rollback path.'
        end
      )
    ) order by owner_email, tenant_id), '[]'::jsonb)::text
    from owner_rows;

    commit;
  `;
}

function queryReadinessRows() {
  return parsePsqlJson(runNeonPsql(["-t", "-A", "-q", "-c", readinessSql()]));
}

function artifactStatus(path, kind) {
  if (!path) {
    return {
      kind,
      path_provided: false,
      status: "not_provided"
    };
  }

  if (!existsSync(path)) {
    return {
      kind,
      path,
      path_provided: true,
      status: "missing"
    };
  }

  const content = readFileSync(path, "utf8");
  assertNoSecretShapedValue(content, `${kind} artifact`);

  return {
    kind,
    path,
    path_provided: true,
    status: "present",
    bytes: Buffer.byteLength(content)
  };
}

function buildReport(rows) {
  return {
    generated_at: new Date().toISOString(),
    mode: OWNER_EMAIL ? "single_owner" : "grant_ledger",
    neon: {
      branch_name: config.branchName,
      database_name: DATABASE_NAME,
      project_id: config.projectId
    },
    filters: {
      owner_email: OWNER_EMAIL || null
    },
    rows,
    artifacts: {
      packet: artifactStatus(PACKET_PATH, "beta_owner_handoff_packet"),
      completion: artifactStatus(COMPLETION_PATH, "beta_owner_handoff_completion")
    },
    gates: {
      live_providers: rows.every((row) => row.provider_gate?.state === "blocked") ? "blocked" : "attention",
      self_serve: "blocked",
      invite_delivery: "blocked",
      notifications: "blocked",
      phone_email_providers: "blocked",
      billing_pos_member_ledger: "blocked"
    },
    non_goals: [
      "public_self_signup",
      "invite_delivery",
      "notification_sending",
      "phone_provider_activation",
      "email_provider_activation",
      "billing",
      "pos",
      "access_control",
      "member_ledger_writes"
    ]
  };
}

function writeEvidence(report) {
  if (!EVIDENCE_PATH) {
    return;
  }

  mkdirSync(dirname(EVIDENCE_PATH), { recursive: true });
  writeFileSync(EVIDENCE_PATH, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Evidence: wrote non-secret beta owner readiness summary to ${EVIDENCE_PATH}`);
}

function printReport(report) {
  console.log("Outpost beta owner readiness");
  console.log(`Project: ${report.neon.project_id}`);
  console.log(`Branch: ${report.neon.branch_name}`);
  console.log(`Mode: ${report.mode}`);
  console.log("Scope: read-only hosted Neon inspection, no live providers\n");

  if (report.rows.length === 0) {
    console.log("No beta owner grants found.");
  }

  for (const row of report.rows) {
    console.log(`Owner: ${row.owner_email}`);
    console.log(`  Grant: ${row.grant.status}${row.grant.present ? "" : " (missing)"}`);
    console.log(`  Account: app_user=${row.owner_account.app_user_present ? "yes" : "no"} auth_linked=${row.owner_account.auth_linked ? "yes" : "no"}`);
    console.log(
      `  Tenant: ${row.tenant_bootstrap.tenant_name ?? "none"}${row.tenant_bootstrap.tenant_id ? ` (${row.tenant_bootstrap.tenant_id})` : ""}`
    );
    console.log(
      `  Workflow: locations=${row.tenant_bootstrap.locations_count} manual_sources=${row.tenant_bootstrap.manual_sources_count} review_answers=${row.tenant_bootstrap.review_answers_count} open_tasks=${row.tenant_bootstrap.open_tasks_count}`
    );
    console.log(
      `  Gates: providers=${row.provider_gate.state} unexpected_live_records=${row.provider_gate.unexpected_live_records}`
    );
    console.log(`  Rollback: ${row.rollback_readiness.state} - ${row.rollback_readiness.reason}`);
  }

  console.log("\nArtifacts:");
  console.log(`  Packet: ${report.artifacts.packet.status}`);
  console.log(`  Completion: ${report.artifacts.completion.status}`);
  console.log("\nBlocked product gates: self-serve, invite delivery, notifications, phone/email providers, billing, POS, access control, member-ledger writes.");
}

function main() {
  assertOperatorSafety();
  const report = buildReport(queryReadinessRows());

  assertNoSecretShapedKeys(report, "beta owner readiness report");
  assertNoSecretShapedValue(JSON.stringify(report), "beta owner readiness report");
  printReport(report);
  writeEvidence(report);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
