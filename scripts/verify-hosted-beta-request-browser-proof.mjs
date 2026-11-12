#!/usr/bin/env node
import { spawnSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { readHostedReadinessConfig } from "./hosted-preview-readiness-config.mjs";
import { withNeonApiKey } from "./neon-cli-auth.mjs";

const config = readHostedReadinessConfig();
const DATABASE_NAME = process.env.OUTPOST_NEON_DATABASE_NAME ?? config.databaseName ?? "neondb";
const ROLE_NAME = process.env.OUTPOST_NEON_ROLE_NAME ?? "neondb_owner";
const APP_ORIGIN = normalizeHostedAppOrigin(
  process.env.OUTPOST_BETA_REQUEST_BROWSER_APP_URL ??
    process.env.OUTPOST_VERCEL_DEPLOYMENT_URL ??
    process.env.NEXT_PUBLIC_OUTPOST_APP_URL
);
const VERCEL_BYPASS_SECRET = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
const CHROME_PATH = process.env.OUTPOST_CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const HEADLESS = process.env.OUTPOST_BETA_REQUEST_BROWSER_HEADLESS !== "0";
const RUN_ID = normalizeRunId(process.env.OUTPOST_BETA_REQUEST_BROWSER_RUN_ID ?? `beta_request_browser_${Date.now().toString(36)}`);
const OWNER_EMAIL = normalizeEmail(
  process.env.OUTPOST_BETA_REQUEST_BROWSER_EMAIL ?? `${RUN_ID}@beta-browser-proof.outpost.local`
);
const PROOF_REQUEST_ID = ownerBetaRequestId(OWNER_EMAIL);
const OWNER_NAME =
  process.env.OUTPOST_BETA_REQUEST_BROWSER_OWNER_NAME?.trim() || "Hosted Beta Request Browser Owner";
const GYM_NAME =
  process.env.OUTPOST_BETA_REQUEST_BROWSER_GYM_NAME?.trim() || `Hosted Beta Request Browser Gym ${RUN_ID}`;
const LOCATION_HINT =
  process.env.OUTPOST_BETA_REQUEST_BROWSER_LOCATION?.trim() || "Protected Preview browser request proof";
const NOTE = process.env.OUTPOST_BETA_REQUEST_BROWSER_NOTE?.trim() || "Browser-submitted beta request proof.";
const RETAIN_PROOF_DATA = process.env.OUTPOST_BETA_REQUEST_BROWSER_RETAIN === "1";
const ARTIFACT_DIR = join("artifacts", "admin-launch-readiness", RUN_ID);
const EVIDENCE_PATH =
  process.env.OUTPOST_BETA_REQUEST_BROWSER_EVIDENCE_PATH ??
  join(ARTIFACT_DIR, "owner-beta-request-browser-proof.json");

let cleanupArmed = false;
let proofRequestId = null;

function invariant(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} required.`);
  }
  return value;
}

function normalizeHostedAppOrigin(rawValue) {
  invariant(rawValue, "OUTPOST_BETA_REQUEST_BROWSER_APP_URL or OUTPOST_VERCEL_DEPLOYMENT_URL required.");
  let url;
  try {
    url = new URL(rawValue);
  } catch {
    throw new Error("Hosted beta request browser proof app URL is not valid.");
  }
  invariant(url.protocol === "https:", "Hosted beta request browser proof must use an HTTPS Vercel Preview URL.");
  invariant(url.hostname.endsWith(".vercel.app"), "Hosted beta request browser proof must target a Vercel Preview URL.");
  invariant(
    url.hostname !== "outpost-preview-20260610.vercel.app" && url.hostname !== "outpost.vercel.app",
    "Hosted beta request browser proof must not target production-like Vercel origin."
  );
  invariant(!url.username && !url.password, "Hosted beta request browser proof URL must not include credentials.");
  url.pathname = "";
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/u, "");
}

function normalizeRunId(value) {
  const normalized = String(value).toLowerCase().replace(/[^a-z0-9_-]/gu, "_").slice(0, 80);
  invariant(normalized.length > 0, "OUTPOST_BETA_REQUEST_BROWSER_RUN_ID must contain letters or numbers.");
  return normalized;
}

function normalizeEmail(value) {
  const normalized = String(value).trim().toLowerCase();
  invariant(/^[^@\s]+@[^@\s]+\.[^@\s]+$/u.test(normalized), "Proof owner email must be valid.");
  return normalized;
}

function ownerBetaRequestId(email) {
  return `owner_beta_request_${createHash("sha256").update(email).digest("hex")}`;
}

function assertNoSecretShapedValue(value, label) {
  const text = String(value);
  const secretValue =
    /\bBearer\s+[A-Za-z0-9._~+/=-]{12,}/u.test(text) ||
    /\bnapi_[A-Za-z0-9]{20,}\b/u.test(text) ||
    /\bpostgres(?:ql)?:\/\/[^:\s/@]+:[^@\s]+@/iu.test(text) ||
    /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}(?:\.[A-Za-z0-9_-]{8,})?\b/u.test(text) ||
    text.includes("__Secure-neon-auth") ||
    text.includes("outpost_neon_auth_session") ||
    /(?:password|token|cookie|api[_-]?key|authorization|credential|private[_-]?key|secret|bypass|signature|jwt)\s*[:=]/iu.test(
      text
    );
  invariant(!secretValue, `${label} contains secret-shaped value.`);
}

function assertProofSafety() {
  requireEnv("NEON_API_KEY");
  invariant(existsSync(CHROME_PATH), `Chrome executable was not found at ${CHROME_PATH}.`);
  invariant(VERCEL_BYPASS_SECRET, "VERCEL_AUTOMATION_BYPASS_SECRET required protected Vercel Preview browser proof.");
  invariant(config.branchName !== "production", "Refusing hosted beta request browser proof on Neon production.");
  invariant(
    config.branchName !== "outpost-neon-spike",
    "Refusing hosted beta request browser proof on Neon migration spike branch."
  );
  invariant(
    OWNER_EMAIL.endsWith("@beta-browser-proof.outpost.local"),
    "OUTPOST_BETA_REQUEST_BROWSER_EMAIL must use the disposable @beta-browser-proof.outpost.local domain."
  );
  assertNoSecretShapedValue(OWNER_NAME, "owner name");
  assertNoSecretShapedValue(GYM_NAME, "gym name");
  assertNoSecretShapedValue(LOCATION_HINT, "location hint");
  assertNoSecretShapedValue(NOTE, "request note");
}

function sqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function runCommand(command, label) {
  const result = spawnSync(command[0], command.slice(1), {
    cwd: process.cwd(),
    encoding: "utf8",
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"]
  });
  const output = [result.stdout, result.stderr].filter(Boolean).join("\n");
  assertNoSecretShapedValue(output, label);
  if (result.status !== 0) {
    throw new Error(`${label} failed.\n${output}`);
  }
  return output.trim();
}

function runNeonPsql(args) {
  return runCommand(
    [
      "neon",
      ...withNeonApiKey([
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
      ])
    ],
    "Neon psql hosted beta request browser proof"
  );
}

function runPsqlScript(sql) {
  const tempDir = mkdtempSync(join(tmpdir(), "outpost-hosted-beta-request-browser-"));
  const scriptPath = join(tempDir, "proof.sql");
  try {
    writeFileSync(scriptPath, sql);
    return runNeonPsql(["-t", "-A", "-q", "-v", "ON_ERROR_STOP=1", "-f", scriptPath]);
  } finally {
    rmSync(tempDir, { force: true, recursive: true });
  }
}

function parsePsqlJson(output, label) {
  const line = output
    .split(/\r?\n/u)
    .map((value) => value.trim())
    .find((value) => value && value.startsWith("{"));
  invariant(line, `${label} returned no JSON payload.`);
  assertNoSecretShapedValue(line, label);
  return JSON.parse(line);
}

function loadRequest() {
  return parsePsqlJson(
    runPsqlScript(`
select coalesce(
  (
    select jsonb_build_object(
      'created_at', created_at,
      'email', email::text,
      'gym_name', gym_name,
      'id', id,
      'last_requested_at', last_requested_at,
      'location_hint', location_hint,
      'owner_name', owner_name,
      'request_count', request_count,
      'status', status::text,
      'updated_at', updated_at
    )
    from owner_beta_access_requests
    where lower(email::text) = lower(${sqlLiteral(OWNER_EMAIL)})
  ),
  '{}'::jsonb
);
`),
    "hosted beta request browser proof lookup"
  );
}

function verifyNoLiveProviders() {
  return parsePsqlJson(
    runPsqlScript(`
with unexpected_live_provider_records as (
  select count(*)::integer as total
  from provider_connections
  where status not in ('not_configured', 'disabled', 'pending_review')
     or secret_ref is not null
     or nullif(external_account_label, '') is not null
)
select jsonb_build_object(
  'unexpected_live_provider_records', (select total from unexpected_live_provider_records)
);
`),
    "hosted beta request browser provider gate"
  );
}

async function verifyPreviewRuntimeBranch() {
  const response = await fetch(`${APP_ORIGIN}/admin`, {
    headers: {
      "x-vercel-protection-bypass": VERCEL_BYPASS_SECRET,
      "x-vercel-set-bypass-cookie": "true"
    }
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Unable to verify protected Preview runtime branch before browser submit: ${response.status}.`);
  }
  assertNoSecretShapedValue(text, "protected Preview admin branch probe");
  invariant(
    text.includes(config.branchName),
    "Protected Preview runtime branch did not match OUTPOST_NEON_BRANCH_NAME before browser submit."
  );
}

