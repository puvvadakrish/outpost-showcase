import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { withNeonApiKey } from "./neon-cli-auth.mjs";

const PROJECT_ID = process.env.OUTPOST_NEON_PROJECT_ID ?? "outpost-test-project";
const BRANCH_NAME = process.env.OUTPOST_NEON_BRANCH_NAME ?? "outpost-neon-spike";
const DATABASE_NAME = process.env.OUTPOST_NEON_DATABASE_NAME ?? "neondb";
const ROLE_NAME = process.env.OUTPOST_NEON_ROLE_NAME ?? "neondb_owner";
const APP_ORIGIN = process.env.NEXT_PUBLIC_OUTPOST_APP_URL ?? "http://localhost:3000";
const AUTH_URL = requireEnv("NEXT_PUBLIC_NEON_AUTH_URL");
const DATA_API_URL = requireEnv("NEXT_PUBLIC_NEON_DATA_API_URL");
const SEED_PASSWORD = process.env.OUTPOST_NEON_SEED_PASSWORD ?? "outpost-local-password";

const SEEDED_ACCOUNTS = [
  {
    email: "owner-acme@example.com",
    fixedAuthId: "00000000-0000-0000-0000-000000000101",
    name: "Acme Fitness Owner"
  },
  {
    email: "owner-north@example.com",
    fixedAuthId: "00000000-0000-0000-0000-000000000202",
    name: "Peak CrossFit Owner"
  },
  {
    email: "staff-acme@example.com",
    fixedAuthId: "00000000-0000-0000-0000-000000000303",
    name: "Acme Fitness Front Desk"
  }
];

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required.`);
  }

  return value;
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
    cookie: response.headers.get("set-cookie")?.split(";")[0] ?? null,
    ok: response.ok,
    status: response.status
  };
}

async function ensureNeonAuthUser(account) {
  const signUp = await authFetch("/sign-up/email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      callbackURL: `${APP_ORIGIN}/auth/callback`,
      email: account.email,
      name: account.name,
      password: SEED_PASSWORD
    })
  });

  if (!signUp.ok && !String(signUp.body?.message ?? signUp.body?.error ?? "").match(/already|exist/i)) {
    throw new Error(`Unable to create Neon Auth seed user ${account.email}: ${JSON.stringify(signUp.body)}`);
  }

  const userId = parsePsqlScalar(
    runNeonPsql([
      "-t",
      "-A",
      "-c",
      `update neon_auth."user" set "emailVerified" = true where email = ${shellQuote(
        account.email
      )} returning id;`
    ])
  );

  if (!userId) {
    throw new Error(`Unable to resolve Neon Auth user id for ${account.email}.`);
  }

  return {
    ...account,
    neonAuthId: userId
  };
}

async function signInForJwt(email) {
  const signIn = await authFetch("/sign-in/email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      password: SEED_PASSWORD
    })
  });

  if (!signIn.ok || !signIn.cookie) {
    throw new Error(`Unable to sign in ${email}: ${JSON.stringify(signIn.body)}`);
  }

  const tokenResponse = await authFetch("/token", {
    headers: {
      Cookie: signIn.cookie
    }
  });

  if (!tokenResponse.ok || !tokenResponse.body?.token) {
    throw new Error(`Unable to fetch JWT for ${email}: ${JSON.stringify(tokenResponse.body)}`);
  }

  return tokenResponse.body.token;
}

function buildNeonSeedSql(accounts) {
  const replacements = new Map(accounts.map((account) => [account.fixedAuthId, account.neonAuthId]));
  let seedSql = readFileSync("neon/seed.sql", "utf8");

  for (const [fixedAuthId, neonAuthId] of replacements) {
    seedSql = seedSql.replaceAll(fixedAuthId, neonAuthId);
  }

  const authIdFixups = accounts
    .map(
      (account) =>
        `update users set external_auth_id = ${shellQuote(account.neonAuthId)}::uuid where lower(email::text) = ${shellQuote(account.email)};`
    )
    .join("\n");

  return `${seedSql}\n\n${authIdFixups}\n`;
}

function applySeed(seedSql) {
  const tempDir = mkdtempSync(join(tmpdir(), "outpost-neon-seed-"));
  const seedPath = join(tempDir, "seed.sql");

  try {
    writeFileSync(seedPath, seedSql);
    runNeonPsql(["-v", "ON_ERROR_STOP=1", "-f", seedPath]);
  } finally {
    rmSync(tempDir, { force: true, recursive: true });
  }
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

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function dataApiReadUntil(path, token, predicate, description) {
  let lastBody = null;

  for (let attempt = 1; attempt <= 10; attempt += 1) {
    lastBody = await dataApiRead(path, token);

    if (predicate(lastBody)) {
      return lastBody;
    }

    await delay(500);
  }

  throw new Error(`${description}: ${JSON.stringify(lastBody)}`);
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

async function main() {
  console.log("Outpost Neon spike readiness");
  console.log(`Project: ${PROJECT_ID}`);
  console.log(`Branch: ${BRANCH_NAME}`);
  console.log("Mode: Neon Auth + Data API + RLS, no legacy backend SDK, no live providers\n");

  const accounts = [];
  for (const account of SEEDED_ACCOUNTS) {
    const seededAccount = await ensureNeonAuthUser(account);
    accounts.push(seededAccount);
    console.log(`Seed Auth: ${account.email} -> ${seededAccount.neonAuthId}`);
  }

  applySeed(buildNeonSeedSql(accounts));
  console.log("Seed SQL: applied app rows with Neon Auth ids");

  const houseToken = await signInForJwt("owner-acme@example.com");
  const northToken = await signInForJwt("owner-north@example.com");

  const houseTenants = await dataApiReadUntil(
    "/tenants?select=id,slug&slug=eq.acme-fitness",
    houseToken,
    (rows) => Array.isArray(rows) && rows.length === 1 && rows[0]?.id === "tenant_acme_fitness",
    "House owner did not see expected tenant"
  );
  const northTenantsForHouse = await dataApiRead("/tenants?select=id,slug&slug=eq.peak-crossfit", houseToken);
  const houseTenantsForNorth = await dataApiRead("/tenants?select=id,slug&slug=eq.acme-fitness", northToken);

  if (northTenantsForHouse.length !== 0) {
    throw new Error(`House owner could read Peak CrossFit tenant: ${JSON.stringify(northTenantsForHouse)}`);
  }

  if (houseTenantsForNorth.length !== 0) {
    throw new Error(`North owner could read House tenant: ${JSON.stringify(houseTenantsForNorth)}`);
  }

  console.log("RLS read proof: own tenant visible, cross-tenant rows hidden");

  const mutationNote = `Neon readiness mutation proof ${new Date().toISOString()}`;
  const editedAnswer = await dataApiRpc("edit_answer_bank_draft", houseToken, {
    p_answer: "Staffed hours are pending owner approval before live use. Neon readiness mutation proof passed.",
    p_answer_bank_entry_id: "answer_hours",
    p_note: mutationNote,
    p_question: "What are your staffed hours?",
    p_tenant_id: "tenant_acme_fitness",
    p_topic: "hours"
  });

  if (editedAnswer?.id !== "answer_hours" || editedAnswer?.tenant_id !== "tenant_acme_fitness") {
    throw new Error(`Answer edit RPC returned an unexpected row: ${JSON.stringify(editedAnswer)}`);
  }

  const revisionRows = await dataApiRead(
    `/answer_bank_revisions?select=id&tenant_id=eq.tenant_acme_fitness&answer_bank_entry_id=eq.answer_hours&note=eq.${encodeURIComponent(
      mutationNote
    )}`,
    houseToken
  );
  const auditRows = await dataApiRead(
    `/audit_events?select=id&tenant_id=eq.tenant_acme_fitness&subject_type=eq.answer_bank_entry&subject_id=eq.answer_hours&action=eq.answer_bank_entry.draft_edited`,
    houseToken
  );

  if (revisionRows.length !== 1) {
    throw new Error(`Answer edit did not create exactly one matching revision row: ${JSON.stringify(revisionRows)}`);
  }

  if (auditRows.length < 1) {
    throw new Error("Answer edit did not create a visible audit row.");
  }

  await dataApiRpc(
    "edit_answer_bank_draft",
    northToken,
    {
      p_answer: "Cross-tenant mutation should fail.",
      p_answer_bank_entry_id: "answer_hours",
      p_note: "Cross-tenant mutation denial proof",
      p_question: "What are your staffed hours?",
      p_tenant_id: "tenant_acme_fitness",
      p_topic: "hours"
    },
    { expectError: true }
  );

  console.log("RLS mutation proof: answer edit wrote revision/audit rows and cross-tenant edit was denied");
  console.log("Live-provider gates remain blocked.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
