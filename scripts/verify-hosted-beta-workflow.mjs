#!/usr/bin/env node

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { withNeonApiKey } from "./neon-cli-auth.mjs";
import { runVercelCurl } from "./vercel-curl.mjs";

// Hosted beta workflow proof builds on hosted readiness. That verifier owns
// branch/Auth/Data API URL matching, seed Auth users, seed SQL, tenant RLS read
// proof, one owner answer mutation, and cross-tenant mutation denial.

const PROJECT_ID = process.env.OUTPOST_NEON_PROJECT_ID;
const BRANCH_NAME = process.env.OUTPOST_NEON_BRANCH_NAME;
const DATABASE_NAME = process.env.OUTPOST_NEON_DATABASE_NAME ?? "neondb";
const ROLE_NAME = process.env.OUTPOST_NEON_ROLE_NAME ?? "neondb_owner";
const APP_ORIGIN = process.env.NEXT_PUBLIC_OUTPOST_APP_URL ?? "http://localhost:3000";
const VERCEL_BYPASS_SECRET = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
const AUTH_URL = requireEnv("NEXT_PUBLIC_NEON_AUTH_URL");
const DATA_API_URL = requireEnv("NEXT_PUBLIC_NEON_DATA_API_URL");
const SEED_PASSWORD = requireEnv("OUTPOST_NEON_SEED_PASSWORD");
const TENANT_ID = "tenant_acme_fitness";
const LOCATION_ID = "loc_acme_main";
const OWNER_EMAIL = "owner-acme@example.com";
const RUN_ID = `hosted_beta_${Date.now().toString(36)}`;
const STAFF_EMAIL = `${RUN_ID}@staff.outpost.local`;
const STAFF_NAME = `Hosted Beta Staff ${RUN_ID}`;
const BLOCKED_OWNER_EMAIL = `${RUN_ID}@owner.outpost.local`;
const SOURCE_DOCUMENT_ID = `source_${RUN_ID}`;
const SOURCE_LABEL = `Hosted beta manual source ${RUN_ID}`;

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required.`);
  }

  return value;
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

function shellQuote(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function runNeonPsql(args) {
  const result = spawnSync(
    "neon",
    withNeonApiKey([
      "connection-string",
      BRANCH_NAME,
      "--project-id",
      PROJECT_ID,
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
      encoding: "utf8"
    }
  );

  if (result.status !== 0) {
    throw new Error([result.stdout, result.stderr].filter(Boolean).join("\n"));
  }

  return result.stdout;
}

function parsePsqlScalar(output) {
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("INFO:"))[0];
}

function runPsqlScript(sql) {
  const tempDir = mkdtempSync(join(tmpdir(), "outpost-hosted-beta-"));
  const scriptPath = join(tempDir, "proof.sql");

  try {
    writeFileSync(scriptPath, sql);
    return runNeonPsql(["-v", "ON_ERROR_STOP=1", "-f", scriptPath]);
  } finally {
    rmSync(tempDir, { force: true, recursive: true });
  }
}

function splitSetCookie(header) {
  return header ? header.split(/,(?=\s*[^;,]+=)/u).map((value) => value.trim()) : [];
}

function extractSessionCookie(header) {
  const raw = splitSetCookie(header).find((value) => value.startsWith("__Secure-neon-auth.session_token="));

  if (!raw) {
    throw new Error("Neon Auth did not return a session cookie.");
  }

  const [nameValue] = raw.split(";");
  const index = nameValue.indexOf("=");

  return {
    name: nameValue.slice(0, index),
    value: nameValue.slice(index + 1)
  };
}

async function authFetch(path, init = {}) {
  const response = await fetch(`${AUTH_URL}${path}`, {
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

async function signIn(email) {
  const response = await authFetch("/sign-in/email", {
    body: JSON.stringify({ email, password: SEED_PASSWORD }),
    headers: { "Content-Type": "application/json" },
    method: "POST"
  });

  if (!response.ok) {
    throw new Error(`Unable to sign in ${email}: ${JSON.stringify(response.body)}`);
  }

  const cookie = extractSessionCookie(response.headers.get("set-cookie"));
  const upstreamCookie = `${cookie.name}=${encodeURIComponent(decodeURIComponent(cookie.value))}`;
  const tokenResponse = await authFetch("/token", {
    headers: {
      Cookie: upstreamCookie
    }
  });

  if (!tokenResponse.ok || !tokenResponse.body?.token) {
    throw new Error(`Unable to fetch JWT for ${email}: ${JSON.stringify(tokenResponse.body)}`);
  }

  return {
    cookie,
    email,
    localCookie: `outpost_neon_auth_session_token=${encodeURIComponent(
      decodeURIComponent(cookie.value)
    )}; outpost_neon_auth_session_cookie_name=${encodeURIComponent(cookie.name)}`,
    token: tokenResponse.body.token
  };
}

async function signUpVerifiedUser(email, name) {
  const signUp = await authFetch("/sign-up/email", {
    body: JSON.stringify({
      callbackURL: `${APP_ORIGIN}/auth/callback`,
      email,
      name,
      password: SEED_PASSWORD
    }),
    headers: { "Content-Type": "application/json" },
    method: "POST"
  });

  if (!signUp.ok && !String(signUp.body?.message ?? signUp.body?.error ?? "").match(/already|exist/i)) {
    throw new Error(`Unable to create Neon Auth user ${email}: ${JSON.stringify(signUp.body)}`);
  }

  const authUserId = parsePsqlScalar(
    runNeonPsql([
      "-t",
      "-A",
      "-c",
      `update neon_auth."user" set "emailVerified" = true where email = ${shellQuote(email)} returning id;`
    ])
  );

  if (!authUserId) {
    throw new Error(`Unable to verify Neon Auth user ${email}.`);
  }

  return authUserId;
}

async function dataApiRead(path, token) {
  const response = await fetch(`${DATA_API_URL}${path}`, {
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

async function dataApiRpc(functionName, token, body, { expectError = false } = {}) {
  const response = await fetch(`${DATA_API_URL}/rpc/${functionName}`, {
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

  if (expectError) {
    if (response.ok) {
      throw new Error(`Data API RPC ${functionName} unexpectedly succeeded: ${JSON.stringify(payload)}`);
    }

    return payload;
  }

  if (!response.ok) {
    throw new Error(`Data API RPC ${functionName} failed: ${response.status} ${JSON.stringify(payload)}`);
  }

  return payload;
}

async function routeSmoke(session, route, expectedText) {
  let lastStatus = 0;
  let lastMissing = expectedText;
  const protectionHeaders = VERCEL_BYPASS_SECRET
    ? {
        "x-vercel-protection-bypass": VERCEL_BYPASS_SECRET,
        "x-vercel-set-bypass-cookie": "true"
      }
    : {};

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const { html, ok, status } =
      process.env.OUTPOST_USE_VERCEL_CURL === "1"
        ? routeSmokeWithVercelCurl(session, route)
        : await routeSmokeWithFetch(session, route, protectionHeaders);
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

async function routeSmokeWithFetch(session, route, protectionHeaders) {
  const response = await fetch(`${APP_ORIGIN}${route}`, {
    headers: {
      Cookie: session.localCookie,
      ...protectionHeaders
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
  const result = runVercelCurl([
      route,
      "--deployment",
      APP_ORIGIN,
      "--",
      "--fail",
      "--header",
      `Cookie: ${session.localCookie}`
    ]);

  return {
    html: result.stdout,
    ok: result.status === 0,
    status: result.status === 0 ? 200 : result.status
  };
}

async function assertAppServerAvailable() {
  if (process.env.OUTPOST_USE_VERCEL_CURL === "1") {
    const result = runVercelCurl(["/", "--deployment", APP_ORIGIN, "--", "--fail"]);

    if (result.status === 0) {
      return;
    }

    throw new Error(
      `Outpost app server is required for hosted beta workflow route smoke. Start the app at ${APP_ORIGIN} before running this verifier. vercel curl exited ${result.status}`
    );
  }

  try {
    const response = await fetch(APP_ORIGIN);

    if (!response.ok) {
      throw new Error(`status=${response.status}`);
    }
  } catch (error) {
    throw new Error(
      `Outpost app server is required for hosted beta workflow route smoke. Start the app at ${APP_ORIGIN} before running this verifier. ${
        error instanceof Error ? error.message : ""
      }`
    );
  }
}

function assertRowCount(rows, description) {
  if (!Array.isArray(rows) || rows.length < 1) {
    throw new Error(`${description}: ${JSON.stringify(rows)}`);
  }
}

async function assertUngrantedOwnerBootstrapDenied() {
  await signUpVerifiedUser(BLOCKED_OWNER_EMAIL, "Blocked Hosted Beta Owner");
  const blockedOwner = await signIn(BLOCKED_OWNER_EMAIL);
  const denied = await dataApiRpc(
    "bootstrap_owner_tenant",
    blockedOwner.token,
    {
      p_location_address: "100 Blocked Beta Way",
      p_location_name: "Blocked Main",
      p_owner_email: BLOCKED_OWNER_EMAIL,
      p_owner_name: "Blocked Hosted Beta Owner",
      p_public_phone: null,
      p_tenant_name: `Blocked Beta ${RUN_ID}`,
      p_timezone: "America/Chicago"
    },
    { expectError: true }
  );
  const deniedMessage = JSON.stringify(denied);

  if (!deniedMessage.includes("owner beta access grant is required")) {
    throw new Error(`Unexpected owner beta access denial payload: ${deniedMessage}`);
  }

  const appUserCount = Number(
    parsePsqlScalar(
      runNeonPsql([
        "-t",
        "-A",
        "-c",
        `select count(*) from users where lower(email::text) = ${shellQuote(BLOCKED_OWNER_EMAIL)};`
      ])
    )
  );
  const tenantCount = Number(
    parsePsqlScalar(
      runNeonPsql([
        "-t",
        "-A",
        "-c",
        `select count(*) from tenants where name = ${shellQuote(`Blocked Beta ${RUN_ID}`)};`
      ])
    )
  );

  if (appUserCount !== 0 || tenantCount !== 0) {
    throw new Error(
      `Ungranted owner bootstrap left partial app state: users=${appUserCount}, tenants=${tenantCount}`
    );
  }
}

async function assertUnauthenticatedBetaAccessPreflightDenied() {
  const response = await fetch(`${DATA_API_URL}/rpc/has_active_owner_beta_access`, {
    body: JSON.stringify({ p_owner_email: OWNER_EMAIL }),
    headers: {
      "Content-Type": "application/json"
    },
    method: "POST"
  });

  if (response.ok) {
    const text = await response.text();
    throw new Error(
      `Unauthenticated owner beta access check did not fail closed: ${response.status} ${text}`
    );
  }
}

async function assertAuthenticatedBetaAccessCheckIsSelfScoped(ownerToken) {
  const granted = await dataApiRpc("has_active_owner_beta_access", ownerToken, {
    p_owner_email: OWNER_EMAIL
  });

  if (granted !== true) {
    throw new Error(`Owner beta access self-check did not recognize seeded owner: ${JSON.stringify(granted)}`);
  }

  const crossEmailProbe = await dataApiRpc("has_active_owner_beta_access", ownerToken, {
    p_owner_email: "owner-north@example.com"
  });

  if (crossEmailProbe !== false) {
    throw new Error(
      `Owner beta access check exposed another granted owner email: ${JSON.stringify(crossEmailProbe)}`
    );
  }
}

async function main() {
  runCommand(["npm", "run", "hosted:readiness"], "Hosted readiness");
  await assertAppServerAvailable();

  console.log("Outpost hosted beta workflow proof");
  console.log(`Project: ${PROJECT_ID}`);
  console.log(`Branch: ${BRANCH_NAME}`);
  console.log("Mode: hosted Neon Auth + Data API owner/staff beta workflow, no live providers\n");

  const owner = await signIn(OWNER_EMAIL);
  await assertUnauthenticatedBetaAccessPreflightDenied();
  console.log("Owner beta access: unauthenticated Data API grant checks fail closed");
  await assertAuthenticatedBetaAccessCheckIsSelfScoped(owner.token);
  console.log("Owner beta access: authenticated grant checks are scoped to the caller email");
  await assertUngrantedOwnerBootstrapDenied();
  console.log("Owner beta access: ungranted owner bootstrap was denied without app rows");

  const staffRoster = await dataApiRpc("upsert_tenant_staff_member", owner.token, {
    p_staff_email: STAFF_EMAIL,
    p_staff_name: STAFF_NAME,
    p_tenant_id: TENANT_ID
  });
  const staffRosterRow = Array.isArray(staffRoster) ? staffRoster[0] : staffRoster;

  if (!staffRosterRow?.user_id || staffRosterRow.email !== STAFF_EMAIL) {
    throw new Error(`Owner staff roster upsert returned an unexpected row: ${JSON.stringify(staffRoster)}`);
  }

  console.log(`Owner workflow: staff roster row created for ${STAFF_EMAIL}`);

  await signUpVerifiedUser(STAFF_EMAIL, STAFF_NAME);
  const staff = await signIn(STAFF_EMAIL);
  const staffClaim = await dataApiRpc("claim_staff_roster_membership", staff.token, {});
  const staffClaimRow = Array.isArray(staffClaim) ? staffClaim[0] : staffClaim;

  if (staffClaimRow?.tenant_id !== TENANT_ID || staffClaimRow?.user_id !== staffRosterRow.user_id) {
    throw new Error(`Staff claim returned an unexpected row: ${JSON.stringify(staffClaim)}`);
  }

  console.log("Staff workflow: Neon Auth user claimed owner-managed roster membership");

  const sourceDocument = await dataApiRpc("upsert_manual_source_document", owner.token, {
    p_facts: [
      {
        confidence: 0.93,
        topic: `hosted beta hours ${RUN_ID}`,
        value: "Hosted beta proof fact: staffed hours need owner review before live use."
      },
      {
        confidence: 0.9,
        conflictGroup: `hosted-beta-${RUN_ID}`,
        topic: `hosted beta tour routing ${RUN_ID}`,
        value: "Hosted beta proof conflict: tour requests stay staff-routed until owner review."
      }
    ],
    p_label: SOURCE_LABEL,
    p_location_id: LOCATION_ID,
    p_source_document_id: SOURCE_DOCUMENT_ID,
    p_tenant_id: TENANT_ID
  });

  if (sourceDocument?.id !== SOURCE_DOCUMENT_ID || sourceDocument?.facts_found !== 2) {
    throw new Error(`Manual source upsert returned an unexpected row: ${JSON.stringify(sourceDocument)}`);
  }

  const proposalResult = await dataApiRpc("propose_answers_from_manual_source", owner.token, {
    p_note: `Hosted beta workflow proposal ${RUN_ID}`,
    p_source_document_id: SOURCE_DOCUMENT_ID,
    p_tenant_id: TENANT_ID
  });
  const proposalRow = Array.isArray(proposalResult) ? proposalResult[0] : proposalResult;

  if (!proposalRow || proposalRow.proposed_count !== 2 || proposalRow.conflict_count !== 1) {
    throw new Error(`Answer proposal staging returned an unexpected result: ${JSON.stringify(proposalResult)}`);
  }

  const proposedAnswers = await dataApiRead(
    `/answer_bank_entries?select=id,approval_status,topic,source_document_id&tenant_id=eq.${TENANT_ID}&source_document_id=eq.${SOURCE_DOCUMENT_ID}&order=created_at.asc`,
    owner.token
  );
  assertRowCount(proposedAnswers, "Manual source answer proposals were not visible to the owner");
  const taskSourceAnswer = proposedAnswers.find((answer) => answer.approval_status === "draft") ?? proposedAnswers[0];

  const createdTask = await dataApiRpc("create_task_from_answer_bank_entry", owner.token, {
    p_answer_bank_entry_id: taskSourceAnswer.id,
    p_tenant_id: TENANT_ID
  });

  if (!createdTask?.id || createdTask.tenant_id !== TENANT_ID || createdTask.status !== "new") {
    throw new Error(`Answer-derived task returned an unexpected row: ${JSON.stringify(createdTask)}`);
  }

  console.log("Owner workflow: manual source facts staged into answer review and staff task");

  const staffTasks = await dataApiRead(
    `/tasks?select=id,status,assignee_user_id,summary&tenant_id=eq.${TENANT_ID}&id=eq.${createdTask.id}`,
    staff.token
  );
  assertRowCount(staffTasks, "Claimed staff user could not see the answer-derived task");

  const assignedTask = await dataApiRpc("assign_task", staff.token, {
    p_assignee_user_id: staffClaimRow.user_id,
    p_location_id: createdTask.location_id,
    p_note: `Hosted beta workflow assignment ${RUN_ID}`,
    p_task_id: createdTask.id,
    p_tenant_id: TENANT_ID
  });

  if (assignedTask?.assignee_user_id !== staffClaimRow.user_id) {
    throw new Error(`Task assignment returned an unexpected row: ${JSON.stringify(assignedTask)}`);
  }

  const noteEvent = await dataApiRpc("add_task_note", staff.token, {
    p_location_id: createdTask.location_id,
    p_note: `Hosted beta workflow staff note ${RUN_ID}`,
    p_task_id: createdTask.id,
    p_tenant_id: TENANT_ID
  });

  if (noteEvent?.event_type !== "note_added") {
    throw new Error(`Task note returned an unexpected event: ${JSON.stringify(noteEvent)}`);
  }

  const completedTask = await dataApiRpc("update_task_status", staff.token, {
    p_location_id: createdTask.location_id,
    p_task_id: createdTask.id,
    p_tenant_id: TENANT_ID,
    p_to_status: "done"
  });

  if (completedTask?.status !== "done") {
    throw new Error(`Task status update returned an unexpected row: ${JSON.stringify(completedTask)}`);
  }

  console.log("Staff workflow: claimed staff user saw, assigned, noted, and completed the task");

  const auditRows = await dataApiRead(
    `/audit_events?select=id,action,subject_id&tenant_id=eq.${TENANT_ID}&or=(subject_id.eq.${SOURCE_DOCUMENT_ID},subject_id.eq.${createdTask.id},subject_id.eq.${staffClaimRow.membership_id})`,
    owner.token
  );
  assertRowCount(auditRows, "Hosted beta workflow audit rows were not visible to the owner");

  await routeSmoke(owner, "/owner", [
    "Owner workspace",
    "Acme Fitness",
    "Backend-backed",
    RUN_ID,
    "hosted Neon proof must stay current"
  ]);
  await routeSmoke(staff, "/staff/tasks", ["Staff task inbox", "Acme Fitness", "Hosted beta workflow staff note"]);

  runPsqlScript(`
    do $$
    begin
      if exists (
        select 1 from provider_connections
        where status not in ('not_configured', 'disabled', 'pending_review')
           or secret_ref is not null
           or external_account_label is not null
      ) then
        raise exception 'hosted beta proof unexpectedly configured a live provider';
      end if;
    end $$;
  `);

  console.log("Browser route smoke: owner workspace and staff workboard rendered current hosted workflow rows");
  console.log("Live-provider gates remain blocked.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
