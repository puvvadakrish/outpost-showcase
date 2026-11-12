#!/usr/bin/env node

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { readHostedReadinessConfig } from "./hosted-preview-readiness-config.mjs";
import { withNeonApiKey } from "./neon-cli-auth.mjs";
import { runVercelCurl } from "./vercel-curl.mjs";

const config = readHostedReadinessConfig();
const DATABASE_NAME = process.env.OUTPOST_NEON_DATABASE_NAME ?? config.databaseName ?? "neondb";
const ROLE_NAME = process.env.OUTPOST_NEON_ROLE_NAME ?? "neondb_owner";
const APP_ORIGIN = normalizeHostedAppOrigin(
  process.env.OUTPOST_VERCEL_DEPLOYMENT_URL ?? process.env.NEXT_PUBLIC_OUTPOST_APP_URL
);
const VERCEL_BYPASS_SECRET = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
const USE_VERCEL_CURL =
  process.env.OUTPOST_USE_VERCEL_CURL === "1" ||
  (!VERCEL_BYPASS_SECRET && new URL(APP_ORIGIN).hostname.endsWith(".vercel.app"));
const RUN_ID = `hosted_request_${Date.now().toString(36)}`;
const OWNER_EMAIL = normalizeEmail(process.env.OUTPOST_HOSTED_REQUEST_FULFILLMENT_EMAIL ?? `${RUN_ID}@beta-proof.outpost.local`);
const OWNER_NAME = process.env.OUTPOST_HOSTED_REQUEST_FULFILLMENT_OWNER_NAME?.trim() || "Hosted Request Proof Owner";
const GYM_NAME = process.env.OUTPOST_HOSTED_REQUEST_FULFILLMENT_GYM_NAME?.trim() || `Hosted Request Proof Gym ${RUN_ID}`;
const LOCATION_HINT = process.env.OUTPOST_HOSTED_REQUEST_FULFILLMENT_LOCATION?.trim() || "Protected Preview proof";
const OWNER_PASSWORD = requireEnv("OUTPOST_OWNER_BETA_PASSWORD");
const FOUNDER_EMAIL = normalizeEmail(
  process.env.OUTPOST_FOUNDER_ADMIN_PROOF_EMAIL ?? `${RUN_ID}@founder-proof.outpost.local`
);
const FOUNDER_NAME = "Outpost Founder Admin Request Fulfillment Proof";
const FOUNDER_TENANT_ID = "tenant_acme_fitness";
const FOUNDER_USER_ID = `user_founder_request_${safeSlug(FOUNDER_EMAIL)}`;
const FOUNDER_ADMIN_ID = `app_admin_founder_request_${safeSlug(FOUNDER_EMAIL)}`;
const FOUNDER_MEMBERSHIP_ID = `member_founder_request_${safeSlug(FOUNDER_EMAIL)}`;
const RETAIN_PROOF_DATA = process.env.OUTPOST_HOSTED_REQUEST_FULFILLMENT_RETAIN === "1";
let cleanupArmed = false;

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
  const normalized = String(email).trim().toLowerCase();
  invariant(/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(normalized), `${email} is not a valid proof email.`);
  assertNoSecretShapedValue(normalized, "proof email");

  return normalized;
}

function assertDisposableProofEmail(email, domain, label) {
  invariant(
    email.endsWith(domain),
    `${label} must use the disposable ${domain} proof domain so cleanup cannot target a real owner.`
  );
}

function safeSlug(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "_")
    .replace(/^_+|_+$/gu, "")
    .slice(0, 64);
}

function normalizeHostedAppOrigin(rawOrigin) {
  invariant(rawOrigin, "OUTPOST_VERCEL_DEPLOYMENT_URL or NEXT_PUBLIC_OUTPOST_APP_URL is required.");

  let url;

  try {
    url = new URL(rawOrigin);
  } catch {
    throw new Error("Hosted request fulfillment proof app origin must be a valid URL.");
  }

  invariant(url.protocol === "https:", "Hosted request fulfillment proof must use an HTTPS Vercel Preview URL.");
  invariant(url.hostname.endsWith(".vercel.app"), "Hosted request fulfillment proof must target a Vercel Preview URL.");
  invariant(
    !["127.0.0.1", "localhost", "::1", "[::1]"].includes(url.hostname),
    "Hosted request fulfillment proof refuses local app origins."
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
    /\bnapi_[A-Za-z0-9]{20,}\b/u.test(text) ||
    /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}(?:\.[A-Za-z0-9_-]{8,})?\b/u.test(text) ||
    text.includes("__Secure-neon-auth") ||
    text.includes("outpost_neon_auth_session") ||
    /(?:password|token|cookie|api[_-]?key|authorization|credential|private[_-]?key|secret|bypass|signature|jwt)\s*[:=]/iu.test(
      text
    );

  invariant(!secretValue, `${label} contains a secret-shaped value.`);
}

