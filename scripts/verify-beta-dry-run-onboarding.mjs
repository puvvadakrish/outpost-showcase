#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { readHostedReadinessConfig } from "./hosted-preview-readiness-config.mjs";
import { withNeonApiKey } from "./neon-cli-auth.mjs";
import { runVercelCurl } from "./vercel-curl.mjs";

const config = readHostedReadinessConfig();
const DATABASE_NAME = process.env.OUTPOST_NEON_DATABASE_NAME ?? config.databaseName ?? "neondb";
const ROLE_NAME = process.env.OUTPOST_NEON_ROLE_NAME ?? "neondb_owner";
const APP_ORIGIN = normalizeAppOrigin(process.env.NEXT_PUBLIC_OUTPOST_APP_URL ?? "http://localhost:3000");
const VERCEL_BYPASS_SECRET = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
const ROLLBACK_ONLY = process.env.OUTPOST_BETA_DRY_RUN_ROLLBACK_ONLY === "1";
const KEEP_DATA = process.env.OUTPOST_BETA_DRY_RUN_KEEP_DATA === "1";
const OWNER_EMAIL = normalizeEmail(
  requireEnv(ROLLBACK_ONLY ? "OUTPOST_BETA_DRY_RUN_OWNER_EMAIL" : "OUTPOST_OWNER_BETA_EMAIL")
);
const OWNER_NAME = ROLLBACK_ONLY ? "" : requireEnv("OUTPOST_OWNER_BETA_NAME").trim();
const OWNER_PASSWORD = ROLLBACK_ONLY ? "" : requireEnv("OUTPOST_OWNER_BETA_PASSWORD");
const RUN_ID = normalizeRunId(process.env.OUTPOST_BETA_DRY_RUN_ID ?? `beta_dry_run_${Date.now().toString(36)}`);
const GYM_NAME = normalizeText(
  process.env.OUTPOST_BETA_DRY_RUN_GYM_NAME ?? "Beta Gym",
  "OUTPOST_BETA_DRY_RUN_GYM_NAME",
  80
);
const TENANT_NAME = normalizeText(
  process.env.OUTPOST_BETA_DRY_RUN_TENANT_NAME ?? `${GYM_NAME} Dry Run ${RUN_ID}`,
  "OUTPOST_BETA_DRY_RUN_TENANT_NAME",
  120
);
const TENANT_ID_FOR_ROLLBACK = process.env.OUTPOST_BETA_DRY_RUN_TENANT_ID?.trim();
const EVIDENCE_PATH = normalizeEvidencePath(process.env.OUTPOST_BETA_DRY_RUN_EVIDENCE_PATH);
const SEEDED_TENANT_IDS = ["tenant_acme_fitness", "tenant_crossfit_north"];
const TENANT_OWNED_TABLES_IN_ROLLBACK_ORDER = [
  "task_events",
  "tasks",
  "channel_events",
  "conversations",
  "usage_events",
  "domain_events",
  "support_access_grants",
  "audit_events",
  "source_facts",
  "answer_bank_revisions",
  "answer_bank_entries",
  "handoff_rule_revisions",
  "handoff_rules",
  "notification_destination_revisions",
  "notification_destinations",
  "provider_connections",
  "location_revisions",
  "source_documents",
  "locations",
  "tenant_memberships"
];
const TENANT_ROLLBACK_SQL_STATEMENTS = TENANT_OWNED_TABLES_IN_ROLLBACK_ORDER.flatMap((table) =>
  table === "support_access_grants"
    ? [
        "update audit_events set support_access_grant_id = null where tenant_id = v_tenant_id;",
        "delete from support_access_grants where tenant_id = v_tenant_id;"
      ]
    : [`delete from ${table} where tenant_id = v_tenant_id;`]
);

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
  invariant(normalized.includes("@"), "Dry-run owner email must be an email address.");
  invariant(normalized.length <= 254, "Dry-run owner email must be 254 characters or fewer.");

  return normalized;
}

