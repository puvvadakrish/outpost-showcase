#!/usr/bin/env node

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { withNeonApiKey } from "./neon-cli-auth.mjs";
import { runVercelCurl } from "./vercel-curl.mjs";

const PROJECT_ID = process.env.OUTPOST_NEON_PROJECT_ID;
const BRANCH_NAME = process.env.OUTPOST_NEON_BRANCH_NAME;
const DATABASE_NAME = process.env.OUTPOST_NEON_DATABASE_NAME ?? "neondb";
const ROLE_NAME = process.env.OUTPOST_NEON_ROLE_NAME ?? "neondb_owner";
const APP_ORIGIN = process.env.NEXT_PUBLIC_OUTPOST_APP_URL ?? "http://localhost:3000";
const VERCEL_BYPASS_SECRET = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
const AUTH_URL = requireEnv("NEXT_PUBLIC_NEON_AUTH_URL");
const DATA_API_URL = requireEnv("NEXT_PUBLIC_NEON_DATA_API_URL");
const SEED_PASSWORD = requireEnv("OUTPOST_NEON_SEED_PASSWORD");
const OWNER_EMAIL = "owner-acme@example.com";
const STAFF_EMAIL = "staff-acme@example.com";
const RUN_ID = `hosted_founder_${Date.now().toString(36)}`;
const PROOF_STARTED_AT = new Date().toISOString();
const FOUNDER_EMAIL = process.env.OUTPOST_FOUNDER_ADMIN_PROOF_EMAIL ?? `${RUN_ID}@founder.outpost.local`;
const FOUNDER_NAME = "Outpost Founder Admin Hosted Proof";
const FOUNDER_USER_SLUG =
  FOUNDER_EMAIL.toLowerCase()
    .replace(/[^a-z0-9]+/gu, "_")
    .replace(/^_+|_+$/gu, "")
    .slice(0, 64) || RUN_ID;
const FOUNDER_USER_ID = `user_founder_admin_${FOUNDER_USER_SLUG}`;
const FOUNDER_ADMIN_ID = `app_admin_${FOUNDER_USER_SLUG}`;
const FOUNDER_MEMBERSHIP_ID = `member_founder_admin_${FOUNDER_USER_SLUG}`;
const FOUNDER_TENANT_ID = "tenant_acme_fitness";

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

function assertHostedProofBranch() {
  if (!PROJECT_ID || !BRANCH_NAME) {
    throw new Error("OUTPOST_NEON_PROJECT_ID and OUTPOST_NEON_BRANCH_NAME are required.");
  }

  if (BRANCH_NAME === "production") {
    throw new Error("Refusing admin portal hosted proof against the Neon production branch.");
  }

  if (BRANCH_NAME === "outpost-neon-spike") {
    throw new Error("Refusing admin portal hosted proof against the migration spike branch.");
  }

  for (const [label, value] of [
    ["NEXT_PUBLIC_NEON_AUTH_URL", AUTH_URL],
    ["NEXT_PUBLIC_NEON_DATA_API_URL", DATA_API_URL]
  ]) {
    const url = new URL(value);

    if (["127.0.0.1", "localhost", "::1", "[::1]"].includes(url.hostname)) {
      throw new Error(`${label} must point at hosted Neon, not a local service.`);
    }
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
  const tempDir = mkdtempSync(join(tmpdir(), "outpost-hosted-founder-admin-"));
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
      `update neon_auth."user" set "emailVerified" = true where lower(email) = lower(${sqlLiteral(
        email
      )}) returning id;`
    ])
  );

  if (!authUserId) {
    throw new Error(`Unable to verify Neon Auth user ${email}.`);
  }

  return authUserId;
}

async function dataApiRpc(functionName, token, body) {
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

  if (!response.ok) {
    throw new Error(`Data API RPC ${functionName} failed: ${response.status} ${JSON.stringify(payload)}`);
  }

  return payload;
}

