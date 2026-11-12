#!/usr/bin/env node

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readHostedReadinessConfig } from "./hosted-preview-readiness-config.mjs";
import { withNeonApiKey } from "./neon-cli-auth.mjs";

const config = readHostedReadinessConfig();
const DATABASE_NAME = process.env.OUTPOST_NEON_DATABASE_NAME ?? config.databaseName ?? "neondb";
const ROLE_NAME = process.env.OUTPOST_NEON_ROLE_NAME ?? "neondb_owner";
const APP_ORIGIN = normalizeAppOrigin(process.env.NEXT_PUBLIC_OUTPOST_APP_URL ?? "http://localhost:3000");
const OWNER_EMAIL = normalizeEmail(requireEnv("OUTPOST_OWNER_BETA_EMAIL"));
const OWNER_NAME = requireEnv("OUTPOST_OWNER_BETA_NAME").trim();
const OWNER_PASSWORD = requireEnv("OUTPOST_OWNER_BETA_PASSWORD");
const GRANT_NOTE =
  process.env.OUTPOST_OWNER_BETA_NOTE?.trim() ||
  `Operator-created beta owner access on ${new Date().toISOString()}`;
const CROSS_EMAIL =
  process.env.OUTPOST_OWNER_BETA_CROSS_EMAIL?.trim().toLowerCase() ||
  (OWNER_EMAIL === "owner-acme@example.com" ? "owner-north@example.com" : "owner-acme@example.com");

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
  invariant(normalized.includes("@"), "OUTPOST_OWNER_BETA_EMAIL must be an email address.");
  invariant(normalized.length <= 254, "OUTPOST_OWNER_BETA_EMAIL must be 254 characters or fewer.");

  return normalized;
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

function assertOperatorSafety() {
  invariant(process.env.NEON_API_KEY, "NEON_API_KEY is required for beta owner access provisioning.");
  invariant(config.branchName !== "production", "Refusing to provision beta owner access on Neon production.");
  invariant(
    config.branchName !== "outpost-neon-spike",
    "Refusing to provision beta owner access on the Neon migration spike branch."
  );
  invariant(OWNER_NAME.length > 0, "OUTPOST_OWNER_BETA_NAME is required.");
  invariant(OWNER_NAME.length <= 120, "OUTPOST_OWNER_BETA_NAME must be 120 characters or fewer.");
  invariant(OWNER_PASSWORD.length >= 12, "OUTPOST_OWNER_BETA_PASSWORD must be at least 12 characters.");
  invariant(OWNER_PASSWORD !== "outpost-local-password", "Refusing to use the local seed password for a hosted beta owner.");
  invariant(OWNER_PASSWORD.toLowerCase() !== OWNER_EMAIL, "OUTPOST_OWNER_BETA_PASSWORD must not equal the owner email.");
  invariant(GRANT_NOTE.length <= 500, "OUTPOST_OWNER_BETA_NOTE must be 500 characters or fewer.");
  invariant(CROSS_EMAIL !== OWNER_EMAIL, "OUTPOST_OWNER_BETA_CROSS_EMAIL must differ from OUTPOST_OWNER_BETA_EMAIL.");
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

function parsePsqlScalar(output) {
  return output
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("INFO:"))[0];
}