function cleanupProofData() {
  if (!cleanupArmed) {
    return;
  }
  if (RETAIN_PROOF_DATA) {
    console.log("Disposable browser request retained with OUTPOST_BETA_REQUEST_BROWSER_RETAIN=1.");
    return;
  }
  invariant(proofRequestId, "Refusing cleanup without created disposable owner beta request id.");
  runPsqlScript(`
delete from owner_beta_access_requests where id = ${sqlLiteral(proofRequestId)} and lower(email::text) = lower(${sqlLiteral(OWNER_EMAIL)});
`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForPortFile(userDataDir) {
  const portFile = join(userDataDir, "DevToolsActivePort");
  const startedAt = Date.now();
  while (Date.now() - startedAt < 15_000) {
    if (existsSync(portFile)) {
      const [port] = readFileSync(portFile, "utf8").trim().split(/\r?\n/u);
      if (port) {
        return Number(port);
      }
    }
    await sleep(100);
  }
  throw new Error("Chrome did not expose DevToolsActivePort file.");
}

async function fetchJson(url, init) {
  const response = await fetch(url, init);
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${url} returned ${response.status}: ${text}`);
  }
  return JSON.parse(text);
}

class CdpSession {
  constructor(socket) {
    this.listeners = new Map();
    this.nextId = 1;
    this.pending = new Map();
    this.socket = socket;
    this.socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (!message.id) {
        const listeners = this.listeners.get(message.method) ?? [];
        for (const listener of listeners) {
          listener(message.params ?? {});
        }
        return;
      }
      const pending = this.pending.get(message.id);
      if (!pending) {
        return;
      }
      this.pending.delete(message.id);
      if (message.error) {
        pending.reject(new Error(`${pending.method} failed: ${JSON.stringify(message.error)}`));
      } else {
        pending.resolve(message.result ?? {});
      }
    });
  }

  send(method, params = {}) {
    const id = this.nextId;
    this.nextId += 1;
    const result = new Promise((resolve, reject) => {
      this.pending.set(id, { method, reject, resolve });
    });
    this.socket.send(JSON.stringify({ id, method, params }));
    return result;
  }

  on(method, handler) {
    const listeners = this.listeners.get(method) ?? [];
    listeners.push(handler);
    this.listeners.set(method, listeners);
  }
}

async function connectToTarget(port) {
  const target = await fetchJson(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" });
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Timed out connecting Chrome target.")), 10_000);
    socket.addEventListener("open", () => {
      clearTimeout(timeout);
      resolve();
    });
    socket.addEventListener("error", () => {
      clearTimeout(timeout);
      reject(new Error("Unable to connect Chrome target."));
    });
  });
  return { cdp: new CdpSession(socket), socket };
}

async function evaluate(cdp, expression) {
  const result = await cdp.send("Runtime.evaluate", {
    awaitPromise: true,
    expression,
    returnByValue: true
  });
  if (result.exceptionDetails) {
    throw new Error(`Browser evaluation failed: ${JSON.stringify(result.exceptionDetails)}`);
  }
  return result.result?.value;
}

async function waitFor(cdp, label, expression, timeoutMs = 15_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const value = await evaluate(cdp, expression);
    if (value) {
      return value;
    }
    await sleep(250);
  }
  throw new Error(`Timed out waiting for ${label}.`);
}

async function submitRequestInBrowser() {
  const userDataDir = mkdtempSync(join(tmpdir(), "outpost-beta-request-browser-"));
  const chromeArgs = [
    `--remote-debugging-port=0`,
    `--user-data-dir=${userDataDir}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-background-networking",
    "--disable-features=Translate,OptimizationHints,MediaRouter",
    "about:blank"
  ];
  if (HEADLESS) {
    chromeArgs.unshift("--headless=new");
  }

  const chrome = spawn(CHROME_PATH, chromeArgs, { stdio: ["ignore", "pipe", "pipe"] });
  let stderr = "";
  chrome.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });

  let socket;
  try {
    const port = await waitForPortFile(userDataDir);
    const connected = await connectToTarget(port);
    const cdp = connected.cdp;
    socket = connected.socket;
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Network.enable");
    cdp.on("Fetch.requestPaused", (event) => {
      const requestUrl = event.request?.url ?? "";
      const headers = Object.entries(event.request?.headers ?? {})
        .filter(([name]) => {
          const lowerName = name.toLowerCase();
          return lowerName !== "x-vercel-protection-bypass" && lowerName !== "x-vercel-set-bypass-cookie";
        })
        .map(([name, value]) => ({ name, value: String(value) }));
      if (requestUrl.startsWith(`${APP_ORIGIN}/`)) {
        headers.push(
          { name: "x-vercel-protection-bypass", value: VERCEL_BYPASS_SECRET },
          { name: "x-vercel-set-bypass-cookie", value: "true" }
        );
      }
      cdp.send("Fetch.continueRequest", { headers, requestId: event.requestId }).catch((error) => {
        console.error(`Unable to continue browser request: ${error.message}`);
      });
    });
    await cdp.send("Fetch.enable", {
      patterns: [{ requestStage: "Request", urlPattern: `${APP_ORIGIN}/*` }]
    });
    await cdp.send("Page.navigate", { url: `${APP_ORIGIN}/owner/sign-in` });
    await waitFor(
      cdp,
      "owner beta access request form",
      'document.readyState === "complete" && Boolean(document.querySelector("form.beta-access-request-form"))'
    );
    await evaluate(
      cdp,
      `
        (() => {
          const form = document.querySelector("form.beta-access-request-form");
          form.querySelector('input[name="ownerName"]').value = ${JSON.stringify(OWNER_NAME)};
          form.querySelector('input[name="gymName"]').value = ${JSON.stringify(GYM_NAME)};
          form.querySelector('input[name="email"]').value = ${JSON.stringify(OWNER_EMAIL)};
          form.querySelector('input[name="locationHint"]').value = ${JSON.stringify(LOCATION_HINT)};
          const note = form.querySelector('textarea[name="note"]');
          if (note) note.value = ${JSON.stringify(NOTE)};
          for (const element of form.querySelectorAll("input, textarea")) {
            element.dispatchEvent(new Event("input", { bubbles: true }));
            element.dispatchEvent(new Event("change", { bubbles: true }));
          }
          form.requestSubmit();
          return true;
        })()
      `
    );
    const successMessage = await waitFor(
      cdp,
      "owner beta access success message",
      `document.body.innerText.includes("Request received.") && document.body.innerText.includes("invite delivery")`,
      20_000
    );
    const bodyText = await evaluate(cdp, "document.body.innerText");
    assertNoSecretShapedValue(bodyText, "owner beta request browser body text");
    return { successMessage: Boolean(successMessage) };
  } finally {
    if (socket) {
      socket.close();
    }
    chrome.kill("SIGTERM");
    await sleep(250);
    if (chrome.exitCode === null) {
      chrome.kill("SIGKILL");
    }
    rmSync(userDataDir, { force: true, recursive: true });
    assertNoSecretShapedValue(stderr, "Chrome stderr");
  }
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function writeEvidence(request, providerGate, browserResult) {
  const evidence = {
    app_origin: APP_ORIGIN,
    browser: {
      success_message_seen: browserResult.successMessage === true
    },
    checks: {
      browser_form_submitted: true,
      live_provider_gates_blocked: providerGate.unexpected_live_provider_records === 0,
      request_row_verified: request.id === proofRequestId
    },
    cleanup: RETAIN_PROOF_DATA ? "retained" : "cleanup_requested",
    neon_branch_name: config.branchName,
    proof_email_domain: "@beta-browser-proof.outpost.local",
    request: {
      email: request.email,
      gym_name: request.gym_name,
      id: request.id,
      owner_name: request.owner_name,
      request_count: request.request_count,
      status: request.status
    },
    run_id: RUN_ID,
    wrote_at: new Date().toISOString()
  };
  const payload = JSON.stringify(evidence, null, 2);
  assertNoSecretShapedValue(payload, "hosted beta request browser proof evidence");
  mkdirSync(dirname(EVIDENCE_PATH), { recursive: true });
  writeFileSync(EVIDENCE_PATH, `${payload}\n`);
  return sha256(payload);
}