function assertProofSafety() {
  invariant(process.env.NEON_API_KEY, "NEON_API_KEY is required for hosted request fulfillment proof.");
  invariant(config.branchName !== "production", "Refusing hosted request fulfillment proof on Neon production.");
  invariant(
    config.branchName !== "outpost-neon-spike",
    "Refusing hosted request fulfillment proof on the Neon migration spike branch."
  );
  invariant(OWNER_PASSWORD.length >= 12, "OUTPOST_OWNER_BETA_PASSWORD must be at least 12 characters.");
  invariant(OWNER_PASSWORD !== "outpost-local-password", "Refusing to reuse the local seed password for owner proof.");
  invariant(OWNER_PASSWORD.toLowerCase() !== OWNER_EMAIL, "OUTPOST_OWNER_BETA_PASSWORD must not equal the owner email.");
  invariant(OWNER_NAME.length > 0 && OWNER_NAME.length <= 120, "Proof owner name must be 1-120 characters.");
  invariant(GYM_NAME.length > 0 && GYM_NAME.length <= 160, "Proof gym name must be 1-160 characters.");
  assertDisposableProofEmail(OWNER_EMAIL, "@beta-proof.outpost.local", "OUTPOST_HOSTED_REQUEST_FULFILLMENT_EMAIL");
  assertDisposableProofEmail(FOUNDER_EMAIL, "@founder-proof.outpost.local", "OUTPOST_FOUNDER_ADMIN_PROOF_EMAIL");
  assertNoSecretShapedValue(OWNER_NAME, "proof owner name");
  assertNoSecretShapedValue(GYM_NAME, "proof gym name");
  assertNoSecretShapedValue(LOCATION_HINT, "proof location hint");
}

function sqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function runCommand(args, label, env = process.env) {
  const result = spawnSync(args[0], args.slice(1), {
    cwd: process.cwd(),
    encoding: "utf8",
    env,
    stdio: ["ignore", "pipe", "pipe"]
  });

  if (result.status !== 0) {
    throw new Error(`${label} failed.\n${[result.stdout, result.stderr].filter(Boolean).join("\n")}`);
  }

  return [result.stdout, result.stderr].filter(Boolean).join("\n");
}

function runNeonPsql(args) {
  return runCommand(
    ["neon", ...withNeonApiKey([
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
    ])],
    "Neon psql"
  );
}

function runPsqlScript(sql) {
  const tempDir = mkdtempSync(join(tmpdir(), "outpost-hosted-request-fulfillment-"));
  const scriptPath = join(tempDir, "proof.sql");

  try {
    writeFileSync(scriptPath, sql);
    return runNeonPsql(["-t", "-A", "-q", "-v", "ON_ERROR_STOP=1", "-f", scriptPath]);
  } finally {
    rmSync(tempDir, { force: true, recursive: true });
  }
}

function parsePsqlScalar(output) {
  return output
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("INFO:"))[0];
}

function splitSetCookie(header) {
  return header ? header.split(/,(?=\s*[^;,]+=)/u).map((value) => value.trim()) : [];
}

