#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative, resolve, sep } from "node:path";

import { readHostedReadinessConfig } from "./hosted-preview-readiness-config.mjs";
import { withNeonApiKey } from "./neon-cli-auth.mjs";

const config = readHostedReadinessConfig();
const RECORD_PATH =
  process.env.OUTPOST_ADMIN_CUSTOMER_SESSION_RECORD_PATH ??
  "artifacts/admin-launch-readiness/admin-customer-observed-session-record.json";
const APP_ORIGIN = requireEnv("NEXT_PUBLIC_OUTPOST_APP_URL");
const AUTH_URL = requireEnv("NEXT_PUBLIC_NEON_AUTH_URL");
const DATA_API_URL = requireEnv("NEXT_PUBLIC_NEON_DATA_API_URL");
const SEED_PASSWORD = requireEnv("OUTPOST_NEON_SEED_PASSWORD");
const ROLE_NAME = process.env.OUTPOST_NEON_ROLE_NAME ?? "neondb_owner";
const RUN_ID = `customer_session_record_${Date.now().toString(36)}`;
const FOUNDER_EMAIL = `founder+${RUN_ID}@proof.outpost.local`;
const FOUNDER_NAME = "Outpost Customer Session Record Verifier";
const FOUNDER_USER_ID = `user_${RUN_ID}`;
const FOUNDER_MEMBERSHIP_ID = `member_${RUN_ID}`;
const PROOF_TENANT_ID =
  process.env.OUTPOST_CUSTOMER_SESSION_RECORD_TENANT_ID ??
  "tenant_acme_fitness";

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function requireEnv(name) {
  const value = process.env[name]?.trim();
  invariant(value, `${name} required.`);
  return value;
}

function assertNoSecretShapedValue(value, label) {
  const text = String(value);
  const secretValue =
    /\bBearer\s+[A-Za-z0-9._~+/=-]{12,}/u.test(text) ||
    /\bpostgres(?:ql)?:\/\/[^:\s/@]+:[^@\s]+@/iu.test(text) ||
    /\bnapi_[A-Za-z0-9]{20,}\b/u.test(text) ||
    /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}(?:\.[A-Za-z0-9_-]{8,})?\b/u.test(
      text,
    ) ||
    text.includes("__Secure-neon-auth") ||
    text.includes("outpost_neon_auth_session") ||
    /(?:password|token|cookie|api[_-]?key|authorization|credential|private[_-]?key|secret|bypass|signature|jwt)\s*[:=]/iu.test(
      text,
    );
  invariant(!secretValue, `${label} contains secret-shaped value.`);
}

function sqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function normalizeArtifactPath(rawPath, label) {
  const value = String(rawPath ?? "").trim();
  invariant(value, `${label} required.`);
  assertNoSecretShapedValue(value, label);
  invariant(!isAbsolute(value), `${label} must be relative.`);
  invariant(value.endsWith(".json"), `${label} must end with .json.`);

  const root = resolve(process.cwd(), "artifacts");
  const resolved = resolve(process.cwd(), value);
  const relativePath = relative(process.cwd(), resolved);
  const relativeToRoot = relative(root, resolved);
  invariant(
    relativeToRoot &&
      !relativeToRoot.startsWith("..") &&
      !relativeToRoot.split(sep).includes(".."),
    `${label} must stay under artifacts/.`,
  );
  invariant(relativePath === value, `${label} must be normalized.`);
  invariant(existsSync(resolved), `${label} does not exist.`);
  return { relativePath, resolved };
}