async function dataApiAnonymousRpc(functionName, body) {
  const token = await getAnonymousJwt();
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

  return {
    ok: response.ok,
    payload,
    status: response.status
  };
}

async function dataApiTableRequest(path, { body, method = "GET", token } = {}) {
  const headers = {};

  headers.Authorization = `Bearer ${token ?? (await getAnonymousJwt())}`;

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${DATA_API_URL}${path}`, {
    body: body === undefined ? undefined : JSON.stringify(body),
    headers,
    method
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

  return {
    ok: response.ok,
    payload,
    status: response.status
  };
}

async function getAnonymousJwt() {
  const response = await authFetch("/token/anonymous");

  if (!response.ok || !response.body?.token) {
    throw new Error(`Unable to fetch Neon Auth anonymous JWT: ${JSON.stringify(response.body)}`);
  }

  return response.body.token;
}

async function routeSmoke(session, route, expectedText) {
  return routeSmokeInternal(session, route, expectedText, false);
}

async function routeSmokeFollowingRedirect(session, route, expectedText) {
  return routeSmokeInternal(session, route, expectedText, true);
}

async function routeSmokeInternal(session, route, expectedText, followRedirect) {
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
        ? routeSmokeWithVercelCurl(session, route, followRedirect)
        : await routeSmokeWithFetch(session, route, protectionHeaders, followRedirect);
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

async function routeSmokeWithFetch(session, route, protectionHeaders, followRedirect) {
  const response = await fetch(`${APP_ORIGIN}${route}`, {
    headers: {
      Cookie: session.localCookie,
      ...protectionHeaders
    },
    redirect: followRedirect ? "follow" : "manual"
  });
  const html = await response.text();

  return {
    html,
    ok: response.ok,
    status: response.status
  };
}

function routeSmokeWithVercelCurl(session, route, followRedirect) {
  const curlArgs = [
    "--fail",
    "--header",
    `Cookie: ${session.localCookie}`
  ];

  if (followRedirect) {
    curlArgs.unshift("--location");
  }

  const result = runVercelCurl([
      route,
      "--deployment",
      APP_ORIGIN,
      "--",
      ...curlArgs
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
      `Outpost app server is required for hosted admin portal readiness route smoke. Start the app at ${APP_ORIGIN} before running this verifier. vercel curl exited ${result.status}`
    );
  }

  try {
    const response = await fetch(APP_ORIGIN);

    if (!response.ok) {
      throw new Error(`status=${response.status}`);
    }
  } catch (error) {
    throw new Error(
      `Outpost app server is required for hosted admin portal readiness route smoke. Start the app at ${APP_ORIGIN} before running this verifier. ${
        error instanceof Error ? error.message : ""
      }`
    );
  }
}

function assertNoForbiddenKeys(value, forbiddenKeys, path = "$") {
  if (!value || typeof value !== "object") {
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    if (forbiddenKeys.includes(key)) {
      throw new Error(`Admin portal readiness exposed forbidden key ${path}.${key}`);
    }

    assertNoForbiddenKeys(child, forbiddenKeys, `${path}.${key}`);
  }
}

function assertAuthorizedReport(report) {
  if (report?.authorized !== true || !Array.isArray(report.rows) || report.rows.length < 1) {
    throw new Error(`Admin portal readiness did not return an authorized owner report: ${JSON.stringify(report)}`);
  }

  assertNoForbiddenKeys(report, ["display_name", "note", "secret_ref"]);

  const acmeFitness = report.rows.find((row) => row.owner_email === OWNER_EMAIL);

  if (!acmeFitness) {
    throw new Error(`Admin portal readiness did not include the seeded Acme Fitness owner: ${JSON.stringify(report)}`);
  }

  if (acmeFitness.grant?.status !== "active") {
    throw new Error(`Acme Fitness beta grant was not active: ${JSON.stringify(acmeFitness)}`);
  }

  if (acmeFitness.tenant_bootstrap?.tenant_id !== FOUNDER_TENANT_ID) {
    throw new Error(`Acme Fitness tenant bootstrap was not visible: ${JSON.stringify(acmeFitness)}`);
  }

  if (Number(acmeFitness.provider_gate?.unexpected_live_records ?? 0) !== 0) {
    throw new Error(`Admin portal readiness found unexpected live provider records: ${JSON.stringify(acmeFitness)}`);
  }

  if (acmeFitness.rollback_readiness?.state !== "blocked_seeded_tenant") {
    throw new Error(`Seeded tenant rollback gate was not blocked: ${JSON.stringify(acmeFitness)}`);
  }
}

function assertDeniedReport(report, label) {
  if (report?.authorized !== false || !Array.isArray(report.rows) || report.rows.length !== 0) {
    throw new Error(`${label} unexpectedly read admin portal readiness rows: ${JSON.stringify(report)}`);
  }
}

function assertAuthorizedProofRunReport(report) {
  if (report?.authorized !== true || !Array.isArray(report.rows)) {
    throw new Error(`Admin portal proof runs did not return an authorized report: ${JSON.stringify(report)}`);
  }

  assertNoForbiddenKeys(report, ["secret", "token", "password", "api_key", "cookie", `service${"_"}role`]);
}

function assertAuthorizedCustomerHandoffGateReport(report) {
  if (report?.authorized !== true || !Array.isArray(report.rows)) {
    throw new Error(
      `Admin portal customer handoff gate records did not return an authorized report: ${JSON.stringify(report)}`
    );
  }

  assertNoForbiddenKeys(report, ["secret", "token", "password", "api_key", "cookie", `service${"_"}role`]);
}

function assertAuthorizedLaunchPackageRecordReport(report) {
  if (report?.authorized !== true || !Array.isArray(report.rows)) {
    throw new Error(
      `Admin portal launch package records did not return an authorized report: ${JSON.stringify(report)}`
    );
  }

  assertNoForbiddenKeys(report, ["secret", "token", "password", "api_key", "cookie", `service${"_"}role`]);
}

function assertAuthorizedBetaAccessRequestReport(report) {
  if (report?.authorized !== true || !Array.isArray(report.rows)) {
    throw new Error(`Admin portal beta access requests did not return an authorized report: ${JSON.stringify(report)}`);
  }

  assertNoForbiddenKeys(report, ["secret", "token", "password", "api_key", "cookie", `service${"_"}role`]);
}

async function assertPublicBetaAccessRequestRuntime(founderToken, ownerToken) {
  const requestEmail = `${RUN_ID}@beta-access.outpost.local`;
  const honeypotEmail = `${RUN_ID}-honeypot@beta-access.outpost.local`;
  const baseRequest = {
    p_company_website: "",
    p_gym_name: "Hosted Founder Admin Proof Gym",
    p_location_hint: "Hosted proof branch",
    p_note: "Runtime proof request",
    p_owner_email: requestEmail,
    p_owner_name: "Hosted Founder Admin Proof Owner"
  };

  const firstSubmit = await dataApiAnonymousRpc("submit_owner_beta_access_request", baseRequest);
  if (!firstSubmit.ok || firstSubmit.payload?.ok !== true || firstSubmit.payload?.status !== "received") {
    throw new Error(`Anonymous beta access request submit failed: ${JSON.stringify(firstSubmit)}`);
  }

  const secondSubmit = await dataApiAnonymousRpc("submit_owner_beta_access_request", {
    ...baseRequest,
    p_note: "Runtime proof request resubmitted"
  });
  if (!secondSubmit.ok || secondSubmit.payload?.ok !== true || secondSubmit.payload?.status !== "received") {
    throw new Error(`Anonymous beta access request idempotent resubmit failed: ${JSON.stringify(secondSubmit)}`);
  }

  const honeypotSubmit = await dataApiAnonymousRpc("submit_owner_beta_access_request", {
    ...baseRequest,
    p_company_website: "https://bot.example",
    p_owner_email: honeypotEmail
  });
  if (!honeypotSubmit.ok || honeypotSubmit.payload?.ok !== true || honeypotSubmit.payload?.status !== "received") {
    throw new Error(`Anonymous beta access request honeypot response was not generic: ${JSON.stringify(honeypotSubmit)}`);
  }

  const secretSubmit = await dataApiAnonymousRpc("submit_owner_beta_access_request", {
    ...baseRequest,
    p_note: `${["NEON", "API", "KEY"].join("_")}=napi_thismustnotbestored000000000000`
  });
  if (secretSubmit.ok) {
    throw new Error(`Secret-shaped beta access request unexpectedly succeeded: ${JSON.stringify(secretSubmit)}`);
  }

  for (const [label, result] of [
    [
      "anonymous read",
      await dataApiTableRequest("/owner_beta_access_requests?select=id,email,status&limit=1")
    ],
    [
      "owner read",
      await dataApiTableRequest("/owner_beta_access_requests?select=id,email,status&limit=1", { token: ownerToken })
    ],
    [
      "anonymous insert",
      await dataApiTableRequest("/owner_beta_access_requests", {
        body: {
          email: `${RUN_ID}-direct@beta-access.outpost.local`,
          gym_name: "Direct Insert Gym",
          id: `owner_beta_request_direct_${RUN_ID}`,
          owner_name: "Direct Insert Owner"
        },
        method: "POST"
      })
    ]
  ]) {
    if (result.ok) {
      throw new Error(`Direct ${label} for beta access request table unexpectedly succeeded: ${JSON.stringify(result)}`);
    }
  }

  const report = await dataApiRpc("list_founder_admin_beta_access_requests", founderToken, {});
  assertAuthorizedBetaAccessRequestReport(report);

  const submitted = report.rows.find((row) => row.email === requestEmail);
  if (
    !submitted ||
    submitted.request_count !== 1 ||
    submitted.status !== "new" ||
    submitted.owner_name !== baseRequest.p_owner_name ||
    submitted.gym_name !== baseRequest.p_gym_name ||
    submitted.location_hint !== baseRequest.p_location_hint
  ) {
    throw new Error(
      `Submitted beta access request did not preserve the immediate-repeat cooldown contract: ${JSON.stringify(report)}`
    );
  }

  if (report.rows.some((row) => row.email === honeypotEmail)) {
    throw new Error(`Honeypot beta access request unexpectedly became visible: ${JSON.stringify(report)}`);
  }
}

async function assertAnonymousDenied() {
  const anonymous = await dataApiAnonymousRpc("list_founder_admin_owner_readiness", {});

  if (!anonymous.ok) {
    return;
  }

  assertDeniedReport(anonymous.payload, "Anonymous session");
}

async function assertAnonymousProofRunsDenied() {
  const anonymous = await dataApiAnonymousRpc("list_founder_admin_proof_runs", {});

  if (!anonymous.ok) {
    return;
  }

  assertDeniedReport(anonymous.payload, "Anonymous proof runs session");
}

async function assertAnonymousCustomerHandoffGateRecordsDenied() {
  const anonymous = await dataApiAnonymousRpc("list_founder_admin_customer_handoff_gate_records", {});

  if (!anonymous.ok) {
    return;
  }

  assertDeniedReport(anonymous.payload, "Anonymous customer handoff gate records session");
}

async function assertAnonymousLaunchPackageRecordsDenied() {
  const anonymous = await dataApiAnonymousRpc("list_founder_admin_launch_package_records", {});

  if (!anonymous.ok) {
    return;
  }

  assertDeniedReport(anonymous.payload, "Anonymous launch package records session");
}

async function assertAnonymousBetaAccessRequestsDenied() {
  const anonymous = await dataApiAnonymousRpc("list_founder_admin_beta_access_requests", {});

  if (!anonymous.ok) {
    return;
  }

  assertDeniedReport(anonymous.payload, "Anonymous beta access requests session");
}

async function provisionFounderAdmin(authUserId) {
  runPsqlScript(`
    insert into users (id, external_auth_id, email, name)
    values (${sqlLiteral(FOUNDER_USER_ID)}, ${sqlLiteral(authUserId)}::uuid, ${sqlLiteral(FOUNDER_EMAIL)}, ${sqlLiteral(
      FOUNDER_NAME
    )})
    on conflict (id) do update
      set external_auth_id = excluded.external_auth_id,
          email = excluded.email,
          name = excluded.name,
          updated_at = now();

    insert into app_admins (id, user_id, status)
    values (${sqlLiteral(FOUNDER_ADMIN_ID)}, ${sqlLiteral(FOUNDER_USER_ID)}, 'active')
    on conflict (user_id) do update
      set status = 'active';

    insert into tenant_memberships (id, tenant_id, user_id, role, invite_status)
    values (${sqlLiteral(FOUNDER_MEMBERSHIP_ID)}, ${sqlLiteral(FOUNDER_TENANT_ID)}, ${sqlLiteral(
      FOUNDER_USER_ID
    )}, 'founder_admin', 'active')
    on conflict (tenant_id, user_id) do update
      set role = 'founder_admin',
          invite_status = 'active',
          updated_at = now();
  `);
}

function assertNoLiveProviderGates() {
  runPsqlScript(`
    do $$
    begin
      if exists (
        select 1 from provider_connections
        where status not in ('not_configured', 'disabled', 'pending_review')
           or secret_ref is not null
           or external_account_label is not null
      ) then
        raise exception 'hosted admin portal proof unexpectedly configured a live provider';
      end if;
    end $$;
  `);
}

function recordHostedFounderAdminProofRun() {
  const proofId = `proof_${RUN_ID}`;
  const completedAt = new Date().toISOString();
  const summary = {
    anonymous_denial: "passed",
    beta_access_request_public_submit: "passed",
    beta_access_request_projection: "passed",
    customer_handoff_gate_projection: "passed",
    founder_admin_projection: "passed",
    launch_package_record_projection: "passed",
    live_provider_gate: "passed",
    owner_denial: "passed",
    route_smoke: "passed",
    staff_denial: "passed"
  };

  runPsqlScript(`
    insert into hosted_proof_runs (
      id,
      proof_kind,
      status,
      neon_branch_name,
      app_origin,
      started_at,
      completed_at,
      summary
    )
    values (
      ${sqlLiteral(proofId)},
      'hosted_founder_admin_readiness',
      'passed',
      ${sqlLiteral(BRANCH_NAME)},
      ${sqlLiteral(APP_ORIGIN)},
      ${sqlLiteral(PROOF_STARTED_AT)}::timestamptz,
      ${sqlLiteral(completedAt)}::timestamptz,
      ${sqlLiteral(JSON.stringify(summary))}::jsonb
    );
  `);
}

async function main() {
  runCommand(["npm", "run", "hosted:readiness"], "Hosted readiness");
  assertHostedProofBranch();
  await assertAppServerAvailable();

  console.log("Outpost hosted admin portal readiness proof");
  console.log(`Project: ${PROJECT_ID}`);
  console.log(`Branch: ${BRANCH_NAME}`);
  console.log("Mode: hosted Neon Auth + Data API admin portal support projection, no live providers\n");

  const founderAuthId = await signUpVerifiedUser(FOUNDER_EMAIL, FOUNDER_NAME);
  await provisionFounderAdmin(founderAuthId);
  const founder = await signIn(FOUNDER_EMAIL);
  const owner = await signIn(OWNER_EMAIL);
  const staff = await signIn(STAFF_EMAIL);

  const founderReport = await dataApiRpc("list_founder_admin_owner_readiness", founder.token, {});
  assertAuthorizedReport(founderReport);
  console.log("Admin portal RPC proof: active app admin + founder_admin membership can read the support projection");

  assertDeniedReport(await dataApiRpc("list_founder_admin_owner_readiness", owner.token, {}), "Owner session");
  assertDeniedReport(await dataApiRpc("list_founder_admin_owner_readiness", staff.token, {}), "Staff session");
  await assertAnonymousDenied();
  console.log("Admin portal RPC proof: owner, staff, and anonymous sessions cannot read readiness rows");

  assertAuthorizedProofRunReport(await dataApiRpc("list_founder_admin_proof_runs", founder.token, {}));
  assertDeniedReport(await dataApiRpc("list_founder_admin_proof_runs", owner.token, {}), "Owner proof runs session");
  assertDeniedReport(await dataApiRpc("list_founder_admin_proof_runs", staff.token, {}), "Staff proof runs session");
  await assertAnonymousProofRunsDenied();
  console.log("Admin portal proof runs RPC proof: owner, staff, and anonymous sessions cannot read proof records");

  assertAuthorizedCustomerHandoffGateReport(
    await dataApiRpc("list_founder_admin_customer_handoff_gate_records", founder.token, {})
  );
  assertDeniedReport(
    await dataApiRpc("list_founder_admin_customer_handoff_gate_records", owner.token, {}),
    "Owner customer handoff gate records session"
  );
  assertDeniedReport(
    await dataApiRpc("list_founder_admin_customer_handoff_gate_records", staff.token, {}),
    "Staff customer handoff gate records session"
  );
  await assertAnonymousCustomerHandoffGateRecordsDenied();
  console.log(
    "Customer handoff gate records RPC proof: owner, staff, and anonymous sessions cannot read proof records"
  );

  assertAuthorizedLaunchPackageRecordReport(
    await dataApiRpc("list_founder_admin_launch_package_records", founder.token, {})
  );
  assertDeniedReport(
    await dataApiRpc("list_founder_admin_launch_package_records", owner.token, {}),
    "Owner launch package records session"
  );
  assertDeniedReport(
    await dataApiRpc("list_founder_admin_launch_package_records", staff.token, {}),
    "Staff launch package records session"
  );
  await assertAnonymousLaunchPackageRecordsDenied();
  console.log("Launch package records RPC proof: owner, staff, and anonymous sessions cannot read proof records");

  assertAuthorizedBetaAccessRequestReport(
    await dataApiRpc("list_founder_admin_beta_access_requests", founder.token, {})
  );
  await assertPublicBetaAccessRequestRuntime(founder.token, owner.token);
  assertDeniedReport(
    await dataApiRpc("list_founder_admin_beta_access_requests", owner.token, {}),
    "Owner beta access requests session"
  );
  assertDeniedReport(
    await dataApiRpc("list_founder_admin_beta_access_requests", staff.token, {}),
    "Staff beta access requests session"
  );
  await assertAnonymousBetaAccessRequestsDenied();
  console.log(
    "Beta access request queue RPC proof: anonymous submit works through the RPC, direct table access is denied, and owner/staff/anonymous sessions cannot read requests"
  );

  await routeSmoke(founder, "/admin", [
    "Beta owner readiness",
    "Beta access request console",
    "Beta proof-run summary",
    "Proof evidence timeline",
    "Hosted Neon",
    OWNER_EMAIL,
    "Blocked product gates"
  ]);
  await routeSmoke(owner, "/admin", [
    "Admin portal session required",
    "Owner and staff sessions cannot read this support projection"
  ]);
  await routeSmokeFollowingRedirect(founder, "/founder-admin", [
    "Admin portal"
  ]);

  console.log("Browser route smoke: admin portal renders for admin session, old route redirects, and owner session stays locked");

  assertNoLiveProviderGates();
  recordHostedFounderAdminProofRun();
  console.log("Live-provider gates remain blocked.");
  console.log("Hosted admin portal proof record appended.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