function extractSessionCookie(header, label) {
  const raw = splitSetCookie(header).find((value) => value.startsWith("__Secure-neon-auth.session_token="));

  if (!raw) {
    throw new Error(`Neon Auth did not return a session cookie for ${label}.`);
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

async function signUpVerifiedUser(email, name, password) {
  const signUp = await authFetch("/sign-up/email", {
    body: JSON.stringify({
      callbackURL: `${APP_ORIGIN}/auth/callback`,
      email,
      name,
      password
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
      `update neon_auth."user" set "emailVerified" = true where lower(email) = lower(${sqlLiteral(email)}) returning id;`
    ])
  );

  if (!authUserId) {
    throw new Error(`Unable to verify Neon Auth user ${email}.`);
  }

  return authUserId;
}

async function signIn(email, password) {
  const response = await authFetch("/sign-in/email", {
    body: JSON.stringify({ email, password }),
    headers: { "Content-Type": "application/json" },
    method: "POST"
  });

  if (!response.ok) {
    throw new Error(`Unable to sign in ${email}: ${JSON.stringify(response.body)}`);
  }

  const cookie = extractSessionCookie(response.headers.get("set-cookie"), email);
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
    localCookie: `outpost_neon_auth_session_token=${encodeURIComponent(
      decodeURIComponent(cookie.value)
    )}; outpost_neon_auth_session_cookie_name=${encodeURIComponent(cookie.name)}`,
    token: tokenResponse.body.token
  };
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

async function getAnonymousJwt() {
  const response = await authFetch("/token/anonymous");

  if (!response.ok || !response.body?.token) {
    throw new Error(`Unable to fetch Neon Auth anonymous JWT: ${JSON.stringify(response.body)}`);
  }

  return response.body.token;
}

async function submitDisposableRequest() {
  const result = await dataApiRpc("submit_owner_beta_access_request", null, {
    p_company_website: "",
    p_gym_name: GYM_NAME,
    p_location_hint: LOCATION_HINT,
    p_note: "Disposable hosted request fulfillment proof",
    p_owner_email: OWNER_EMAIL,
    p_owner_name: OWNER_NAME
  });

  if (result?.ok !== true || result?.status !== "received") {
    throw new Error(`Disposable request submit did not return the generic received response: ${JSON.stringify(result)}`);
  }
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

function runRequestFulfillment() {
  const output = runCommand(["npm", "run", "beta:operator:request-fulfillment"], "Beta request fulfillment", {
    ...process.env,
    NEXT_PUBLIC_OUTPOST_APP_URL: APP_ORIGIN,
    OUTPOST_OWNER_BETA_PASSWORD: OWNER_PASSWORD,
    OUTPOST_OWNER_BETA_REQUEST_EMAIL: OWNER_EMAIL,
    OUTPOST_OWNER_BETA_REQUEST_FULFILLMENT_NOTE: "Disposable hosted request fulfillment proof"
  });

  assertNoSecretShapedValue(output, "request fulfillment output");

  return output;
}

async function assertFounderProjection(founderToken) {
  const report = await dataApiRpc("list_founder_admin_beta_access_requests", founderToken, {});

  if (report?.authorized !== true || !Array.isArray(report.rows)) {
    throw new Error(`Admin portal request projection was not authorized: ${JSON.stringify(report)}`);
  }

  assertNoForbiddenKeys(report, ["note", "fulfillment_note", "password", "token", "api_key", "cookie", `service${"_"}role`]);

  const row = report.rows.find((candidate) => candidate.email === OWNER_EMAIL);
  if (!row) {
    throw new Error(`Admin portal request projection did not include ${OWNER_EMAIL}: ${JSON.stringify(report)}`);
  }

  if (row.status !== "approved" || row.fulfillment?.fulfilled !== true || row.fulfillment?.grant_linked !== true) {
    throw new Error(`Admin portal projection did not show fulfilled grant-linked request: ${JSON.stringify(row)}`);
  }

  if (
    row.fulfillment_receipt?.present !== true ||
    row.fulfillment_receipt.command_name !== "beta:operator:request-fulfillment" ||
    row.fulfillment_receipt.status !== "recorded"
  ) {
    throw new Error(`Admin portal projection did not show a recorded fulfillment receipt: ${JSON.stringify(row)}`);
  }
}

function assertNoForbiddenKeys(value, forbiddenKeys, path = "$") {
  if (!value || typeof value !== "object") {
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    if (forbiddenKeys.includes(key)) {
      throw new Error(`Hosted request fulfillment proof exposed forbidden key ${path}.${key}`);
    }

    assertNoForbiddenKeys(child, forbiddenKeys, `${path}.${key}`);
  }
}

async function assertOwnerGrant(ownerToken) {
  const granted = await dataApiRpc("has_active_owner_beta_access", ownerToken, {
    p_owner_email: OWNER_EMAIL
  });

  if (granted !== true) {
    throw new Error(`Disposable owner could not read their active beta grant: ${JSON.stringify(granted)}`);
  }

  const crossEmail = `cross-${randomUUID()}@beta-proof.outpost.local`;
  const crossGranted = await dataApiRpc("has_active_owner_beta_access", ownerToken, {
    p_owner_email: crossEmail
  });

  if (crossGranted !== false) {
    throw new Error(`Disposable owner could read another beta grant email: ${JSON.stringify(crossGranted)}`);
  }
}

async function routeSmokeOwnerWorkspace(ownerSession) {
  const html = await routeSmoke("/owner", ownerSession.localCookie, [
    "Create your owner workspace",
    "Phone and email providers stay off",
    "Seedless setup"
  ]);

  assertNoSecretShapedValue(html, "owner workspace smoke HTML");
}

async function routeSmoke(route, cookie, expectedText) {
  const { html, ok, status } =
    USE_VERCEL_CURL
      ? routeSmokeWithVercelCurl(route, cookie)
      : await routeSmokeWithFetch(route, cookie);
  const missing = expectedText.filter((text) => !html.includes(text));

  if (!ok || missing.length > 0) {
    throw new Error(`${route} smoke failed: status=${status} missing=${missing.join(", ")}`);
  }

  return html;
}

async function routeSmokeWithFetch(route, cookie) {
  const protectionHeaders = VERCEL_BYPASS_SECRET
    ? {
        "x-vercel-protection-bypass": VERCEL_BYPASS_SECRET,
        "x-vercel-set-bypass-cookie": "true"
      }
    : {};
  const response = await fetch(`${APP_ORIGIN}${route}`, {
    headers: {
      Cookie: cookie,
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

function routeSmokeWithVercelCurl(route, cookie) {
  const result = runVercelCurl([
    route,
    "--deployment",
    APP_ORIGIN,
    "--",
    "--fail",
    "--header",
    `Cookie: ${cookie}`
  ]);

  return {
    html: result.stdout,
    ok: result.status === 0,
    status: result.status === 0 ? 200 : result.status
  };
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
        raise exception 'hosted request fulfillment proof unexpectedly found a live provider';
      end if;
    end $$;
  `);
}

function cleanupProofData() {
  if (!cleanupArmed) {
    return;
  }

  if (RETAIN_PROOF_DATA) {
    console.log("Disposable proof data retained because OUTPOST_HOSTED_REQUEST_FULFILLMENT_RETAIN=1.");
    return;
  }

  runPsqlScript(`
    delete from owner_beta_access_fulfillment_receipts where lower(owner_email::text) in (lower(${sqlLiteral(OWNER_EMAIL)}));
    delete from owner_beta_access_requests where lower(email::text) in (lower(${sqlLiteral(OWNER_EMAIL)}));
    delete from owner_beta_access_grants where lower(email::text) in (lower(${sqlLiteral(OWNER_EMAIL)}));
    delete from tenant_memberships where id = ${sqlLiteral(FOUNDER_MEMBERSHIP_ID)};
    delete from app_admins where id = ${sqlLiteral(FOUNDER_ADMIN_ID)};
    delete from users where id = ${sqlLiteral(FOUNDER_USER_ID)};
    delete from neon_auth."user" where lower(email) in (lower(${sqlLiteral(OWNER_EMAIL)}), lower(${sqlLiteral(FOUNDER_EMAIL)}));
  `);
}

async function main() {
  assertProofSafety();

  console.log("Outpost hosted beta request fulfillment proof");
  console.log(`Project: ${config.projectId}`);
  console.log(`Branch: ${config.branchName}`);
  console.log(`Preview: ${APP_ORIGIN}`);
  console.log(`Disposable owner request: ${OWNER_EMAIL}`);
  console.log("Mode: public request RPC -> operator fulfillment -> admin portal and owner proof; no live providers\n");

  runCommand(["npm", "run", "hosted:readiness"], "Hosted readiness");
  await submitDisposableRequest();
  cleanupArmed = true;
  console.log("Disposable beta access request submitted through public RPC.");

  const fulfillmentOutput = runRequestFulfillment();
  console.log(fulfillmentOutput.trim());

  const founderAuthId = await signUpVerifiedUser(FOUNDER_EMAIL, FOUNDER_NAME, config.seedPassword);
  await provisionFounderAdmin(founderAuthId);
  const founderSession = await signIn(FOUNDER_EMAIL, config.seedPassword);
  await assertFounderProjection(founderSession.token);
  console.log("Admin portal projection shows approved, fulfilled, grant-linked request without secrets.");

  const ownerSession = await signIn(OWNER_EMAIL, OWNER_PASSWORD);
  await assertOwnerGrant(ownerSession.token);
  console.log("Disposable owner sign-in and caller-scoped beta grant proof passed.");

  await routeSmokeOwnerWorkspace(ownerSession);
  console.log("Protected Preview owner workspace smoke reached seedless setup state.");

  assertNoLiveProviderGates();
  console.log("Live-provider gates remain blocked.");

  cleanupProofData();
  console.log(RETAIN_PROOF_DATA ? "Proof retained for manual inspection." : "Disposable request fulfillment proof data cleaned up.");
}

main().catch((error) => {
  try {
    cleanupProofData();
  } catch (cleanupError) {
    console.error(`Cleanup failed: ${cleanupError instanceof Error ? cleanupError.message : cleanupError}`);
  }

  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