function runCommand(command, label, env = {}) {
  const result = spawnSync(command[0], command.slice(1), {
    cwd: process.cwd(),
    encoding: "utf8",
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const output = [result.stdout, result.stderr].filter(Boolean).join("\n");
  assertNoSecretShapedValue(output, label);
  if (result.status !== 0) {
    throw new Error(`${label} failed.\n${output}`);
  }
  return result.stdout;
}

function runNeonPsql(args, label) {
  return runCommand(
    [
      "neon",
      ...withNeonApiKey([
        "connection-string",
        config.branchName,
        "--project-id",
        config.projectId,
        "--database-name",
        config.databaseName,
        "--role-name",
        ROLE_NAME,
        "--psql",
        "--",
        ...args,
      ]),
    ],
    label,
  );
}

function runPsqlScript(sql, label) {
  const tempDir = mkdtempSync(
    join(tmpdir(), "outpost-customer-session-record-proof-"),
  );
  const scriptPath = join(tempDir, "proof.sql");
  try {
    writeFileSync(scriptPath, sql, "utf8");
    return runNeonPsql(["-v", "ON_ERROR_STOP=1", "-f", scriptPath], label);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

function parseFirstPsqlValue(output) {
  return output
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("INFO:"))[0];
}

function splitSetCookie(header) {
  return header
    ? header.split(/,(?=\s*[^;,]+=)/u).map((value) => value.trim())
    : [];
}

function extractSessionToken(header) {
  const raw = splitSetCookie(header).find((value) =>
    value.startsWith("__Secure-neon-auth.session_token="),
  );
  invariant(raw, "Neon Auth did not return session cookie.");
  const [nameValue] = raw.split(";");
  const index = nameValue.indexOf("=");
  return decodeURIComponent(nameValue.slice(index + 1));
}

async function authFetch(path, init = {}) {
  const response = await fetch(`${AUTH_URL}${path}`, {
    ...init,
    headers: {
      Origin: APP_ORIGIN,
      ...(init.headers ?? {}),
    },
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
    status: response.status,
  };
}

function safeJsonForError(value, label) {
  const serialized = JSON.stringify(value ?? {});
  assertNoSecretShapedValue(serialized, label);
  return serialized;
}

function lookupFounderAuthUserId() {
  const output = runNeonPsql(
    [
      "-t",
      "-A",
      "-c",
      `select id from neon_auth."user" where lower(email) = lower(${sqlLiteral(FOUNDER_EMAIL)}) limit 1;`,
    ],
    "Neon Auth customer session proof founder lookup",
  );
  return parseFirstPsqlValue(output);
}

function cleanupFounderAuthUser(authUserId) {
  runPsqlScript(
    `delete from neon_auth."user" where id = ${sqlLiteral(authUserId)}::uuid;`,
    "Customer session proof founder auth cleanup",
  );
}

function cleanupFounderAuthUserByEmail() {
  runPsqlScript(
    `delete from neon_auth."user" where lower(email) = lower(${sqlLiteral(FOUNDER_EMAIL)});`,
    "Customer session proof founder auth email cleanup",
  );
}

async function signUpVerifiedFounder() {
  const signUp = await authFetch("/sign-up/email", {
    body: JSON.stringify({
      callbackURL: `${APP_ORIGIN}/auth/callback`,
      email: FOUNDER_EMAIL,
      name: FOUNDER_NAME,
      password: SEED_PASSWORD,
    }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
  const alreadyExists =
    !signUp.ok &&
    String(signUp.body?.message ?? signUp.body?.error ?? "").match(
      /already|exist/iu,
    );
  if (!signUp.ok && !alreadyExists) {
    throw new Error(
      `Unable create proof founder admin Auth user: ${safeJsonForError(signUp.body, "Neon Auth sign-up error")}`,
    );
  }
  const authUserId = lookupFounderAuthUserId();
  if (!authUserId) {
    cleanupFounderAuthUserByEmail();
    throw new Error(
      "Unable locate proof founder admin Auth user after sign-up.",
    );
  }
  try {
    const output = runNeonPsql(
      [
        "-t",
        "-A",
        "-c",
        `update neon_auth."user" set "emailVerified" = true where id = ${sqlLiteral(authUserId)}::uuid returning id;`,
      ],
      "Neon Auth customer session proof founder verification",
    );
    invariant(
      parseFirstPsqlValue(output) === authUserId,
      "Unable verify proof founder admin Auth user.",
    );
    return authUserId;
  } catch (error) {
    cleanupFounderAuthUser(authUserId);
    throw error;
  }
}

function provisionFounderAdmin(authUserId) {
  runPsqlScript(
    `
insert into users (id, external_auth_id, email, name)
values (${sqlLiteral(FOUNDER_USER_ID)}, ${sqlLiteral(authUserId)}::uuid, ${sqlLiteral(FOUNDER_EMAIL)}, ${sqlLiteral(FOUNDER_NAME)})
on conflict (id) do update
  set external_auth_id = excluded.external_auth_id,
      email = excluded.email,
      name = excluded.name,
      updated_at = now();

insert into tenant_memberships (id, tenant_id, user_id, role, invite_status)
values (${sqlLiteral(FOUNDER_MEMBERSHIP_ID)}, ${sqlLiteral(PROOF_TENANT_ID)}, ${sqlLiteral(FOUNDER_USER_ID)}, 'founder_admin', 'active')
on conflict (tenant_id, user_id) do update
  set role = 'founder_admin',
      invite_status = 'active',
      updated_at = now();

insert into app_admins (id, user_id, status)
values (${sqlLiteral(`app_admin_${RUN_ID}`)}, ${sqlLiteral(FOUNDER_USER_ID)}, 'active')
on conflict (user_id) do update
  set status = 'active';
`,
    "Customer session proof founder admin provisioning",
  );
}

async function signInFounder() {
  const signIn = await authFetch("/sign-in/email", {
    body: JSON.stringify({ email: FOUNDER_EMAIL, password: SEED_PASSWORD }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
  if (!signIn.ok) {
    throw new Error(
      `Unable sign in proof founder admin: ${safeJsonForError(signIn.body, "Neon Auth sign-in error")}`,
    );
  }
  return extractSessionToken(signIn.headers.get("set-cookie"));
}

async function dataApiRpc(functionName, token, body = {}) {
  const response = await fetch(`${DATA_API_URL}/rpc/${functionName}`, {
    body: JSON.stringify(body),
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(
      `${functionName} failed: ${safeJsonForError(payload, `${functionName} error`)}`,
    );
  }
  return payload;
}

function readSessionRecordDigest() {
  const recordPath = normalizeArtifactPath(
    RECORD_PATH,
    "OUTPOST_ADMIN_CUSTOMER_SESSION_RECORD_PATH",
  );
  const raw = readFileSync(recordPath.resolved, "utf8");
  assertNoSecretShapedValue(raw, "customer session record artifact");
  const artifact = JSON.parse(raw);
  invariant(
    artifact.artifact_kind === "admin_customer_observed_session_record",
    "Customer session record kind mismatch.",
  );
  return {
    gymName: artifact.gym_name,
    sha256: createHash("sha256").update(raw).digest("hex"),
  };
}

function assertRecordVisible(report, expected) {
  invariant(
    report?.authorized === true,
    "Customer session record RPC must authorize proof founder admin.",
  );
  invariant(
    Array.isArray(report.rows),
    "Customer session record RPC rows must be array.",
  );
  const record = report.rows.find(
    (row) => row.session_record_sha256 === expected.sha256,
  );
  invariant(
    record,
    "Imported customer session record digest not visible through founder-admin RPC.",
  );
  invariant(
    record.gym_name === expected.gymName,
    "Customer session record gym mismatch.",
  );
  invariant(
    record.public_self_serve_launch_allowed === false,
    "Customer session record public self-serve must remain blocked.",
  );
  invariant(
    record.invite_delivery_allowed === false,
    "Customer session record invite delivery must remain blocked.",
  );
  invariant(
    record.live_provider_enablement_allowed === false,
    "Customer session record live providers must remain blocked.",
  );
  invariant(
    record.billing_pos_member_writes_allowed === false,
    "Customer session record billing/POS/member writes must remain blocked.",
  );
}

function assertFounderAdminDenied(report) {
  invariant(
    report?.authorized === false,
    "Unprovisioned customer session proof user must not be authorized.",
  );
  invariant(
    Array.isArray(report.rows) && report.rows.length === 0,
    "Unprovisioned customer session proof user must not see rows.",
  );
}

function cleanupFounderAdmin(authUserId) {
  runPsqlScript(
    `
delete from tenant_memberships where user_id = ${sqlLiteral(FOUNDER_USER_ID)};
delete from app_admins where user_id = ${sqlLiteral(FOUNDER_USER_ID)};
delete from users where id = ${sqlLiteral(FOUNDER_USER_ID)};
delete from neon_auth."user" where id = ${sqlLiteral(authUserId)}::uuid;
`,
    "Customer session proof founder admin cleanup",
  );
}

async function main() {
  invariant(
    config.branchName !== "production",
    "Refusing customer session record proof against production branch.",
  );
  invariant(
    config.branchName !== "outpost-neon-spike",
    "Refusing customer session record proof against migration spike branch.",
  );
  const expected = readSessionRecordDigest();
  runCommand(
    ["npm", "run", "admin:customer-session:record-hosted"],
    "Admin customer session hosted record import",
    {
      OUTPOST_ADMIN_CUSTOMER_SESSION_RECORD_PATH: normalizeArtifactPath(
        RECORD_PATH,
        "OUTPOST_ADMIN_CUSTOMER_SESSION_RECORD_PATH",
      ).relativePath,
    },
  );
  let authUserId = null;
  try {
    authUserId = await signUpVerifiedFounder();
    const unprovisionedToken = await signInFounder();
    const deniedReport = await dataApiRpc(
      "list_founder_admin_customer_session_records",
      unprovisionedToken,
    );
    assertFounderAdminDenied(deniedReport);
    provisionFounderAdmin(authUserId);
    const token = await signInFounder();
    const report = await dataApiRpc(
      "list_founder_admin_customer_session_records",
      token,
    );
    assertRecordVisible(report, expected);
  } finally {
    if (authUserId) cleanupFounderAdmin(authUserId);
  }
  console.log("Hosted customer session record proof passed.");
  console.log(`Record digest: ${expected.sha256.slice(0, 16)}`);
  console.log("Founder-admin RPC visibility: passed");
  console.log(
    "Public self-serve, invite delivery, providers, billing/POS/member writes: blocked",
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