function runPsqlScript(sql) {
  const tempDir = mkdtempSync(join(tmpdir(), "outpost-owner-beta-access-"));
  const scriptPath = join(tempDir, "operator.sql");

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
    throw new Error("Neon Auth did not return a session cookie for the beta owner.");
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

async function signUpOrVerifyOwner() {
  const signUp = await authFetch("/sign-up/email", {
    body: JSON.stringify({
      callbackURL: `${APP_ORIGIN}/auth/callback`,
      email: OWNER_EMAIL,
      name: OWNER_NAME,
      password: OWNER_PASSWORD
    }),
    headers: { "Content-Type": "application/json" },
    method: "POST"
  });

  if (!signUp.ok && !String(signUp.body?.message ?? signUp.body?.error ?? "").match(/already|exist/i)) {
    throw new Error(`Unable to create Neon Auth beta owner ${OWNER_EMAIL}: ${JSON.stringify(signUp.body)}`);
  }

  const authUserId = parsePsqlScalar(
    runNeonPsql([
      "-t",
      "-A",
      "-c",
      `update neon_auth."user" set "emailVerified" = true where lower(email) = ${sqlLiteral(
        OWNER_EMAIL
      )} returning id;`
    ])
  );

  if (!authUserId) {
    throw new Error(`Unable to mark Neon Auth beta owner ${OWNER_EMAIL} as verified.`);
  }

  return authUserId;
}

function upsertBetaAccessGrant() {
  const grantId = `owner_beta_${randomUUID()}`;
  const sql = `
    insert into owner_beta_access_grants (
      id,
      email,
      display_name,
      status,
      note
    ) values (
      ${sqlLiteral(grantId)},
      ${sqlLiteral(OWNER_EMAIL)}::citext,
      ${sqlLiteral(OWNER_NAME)},
      'active',
      ${sqlLiteral(GRANT_NOTE)}
    )
    on conflict (email) do update
      set display_name = excluded.display_name,
          status = 'active',
          note = excluded.note,
          updated_at = now()
    returning id || '|' || email || '|' || status;
  `;

  return parsePsqlScalar(runNeonPsql(["-t", "-A", "-c", sql]));
}

async function signInOwner() {
  const response = await authFetch("/sign-in/email", {
    body: JSON.stringify({ email: OWNER_EMAIL, password: OWNER_PASSWORD }),
    headers: { "Content-Type": "application/json" },
    method: "POST"
  });

  if (!response.ok) {
    throw new Error(
      `Unable to sign in beta owner ${OWNER_EMAIL}. If the Auth user already existed, rotate its password or use a fresh proof email. ${JSON.stringify(
        response.body
      )}`
    );
  }

  const cookie = extractSessionCookie(response.headers.get("set-cookie"));
  const upstreamCookie = `${cookie.name}=${encodeURIComponent(decodeURIComponent(cookie.value))}`;
  const tokenResponse = await authFetch("/token", {
    headers: {
      Cookie: upstreamCookie
    }
  });

  if (!tokenResponse.ok || !tokenResponse.body?.token) {
    throw new Error(`Unable to fetch JWT for beta owner ${OWNER_EMAIL}: ${JSON.stringify(tokenResponse.body)}`);
  }

  return tokenResponse.body.token;
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

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function assertGrantIsCallerScoped(ownerToken) {
  let granted = false;
  let lastError = null;

  for (let attempt = 1; attempt <= 6; attempt += 1) {
    try {
      granted = await dataApiRpc("has_active_owner_beta_access", ownerToken, {
        p_owner_email: OWNER_EMAIL
      });
      lastError = null;
    } catch (error) {
      lastError = error;
    }

    if (granted === true) {
      break;
    }

    await sleep(500);
  }

  if (granted !== true) {
    if (lastError) {
      throw lastError;
    }

    throw new Error(`Beta owner grant check did not recognize ${OWNER_EMAIL}: ${JSON.stringify(granted)}`);
  }

  const crossEmailGranted = await dataApiRpc("has_active_owner_beta_access", ownerToken, {
    p_owner_email: CROSS_EMAIL
  });

  if (crossEmailGranted !== false) {
    throw new Error(
      `Beta owner grant check exposed another owner email (${CROSS_EMAIL}) to ${OWNER_EMAIL}: ${JSON.stringify(
        crossEmailGranted
      )}`
    );
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
        raise exception 'beta owner access provisioning unexpectedly found a live provider';
      end if;
    end $$;
  `);
}

async function main() {
  assertOperatorSafety();

  console.log("Outpost beta owner access provisioning");
  console.log(`Project: ${config.projectId}`);
  console.log(`Branch: ${config.branchName}`);
  console.log(`Owner: ${OWNER_EMAIL}`);
  console.log("Mode: operator-managed hosted Neon Auth + owner beta access grant, no live providers\n");

  const authUserId = await signUpOrVerifyOwner();
  console.log(`Neon Auth user verified: ${authUserId}`);

  const grant = upsertBetaAccessGrant();
  console.log(`Owner beta access grant active: ${grant}`);

  const ownerToken = await signInOwner();
  await assertGrantIsCallerScoped(ownerToken);
  console.log("Owner beta access grant is visible only to the signed-in owner email.");

  assertLiveProvidersBlocked();
  console.log("Live-provider gates remain blocked.");

  console.log("\nNext:");
  console.log(`- Have ${OWNER_EMAIL} sign in at /owner/sign-in with the temporary password supplied out of band.`);
  console.log("- After proof, rotate or discard this hosted proof branch and remove temporary credential material.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
