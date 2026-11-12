#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readHostedReadinessConfig } from "./hosted-preview-readiness-config.mjs";
import { withNeonApiKey } from "./neon-cli-auth.mjs";

const config = readHostedReadinessConfig();
const SUMMARY_PATH =
  process.env.OUTPOST_BETA_PROOF_RUN_SUMMARY_PATH ?? "artifacts/admin-launch-readiness/beta-proof-run-summary.json";
const APP_ORIGIN = requireEnv("NEXT_PUBLIC_OUTPOST_APP_URL");
const AUTH_URL = requireEnv("NEXT_PUBLIC_NEON_AUTH_URL");
const DATA_API_URL = requireEnv("NEXT_PUBLIC_NEON_DATA_API_URL");
const SEED_PASSWORD = requireEnv("OUTPOST_NEON_SEED_PASSWORD");
const ROLE_NAME = process.env.OUTPOST_NEON_ROLE_NAME ?? "neondb_owner";
const RUN_ID = `beta_proof_record_${Date.now().toString(36)}`;
const FOUNDER_EMAIL = `founder+${RUN_ID}@proof.outpost.local`;
const FOUNDER_NAME = "Outpost Beta Proof Record Verifier";
const FOUNDER_USER_ID = `user_${RUN_ID}`;
const FOUNDER_ADMIN_ID = `app_admin_${RUN_ID}`;
const FOUNDER_MEMBERSHIP_ID = `member_${RUN_ID}`;
const PROOF_TENANT_ID = process.env.OUTPOST_BETA_PROOF_RUN_RECORD_TENANT_ID ?? "tenant_acme_fitness";

function invariant(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
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
    /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}(?:\.[A-Za-z0-9_-]{8,})?\b/u.test(text) ||
    text.includes("__Secure-neon-auth") ||
    text.includes("outpost_neon_auth_session") ||
    /(?:password|token|cookie|api[_-]?key|authorization|credential|private[_-]?key|secret|bypass|signature|jwt)["']?\s*[:=]/iu.test(
      text
    );

  invariant(!secretValue, `${label} contains a secret-shaped value.`);
}

function safeJsonForError(value, label) {
  const text = JSON.stringify(value);
  assertNoSecretShapedValue(text, label);
  return text;
}

function sqlLiteral(value) {
  return `'${String(value).replace(/'/gu, "''")}'`;
}