async function main() {
  assertProofSafety();
  mkdirSync(ARTIFACT_DIR, { recursive: true });

  console.log("Outpost hosted beta request browser proof");
  console.log(`Project: ${config.projectId}`);
  console.log(`Branch: ${config.branchName}`);
  console.log(`Preview: ${APP_ORIGIN}`);
  console.log(`Disposable request: ${OWNER_EMAIL}`);
  console.log("Mode: browser request form -> hosted Neon request row -> no-live-provider verification\n");

  try {
    proofRequestId = PROOF_REQUEST_ID;
    cleanupArmed = true;
    await verifyPreviewRuntimeBranch();
    const browserResult = await submitRequestInBrowser();
    const request = loadRequest();
    invariant(request?.id, "Disposable owner beta browser request row was not created.");
    invariant(request.id === PROOF_REQUEST_ID, "Disposable request id mismatch.");
    invariant(request.email === OWNER_EMAIL, "Disposable request email mismatch.");
    invariant(request.status === "new", `Expected new request status, got ${request.status}.`);
    invariant(request.gym_name === GYM_NAME, "Disposable request gym name mismatch.");

    const providerGate = verifyNoLiveProviders();
    invariant(providerGate.unexpected_live_provider_records === 0, "Unexpected live-provider records found.");
    const evidenceSha256 = writeEvidence(request, providerGate, browserResult);

    console.log("Hosted beta request browser proof passed.");
    console.log(`Request: ${request.id}`);
    console.log(`Evidence: ${EVIDENCE_PATH}`);
    console.log(`Evidence sha256: ${evidenceSha256}`);
    console.log("Live-provider gates: blocked");
    console.log(RETAIN_PROOF_DATA ? "Cleanup: retained by operator request." : "Cleanup: disposable request row cleanup requested.");
  } finally {
    cleanupProofData();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