function normalizeText(value, name, maxLength) {
  const normalized = value.trim();
  invariant(normalized.length > 0, `${name} is required.`);
  invariant(normalized.length <= maxLength, `${name} must be ${maxLength} characters or fewer.`);

  return normalized;
}

function normalizeRunId(value) {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9_]/gu, "_");
  invariant(normalized.length >= 8, "OUTPOST_BETA_DRY_RUN_ID must be at least 8 safe characters.");
  invariant(normalized.length <= 64, "OUTPOST_BETA_DRY_RUN_ID must be 64 characters or fewer.");

  return normalized;
}

function normalizeEvidencePath(rawPath) {
  if (!rawPath?.trim()) {
    return "";
  }

  const evidencePath = rawPath.trim();
  invariant(!evidencePath.includes("\0"), "OUTPOST_BETA_DRY_RUN_EVIDENCE_PATH cannot contain null bytes.");

  const resolvedPath = resolve(evidencePath);
  const repoRelativePath = relative(process.cwd(), resolvedPath);
  const isInsideRepo =
    repoRelativePath.length > 0 && !repoRelativePath.startsWith("..") && !isAbsolute(repoRelativePath);
  const isIgnoredArtifactPath = repoRelativePath === "artifacts" || repoRelativePath.startsWith(`artifacts${sep}`);

  invariant(
    !isInsideRepo || isIgnoredArtifactPath,
    "Repo-local OUTPOST_BETA_DRY_RUN_EVIDENCE_PATH must live under gitignored artifacts/."
  );

  return evidencePath;
}

function normalizeAppOrigin(rawOrigin) {
  let url;

  try {
    url = new URL(rawOrigin);
  } catch {
    throw new Error("NEXT_PUBLIC_OUTPOST_APP_URL must be a valid URL when set.");
  }

  url.pathname = "";
  url.search = "";
  url.hash = "";

  return url.toString().replace(/\/$/u, "");
}

function sqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function assertDryRunSafety() {
  invariant(process.env.NEON_API_KEY, "NEON_API_KEY is required for Beta dry-run onboarding.");
  invariant(config.branchName !== "production", "Refusing Beta dry-run onboarding on Neon production.");
  invariant(
    config.branchName !== "outpost-neon-spike",
    "Refusing Beta dry-run onboarding on the Neon migration spike branch."
  );
  invariant(
    OWNER_EMAIL !== "owner-acme@example.com",
    "Use a throwaway owner email for dry-run onboarding, not the seeded Acme Fitness owner."
  );
  invariant(
    OWNER_EMAIL.includes("+dry-run") || OWNER_EMAIL.endsWith("@owner.outpost.local"),
    "Dry-run owner email must include +dry-run or end with @owner.outpost.local."
  );
  invariant(
    TENANT_NAME.includes(" Dry Run "),
    "OUTPOST_BETA_DRY_RUN_TENANT_NAME must include ' Dry Run '."
  );

  if (!ROLLBACK_ONLY) {
    invariant(OWNER_NAME.length > 0, "OUTPOST_OWNER_BETA_NAME is required.");
    invariant(OWNER_NAME.length <= 120, "OUTPOST_OWNER_BETA_NAME must be 120 characters or fewer.");
    invariant(OWNER_PASSWORD.length >= 12, "OUTPOST_OWNER_BETA_PASSWORD must be at least 12 characters.");
    invariant(
      OWNER_PASSWORD !== "outpost-local-password",
      "Refusing to use the local seed password for Beta dry-run onboarding."
    );
  }
}

function runCommand(args, label) {
  const result = spawnSync(args[0], args.slice(1), {
    cwd: process.cwd(),
    encoding: "utf8",
    env: process.env,
    stdio: ["ignore", "inherit", "pipe"]
  });

  if (result.status !== 0) {
    throw new Error(`${label} failed.\n${result.stderr}`);
  }
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

function parsePsqlScalar(output) {
  return output
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("INFO:"))[0];
}