function normalizePreviewOrigin(value, label) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${label} must be a valid URL.`);
  }

  const localHosts = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);
  invariant(url.protocol === "https:", `${label} must use https.`);
  invariant(url.hostname.endsWith(".vercel.app"), `${label} must be a Vercel Preview origin.`);
  invariant(!localHosts.has(url.hostname), `${label} must not be local.`);
  invariant(!url.username && !url.password, `${label} must not include embedded credentials.`);
  url.pathname = "";
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/u, "");
}

function runCommand(args, label) {
  const result = spawnSync(args[0], args.slice(1), {
    cwd: process.cwd(),
    encoding: "utf8",
    env: process.env
  });

  if (result.status !== 0) {
    assertNoSecretShapedValue(result.stdout, `${label} stdout`);
    assertNoSecretShapedValue(result.stderr, `${label} stderr`);
    throw new Error(`${label} failed.\n${result.stdout}\n${result.stderr}`);
  }

  assertNoSecretShapedValue(result.stdout, `${label} stdout`);
  assertNoSecretShapedValue(result.stderr, `${label} stderr`);
  return result.stdout;
}

function runNeonPsql(args, label) {
  const result = spawnSync(
    "neon",
    withNeonApiKey([
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
      ...args
    ]),
    {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    }
  );

  if (result.status !== 0) {
    assertNoSecretShapedValue(result.stdout, `${label} stdout`);
    assertNoSecretShapedValue(result.stderr, `${label} stderr`);
    throw new Error(`${label} failed.\n${result.stderr || result.stdout}`);
  }

  assertNoSecretShapedValue(result.stdout, `${label} stdout`);
  assertNoSecretShapedValue(result.stderr, `${label} stderr`);
  return result.stdout;
}

function runPsqlScript(sql, label) {
  const tempDir = mkdtempSync(join(tmpdir(), "outpost-beta-proof-record-proof-"));
  const scriptPath = join(tempDir, "proof.sql");
  try {
    writeFileSync(scriptPath, sql, "utf8");
    return runNeonPsql(["-v", "ON_ERROR_STOP=1", "-f", scriptPath], label);
  } finally {
    rmSync(tempDir, { force: true, recursive: true });
  }
}

function readSummary() {
  invariant(existsSync(SUMMARY_PATH), `Hosted beta proof-run summary not found at ${SUMMARY_PATH}.`);
  const raw = readFileSync(SUMMARY_PATH, "utf8");
  assertNoSecretShapedValue(raw, "hosted beta proof-run summary");
  const summary = JSON.parse(raw);
  invariant(summary.summary_kind === "hosted_beta_request_proof_run_summary", "summary kind mismatch.");
  invariant(summary.ready_for_next_slice === true, "summary must be ready for next slice.");

  const appOrigin = normalizePreviewOrigin(summary.app_origin, "summary Preview origin");
  invariant(appOrigin === normalizePreviewOrigin(APP_ORIGIN, "configured Preview origin"), "summary Preview origin mismatch.");
  invariant(summary.neon_branch_name === config.branchName, "summary Neon branch mismatch.");
  invariant(summary.proofs?.browser_request?.status === "passed", "browser proof must pass.");
  invariant(summary.proofs?.request_chain?.status === "passed", "request-chain proof must pass.");
  invariant(/^[a-f0-9]{64}$/u.test(summary.proofs.browser_request.artifact_sha256), "browser artifact hash required.");
  invariant(/^[a-f0-9]{64}$/u.test(summary.proofs.request_chain.artifact_sha256), "request-chain artifact hash required.");
  invariant(summary.blocked_gates?.includes("Public self-serve launch"), "summary must block public self-serve.");
  invariant(summary.blocked_gates?.includes("Phone/email providers"), "summary must block phone/email providers.");
  invariant(
    summary.blocked_gates?.includes("POS/access control/member-ledger writes"),
    "summary must block POS/access control/member-ledger writes."
  );

  return {
    appOrigin,
    browserArtifactSha256: summary.proofs.browser_request.artifact_sha256,
    browserCleanup: summary.cleanup?.browser_request,
    chainArtifactSha256: summary.proofs.request_chain.artifact_sha256,
    chainCleanup: summary.cleanup?.request_chain,
    neonBranchName: summary.neon_branch_name,
    summarySha256: createHash("sha256").update(raw).digest("hex")
  };
}

function splitSetCookie(header) {
  return header ? header.split(/,(?=\s*[^;,]+=)/u).map((value) => value.trim()) : [];
}

function extractSessionToken(header) {
  const raw = splitSetCookie(header).find((value) => value.startsWith("__Secure-neon-auth.session_token="));
  invariant(raw, "Neon Auth did not return session token.");
  const [nameValue] = raw.split(";");
  const index = nameValue.indexOf("=");
  return decodeURIComponent(nameValue.slice(index + 1));
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
  return { body, headers: response.headers, ok: response.ok, status: response.status };
}

function parseFirstPsqlValue(output) {
  return (
    output
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("INFO:"))[0] ?? null
  );
}

function lookupFounderAuthUserId() {
  const output = runNeonPsql(
    [
      "-t",
      "-A",
      "-c",
      `select id from neon_auth."user" where lower(email) = lower(${sqlLiteral(FOUNDER_EMAIL)}) limit 1;`
    ],
    "Neon Auth proof founder lookup"
  );
  return parseFirstPsqlValue(output);
}

function cleanupFounderAuthUser(authUserId) {
  runPsqlScript(
    `
delete from neon_auth."user"
where id = ${sqlLiteral(authUserId)}::uuid;
`,
    "Proof founder auth cleanup"
  );
}

function cleanupFounderAuthUserByEmail() {
  runPsqlScript(
    `
delete from neon_auth."user"
where lower(email) = lower(${sqlLiteral(FOUNDER_EMAIL)});
`,
    "Proof founder auth email cleanup"
  );
}

async function signUpVerifiedFounder() {
  const signUp = await authFetch("/sign-up/email", {
    body: JSON.stringify({
      callbackURL: `${APP_ORIGIN}/auth/callback`,
      email: FOUNDER_EMAIL,
      name: FOUNDER_NAME,
      password: SEED_PASSWORD
    }),
    headers: { "Content-Type": "application/json" },
    method: "POST"
  });

  const alreadyExists = !signUp.ok && String(signUp.body?.message ?? signUp.body?.error ?? "").match(/already|exist/iu);
  if (!signUp.ok && !alreadyExists) {
    throw new Error(`Unable create proof founder admin Auth user: ${safeJsonForError(signUp.body, "Neon Auth sign-up error")}`);
  }

  const authUserId = lookupFounderAuthUserId();
  if (!authUserId) {
    cleanupFounderAuthUserByEmail();
    throw new Error("Unable locate proof founder admin Auth user after sign-up.");
  }

  try {
    const output = runNeonPsql(
      [
        "-t",
        "-A",
        "-c",
        `update neon_auth."user" set "emailVerified" = true where id = ${sqlLiteral(authUserId)}::uuid returning id;`
      ],
      "Neon Auth proof founder verification"
    );
    const verifiedAuthUserId = parseFirstPsqlValue(output);
    invariant(verifiedAuthUserId === authUserId, "Unable verify proof founder admin Auth user.");
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
values (${sqlLiteral(FOUNDER_MEMBERSHIP_ID)}, ${sqlLiteral(PROOF_TENANT_ID)}, ${sqlLiteral(
      FOUNDER_USER_ID
    )}, 'founder_admin', 'active')
on conflict (tenant_id, user_id) do update
set role = 'founder_admin',
    invite_status = 'active',
    updated_at = now();
`,
    "Proof founder admin provisioning"
  );
}