function runPsqlScript(sql) {
  const tempDir = mkdtempSync(join(tmpdir(), "outpost-beta-dry-run-"));
  const scriptPath = join(tempDir, "proof.sql");

  try {
    writeFileSync(scriptPath, sql);
    return runNeonPsql(["-v", "ON_ERROR_STOP=1", "-f", scriptPath]);
  } finally {
    rmSync(tempDir, { force: true, recursive: true });
  }
}

function writeHandoffEvidence({ checks, rollback, status, tenantId }) {
  if (!EVIDENCE_PATH) {
    return;
  }

  try {
    const evidence = {
      app_origin: APP_ORIGIN,
      checks,
      generated_at: new Date().toISOString(),
      live_provider_gate: "blocked",
      mode: {
        keep_data: KEEP_DATA,
        rollback_only: ROLLBACK_ONLY,
        vercel_curl: process.env.OUTPOST_USE_VERCEL_CURL === "1"
      },
      gym_name: GYM_NAME,
      neon: {
        branch_name: config.branchName,
        database_name: DATABASE_NAME,
        project_id: config.projectId
      },
      owner_email: OWNER_EMAIL,
      rollback,
      run_id: RUN_ID,
      status,
      tenant: {
        id: tenantId,
        name: TENANT_NAME
      }
    };

    mkdirSync(dirname(EVIDENCE_PATH), { recursive: true });
    writeFileSync(EVIDENCE_PATH, `${JSON.stringify(evidence, null, 2)}\n`);
    console.log(`Evidence: wrote non-secret Beta dry-run summary to ${EVIDENCE_PATH}`);
  } catch (error) {
    console.warn(`Evidence: unable to write non-secret Beta dry-run summary: ${errorMessage(error)}`);
  }
}

function splitSetCookie(header) {
  return header ? header.split(/,(?=\s*[^;,]+=)/u).map((value) => value.trim()) : [];
}

function extractSessionCookie(header) {
  const raw = splitSetCookie(header).find((value) => value.startsWith("__Secure-neon-auth.session_token="));

  if (!raw) {
    throw new Error("Neon Auth did not return a session cookie for the dry-run owner.");
  }

  const [nameValue] = raw.split(";");
  const index = nameValue.indexOf("=");

  return {
    name: nameValue.slice(0, index),
    value: nameValue.slice(index + 1)
  };
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

  return {
    body,
    headers: response.headers,
    ok: response.ok,
    status: response.status
  };
}

async function signInDryRunOwner() {
  const response = await authFetch("/sign-in/email", {
    body: JSON.stringify({ email: OWNER_EMAIL, password: OWNER_PASSWORD }),
    headers: { "Content-Type": "application/json" },
    method: "POST"
  });

  if (!response.ok) {
    throw new Error(`Unable to sign in dry-run owner ${OWNER_EMAIL}: ${JSON.stringify(response.body)}`);
  }

  const cookie = extractSessionCookie(response.headers.get("set-cookie"));
  const upstreamCookie = `${cookie.name}=${encodeURIComponent(decodeURIComponent(cookie.value))}`;
  const tokenResponse = await authFetch("/token", {
    headers: {
      Cookie: upstreamCookie
    }
  });

  if (!tokenResponse.ok || !tokenResponse.body?.token) {
    throw new Error(`Unable to fetch JWT for dry-run owner ${OWNER_EMAIL}: ${JSON.stringify(tokenResponse.body)}`);
  }

  return {
    email: OWNER_EMAIL,
    localCookie: `outpost_neon_auth_session_token=${encodeURIComponent(
      decodeURIComponent(cookie.value)
    )}; outpost_neon_auth_session_cookie_name=${encodeURIComponent(cookie.name)}`,
    token: tokenResponse.body.token
  };
}

async function dataApiRead(path, token) {
  const response = await fetch(`${config.neonDataApiUrl}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`
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

  if (!response.ok) {
    throw new Error(`Data API ${path} failed: ${response.status} ${JSON.stringify(body)}`);
  }

  return body;
}

async function dataApiRpc(functionName, token, body) {
  const response = await fetch(`${config.neonDataApiUrl}/rpc/${functionName}`, {
    body: JSON.stringify(body),
    headers: {
      Authorization: `Bearer ${token}`,
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

function protectionHeaders() {
  return VERCEL_BYPASS_SECRET
    ? {
        "x-vercel-protection-bypass": VERCEL_BYPASS_SECRET,
        "x-vercel-set-bypass-cookie": "true"
      }
    : {};
}

async function routeSmoke(session, route, expectedText) {
  let lastStatus = 0;
  let lastMissing = expectedText;

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const { html, ok, status } =
      process.env.OUTPOST_USE_VERCEL_CURL === "1"
        ? routeSmokeWithVercelCurl(session, route)
        : await routeSmokeWithFetch(session, route);
    const missing = expectedText.filter((text) => !html.includes(text));

    if (ok && missing.length === 0) {
      return;
    }

    lastStatus = status;
    lastMissing = missing;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`${route} smoke failed: status=${lastStatus} missing=${lastMissing.join(", ")}`);
}

async function routeSmokeWithFetch(session, route) {
  const response = await fetch(`${APP_ORIGIN}${route}`, {
    headers: {
      Cookie: session.localCookie,
      ...protectionHeaders()
    },
    redirect: "manual"
  });
  const html = await response.text();

  return {
    html,
    ok: response.ok,
    status: response.status
  };
}

function routeSmokeWithVercelCurl(session, route) {
  const args = [
    "curl",
    route,
    "--deployment",
    APP_ORIGIN,
    "--",
    "--fail",
    "--header",
    `Cookie: ${session.localCookie}`
  ];

  for (const [name, value] of Object.entries(protectionHeaders())) {
    args.push("--header", `${name}: ${value}`);
  }

  const result = runVercelCurl(args.slice(1));

  return {
    html: result.stdout,
    ok: result.status === 0,
    status: result.status === 0 ? 200 : result.status
  };
}

async function assertAppServerAvailable() {
  if (process.env.OUTPOST_USE_VERCEL_CURL === "1") {
    const args = ["curl", "/", "--deployment", APP_ORIGIN, "--", "--fail"];

    for (const [name, value] of Object.entries(protectionHeaders())) {
      args.push("--header", `${name}: ${value}`);
    }

    const result = runVercelCurl(args.slice(1));

    if (result.status === 0) {
      return;
    }

    throw new Error(
      `Protected Vercel Preview is required for Beta dry-run onboarding. vercel curl exited ${result.status}`
    );
  }

  const response = await fetch(APP_ORIGIN, {
    headers: protectionHeaders()
  });

  if (!response.ok) {
    throw new Error(`Outpost app server returned status ${response.status} at ${APP_ORIGIN}.`);
  }
}

function assertRowCount(rows, description) {
  if (!Array.isArray(rows) || rows.length < 1) {
    throw new Error(`${description}: ${JSON.stringify(rows)}`);
  }
}

function assertLiveProvidersBlocked() {
  runPsqlScript(`
    do $$
    begin
      if exists (
        select 1 from provider_connections
        where status not in ('not_configured', 'disabled', 'pending_review')
           or secret_ref is not null
           or external_account_label is not null
      ) then
        raise exception 'Beta dry-run onboarding unexpectedly found a live provider';
      end if;
    end $$;
  `);
}

function rollbackDryRunRows({ tenantId }) {
  invariant(tenantId, "OUTPOST_BETA_DRY_RUN_TENANT_ID is required for rollback.");

  runPsqlScript(`
    do $$
    declare
      v_tenant_id text := ${sqlLiteral(tenantId)};
      v_owner_email citext := ${sqlLiteral(OWNER_EMAIL)}::citext;
      v_owner_user_id text;
      v_tenant_name text;
    begin
      select name into v_tenant_name
        from tenants
        where id = v_tenant_id
        for update;

      if v_tenant_name is null then
        raise exception 'dry-run tenant % was not found for rollback', v_tenant_id;
      end if;

      if v_tenant_id = any (${sqlLiteral(`{${SEEDED_TENANT_IDS.join(",")}}`)}::text[]) then
        raise exception 'refusing to roll back seeded tenant %', v_tenant_id;
      end if;

      if position(' Dry Run ' in v_tenant_name) = 0 then
        raise exception 'refusing to roll back tenant % with unsafe name %', v_tenant_id, v_tenant_name;
      end if;

      select app_users.id into v_owner_user_id
        from users app_users
        join tenant_memberships memberships
          on memberships.user_id = app_users.id
         and memberships.tenant_id = v_tenant_id
        where app_users.email = v_owner_email
          and memberships.role = 'owner'
          and memberships.invite_status = 'active'
        for update of app_users, memberships;

      if v_owner_user_id is null then
        raise exception 'dry-run owner email % is not the active owner of tenant %', v_owner_email, v_tenant_id;
      end if;

      if exists (
        select 1 from tenant_memberships
        where user_id = v_owner_user_id
          and tenant_id <> v_tenant_id
      ) then
        raise exception 'refusing to roll back owner % because the user has memberships outside tenant %',
          v_owner_email,
          v_tenant_id;
      end if;

      ${TENANT_ROLLBACK_SQL_STATEMENTS.join("\n      ")}
      delete from tenants where id = v_tenant_id;

      if v_owner_user_id is not null and not exists (
        select 1 from tenant_memberships where user_id = v_owner_user_id
      ) then
        delete from users where id = v_owner_user_id;
      end if;

      delete from owner_beta_access_grants where email = v_owner_email;
      delete from neon_auth."user" where lower(email) = lower(v_owner_email::text);
    end $$;
  `);
}

function assertRollbackClean({ tenantId }) {
  const tenantOwnedRowCountSql = TENANT_OWNED_TABLES_IN_ROLLBACK_ORDER.map(
    (table) => `(select count(*) from ${table} where tenant_id = ${sqlLiteral(tenantId)})`
  ).join("\n          + ");
  const count = Number(
    parsePsqlScalar(
      runNeonPsql([
        "-t",
        "-A",
        "-c",
        `
          select
            ${tenantOwnedRowCountSql}
          + (select count(*) from tenants where id = ${sqlLiteral(tenantId)})
          + (select count(*) from users where email = ${sqlLiteral(OWNER_EMAIL)}::citext)
          + (select count(*) from owner_beta_access_grants where email = ${sqlLiteral(OWNER_EMAIL)}::citext)
          + (select count(*) from neon_auth."user" where lower(email) = ${sqlLiteral(OWNER_EMAIL)})
        `
      ])
    )
  );

  if (count !== 0) {
    throw new Error(`Beta dry-run rollback left ${count} owner or tenant rows behind.`);
  }
}

async function runDryRun() {
  let rollbackTenantId = null;
  let rollbackComplete = false;
  let originalError = null;

  runCommand(["npm", "run", "hosted:readiness"], "Hosted readiness");
  runCommand(["npm", "run", "beta:operator:owner-access"], "Operator-provisioned owner access");
  await assertAppServerAvailable();

  console.log("Beta dry-run onboarding handoff");
  console.log(`Project: ${config.projectId}`);
  console.log(`Branch: ${config.branchName}`);
  console.log(`Gym: ${GYM_NAME}`);
  console.log(`Owner: ${OWNER_EMAIL}`);
  console.log(`Tenant: ${TENANT_NAME}`);
  console.log("Mode: protected Vercel Preview + hosted Neon Auth/Data API, no live providers\n");

  try {
    const owner = await signInDryRunOwner();
    const grantVisible = await dataApiRpc("has_active_owner_beta_access", owner.token, {
      p_owner_email: OWNER_EMAIL
    });

    if (grantVisible !== true) {
      throw new Error(
        `Dry-run owner beta grant was not visible to the signed-in owner: ${JSON.stringify(grantVisible)}`
      );
    }

    const bootstrap = await dataApiRpc("bootstrap_owner_tenant", owner.token, {
      p_location_address: "Beta dry-run address, operator proof only",
      p_location_name: `${GYM_NAME} Dry Run Front Desk`,
      p_owner_email: OWNER_EMAIL,
      p_owner_name: OWNER_NAME,
      p_public_phone: null,
      p_tenant_name: TENANT_NAME,
      p_timezone: "America/Chicago"
    });
    const bootstrapRow = Array.isArray(bootstrap) ? bootstrap[0] : bootstrap;

    if (!bootstrapRow?.tenant_id || !bootstrapRow?.location_id || bootstrapRow.tenant_name !== TENANT_NAME) {
      throw new Error(`Owner bootstrap returned an unexpected row: ${JSON.stringify(bootstrap)}`);
    }

    rollbackTenantId = bootstrapRow.tenant_id;
    console.log(`Owner bootstrap: ${bootstrapRow.tenant_id} / ${bootstrapRow.location_id}`);

    const sourceDocumentId = `source_${RUN_ID}`;
    const sourceDocument = await dataApiRpc("upsert_manual_source_document", owner.token, {
      p_facts: [
        {
          confidence: 0.94,
          topic: `beta dry-run staffed hours ${RUN_ID}`,
          value: "Dry-run proof fact: front-desk hours require owner review before customer handoff."
        },
        {
          confidence: 0.89,
          conflictGroup: `beta-dry-run-${RUN_ID}`,
          topic: `beta dry-run tour handoff ${RUN_ID}`,
          value: "Dry-run proof conflict: tour questions must become staff tasks until approved."
        }
      ],
      p_label: `Beta dry-run source ${RUN_ID}`,
      p_location_id: bootstrapRow.location_id,
      p_source_document_id: sourceDocumentId,
      p_tenant_id: bootstrapRow.tenant_id
    });

    if (sourceDocument?.id !== sourceDocumentId || sourceDocument?.facts_found !== 2) {
      throw new Error(`Dry-run manual source upsert returned an unexpected row: ${JSON.stringify(sourceDocument)}`);
    }

    const proposal = await dataApiRpc("propose_answers_from_manual_source", owner.token, {
      p_note: `Beta dry-run owner review ${RUN_ID}`,
      p_source_document_id: sourceDocumentId,
      p_tenant_id: bootstrapRow.tenant_id
    });
    const proposalRow = Array.isArray(proposal) ? proposal[0] : proposal;

    if (!proposalRow || proposalRow.proposed_count !== 2 || proposalRow.conflict_count !== 1) {
      throw new Error(`Dry-run answer proposal staging returned an unexpected row: ${JSON.stringify(proposal)}`);
    }

    const proposedAnswers = await dataApiRead(
      `/answer_bank_entries?select=id,approval_status,topic,source_document_id&tenant_id=eq.${bootstrapRow.tenant_id}&source_document_id=eq.${sourceDocumentId}&order=created_at.asc`,
      owner.token
    );
    assertRowCount(proposedAnswers, "Dry-run answer proposals were not visible to the owner");

    const taskSourceAnswer =
      proposedAnswers.find((answer) => answer.approval_status === "draft") ?? proposedAnswers[0];
    const createdTask = await dataApiRpc("create_task_from_answer_bank_entry", owner.token, {
      p_answer_bank_entry_id: taskSourceAnswer.id,
      p_tenant_id: bootstrapRow.tenant_id
    });

    if (!createdTask?.id || createdTask.tenant_id !== bootstrapRow.tenant_id || createdTask.status !== "new") {
      throw new Error(`Dry-run answer-derived task returned an unexpected row: ${JSON.stringify(createdTask)}`);
    }

    const taskRows = await dataApiRead(
      `/tasks?select=id,status,summary&tenant_id=eq.${bootstrapRow.tenant_id}&id=eq.${createdTask.id}`,
      owner.token
    );
    assertRowCount(taskRows, "Dry-run task was not visible to the owner through tenant RLS");

    await routeSmoke(owner, "/owner", [
      "Owner workspace",
      TENANT_NAME,
      "Backend-backed",
      "hosted Neon proof must stay current"
    ]);

    assertLiveProvidersBlocked();
    console.log("Owner workflow: manual source facts staged into answer review and one staff task.");
    console.log("Preview smoke: /owner rendered the dry-run tenant through the protected deployment.");
    console.log("Live-provider gates remain blocked.");

    if (KEEP_DATA) {
      writeHandoffEvidence({
        checks: [
          "hosted_readiness",
          "operator_owner_access",
          "owner_beta_access_visible",
          "owner_bootstrap",
          "manual_source_to_answer_review",
          "answer_review_to_staff_task",
          "protected_preview_owner_route",
          "live_provider_gate_blocked"
        ],
        rollback: "retained_for_browser_smoke",
        status: "passed_retained_data",
        tenantId: bootstrapRow.tenant_id
      });
      console.log("\nDry-run data retained for browser smoke or manual handoff rehearsal.");
      return;
    }

    rollbackDryRunRows({ tenantId: bootstrapRow.tenant_id });
    assertRollbackClean({ tenantId: bootstrapRow.tenant_id });
    rollbackComplete = true;
    writeHandoffEvidence({
      checks: [
        "hosted_readiness",
        "operator_owner_access",
        "owner_beta_access_visible",
        "owner_bootstrap",
        "manual_source_to_answer_review",
        "answer_review_to_staff_task",
        "protected_preview_owner_route",
        "live_provider_gate_blocked",
        "automatic_rollback_clean"
      ],
      rollback: "automatic_cleanup_complete",
      status: "passed_with_automatic_rollback",
      tenantId: bootstrapRow.tenant_id
    });
    console.log("Rollback: dry-run tenant, owner grant, app user, and Neon Auth user were removed.");
  } catch (error) {
    originalError = error;
    throw error;
  } finally {
    if (rollbackTenantId && !KEEP_DATA && !rollbackComplete) {
      console.log("\nDry-run interrupted after bootstrap; attempting rollback before exiting.");
      try {
        rollbackDryRunRows({ tenantId: rollbackTenantId });
        assertRollbackClean({ tenantId: rollbackTenantId });
        rollbackComplete = true;
        console.log("Rollback: dry-run tenant, owner grant, app user, and Neon Auth user were removed after failure.");
      } catch (rollbackError) {
        console.error(`Rollback after failure also failed: ${errorMessage(rollbackError)}`);

        if (!originalError) {
          throw rollbackError;
        }
      }
    } else if (rollbackTenantId && KEEP_DATA && !rollbackComplete) {
      console.log(
        `\nDry-run data retained. Roll back with: OUTPOST_BETA_DRY_RUN_ROLLBACK_ONLY=1 OUTPOST_BETA_DRY_RUN_TENANT_ID=${rollbackTenantId} OUTPOST_BETA_DRY_RUN_OWNER_EMAIL=${OWNER_EMAIL} npm run beta:dry-run:onboarding`
      );
    }
  }
}

async function main() {
  assertDryRunSafety();

  if (ROLLBACK_ONLY) {
    rollbackDryRunRows({ tenantId: TENANT_ID_FOR_ROLLBACK });
    assertRollbackClean({ tenantId: TENANT_ID_FOR_ROLLBACK });
    assertLiveProvidersBlocked();
    writeHandoffEvidence({
      checks: ["rollback_only_cleanup", "live_provider_gate_blocked"],
      rollback: "rollback_only_cleanup_complete",
      status: "rollback_only_cleaned",
      tenantId: TENANT_ID_FOR_ROLLBACK
    });
    console.log("Rollback-only: dry-run tenant, owner grant, app user, and Neon Auth user were removed.");
    return;
  }

  await runDryRun();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