async function signInFounder() {
  const signIn = await authFetch("/sign-in/email", {
    body: JSON.stringify({ email: FOUNDER_EMAIL, password: SEED_PASSWORD }),
    headers: { "Content-Type": "application/json" },
    method: "POST"
  });
  if (!signIn.ok) {
    throw new Error(`Unable sign in proof founder admin: ${safeJsonForError(signIn.body, "Neon Auth sign-in error")}`);
  }
  return extractSessionToken(signIn.headers.get("set-cookie"));
}

async function dataApiRpc(functionName, token, body = {}) {
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
    throw new Error(`Data API RPC ${functionName} failed: ${response.status} ${safeJsonForError(payload, `${functionName} error`)}`);
  }

  assertNoSecretShapedValue(JSON.stringify(payload), `Data API RPC ${functionName} response`);
  return payload;
}

function assertRecordVisible(report, proof) {
  assertNoSecretShapedValue(JSON.stringify(report), "founder-admin proof-run summary RPC report");
  invariant(report?.authorized === true, "Founder admin proof-run summary report must be authorized.");
  const record = report.rows?.find((candidate) => candidate.summary_sha256 === proof.summarySha256);
  invariant(record, "Founder admin proof-run summary RPC did not return imported summary digest.");
  invariant(record.app_origin === proof.appOrigin, "Proof-run summary record Preview mismatch.");
  invariant(record.neon_branch_name === proof.neonBranchName, "Proof-run summary record branch mismatch.");
  invariant(record.browser_artifact_sha256 === proof.browserArtifactSha256, "Browser proof artifact digest mismatch.");
  invariant(record.chain_artifact_sha256 === proof.chainArtifactSha256, "Request-chain proof artifact digest mismatch.");
  invariant(record.public_self_serve_launch_allowed === false, "Proof-run record unexpectedly allows public self-serve.");
  invariant(record.live_provider_enablement_allowed === false, "Proof-run record unexpectedly allows live providers.");
}

function cleanupFounderAdmin(authUserId) {
  runPsqlScript(
    `
delete from app_admins
where id = ${sqlLiteral(FOUNDER_ADMIN_ID)};

delete from tenant_memberships
where id = ${sqlLiteral(FOUNDER_MEMBERSHIP_ID)};

delete from users
where id = ${sqlLiteral(FOUNDER_USER_ID)};

delete from neon_auth."user"
where id = ${sqlLiteral(authUserId)}::uuid;
`,
    "Proof founder admin cleanup"
  );
}

async function main() {
  invariant(config.branchName !== "production", "Refusing beta proof-run record proof against production branch.");
  invariant(config.branchName !== "outpost-neon-spike", "Refusing beta proof-run record proof against migration spike branch.");

  const proof = readSummary();
  runCommand(["npm", "run", "hosted:beta-proof-run:summary:inspect"], "Hosted beta proof-run summary inspect");
  runCommand(["npm", "run", "hosted:beta-proof-run:record"], "Hosted beta proof-run summary record import");

  let authUserId = null;
  try {
    authUserId = await signUpVerifiedFounder();
    provisionFounderAdmin(authUserId);
    const token = await signInFounder();
    const report = await dataApiRpc("list_founder_admin_beta_proof_run_summary_records", token);
    assertRecordVisible(report, proof);
  } finally {
    if (authUserId) {
      cleanupFounderAdmin(authUserId);
    }
  }

  console.log("Hosted beta proof-run record proof passed.");
  console.log(`Preview: ${proof.appOrigin}`);
  console.log(`Branch: ${proof.neonBranchName}`);
  console.log(`Summary: ${proof.summarySha256.slice(0, 16)}`);
  console.log("Founder-admin RPC visibility: passed");
  console.log("Public self-serve and live-provider gates: blocked");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
