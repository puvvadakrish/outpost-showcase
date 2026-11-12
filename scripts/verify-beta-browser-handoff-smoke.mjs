#!/usr/bin/env node

import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawn, spawnSync } from "node:child_process";

const APP_ORIGIN = normalizeAppOrigin(
  process.env.OUTPOST_BETA_BROWSER_APP_URL ?? process.env.NEXT_PUBLIC_OUTPOST_APP_URL ?? "http://localhost:3000"
);
const DRY_RUN_APP_ORIGIN = normalizeAppOrigin(process.env.NEXT_PUBLIC_OUTPOST_APP_URL ?? APP_ORIGIN);
const VERCEL_BYPASS_SECRET = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
const CHROME_PATH =
  process.env.OUTPOST_CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const HEADLESS = process.env.OUTPOST_BETA_BROWSER_HEADLESS !== "0";
const RUN_ID = normalizeRunId(process.env.OUTPOST_BETA_DRY_RUN_ID ?? `beta_browser_${Date.now().toString(36)}`);
const OWNER_EMAIL = normalizeEmail(process.env.OUTPOST_OWNER_BETA_EMAIL ?? `beta+dry-run-${RUN_ID}@owner.outpost.local`);
const OWNER_PASSWORD = process.env.OUTPOST_OWNER_BETA_PASSWORD ?? `${randomUUID().replaceAll("-", "")}Aa1`;
const OWNER_NAME = process.env.OUTPOST_OWNER_BETA_NAME ?? "Beta Browser Dry Run Owner";
const EVIDENCE_DIR = process.env.OUTPOST_BETA_BROWSER_EVIDENCE_DIR ?? "artifacts/beta-browser-handoff";
const RETAINED_EVIDENCE_PATH = join(EVIDENCE_DIR, `${RUN_ID}-retained.json`);
const ROLLBACK_EVIDENCE_PATH = join(EVIDENCE_DIR, `${RUN_ID}-rollback.json`);
const BROWSER_EVIDENCE_PATH = join(EVIDENCE_DIR, `${RUN_ID}-browser.json`);

function invariant(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function normalizeRunId(value) {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9_]/gu, "_");
  invariant(normalized.length >= 8, "OUTPOST_BETA_DRY_RUN_ID must be at least 8 safe characters.");
  invariant(normalized.length <= 64, "OUTPOST_BETA_DRY_RUN_ID must be 64 characters or fewer.");

  return normalized;
}

function normalizeEmail(email) {
  const normalized = email.trim().toLowerCase();
  invariant(normalized.includes("@"), "Dry-run owner email must be an email address.");
  invariant(
    normalized.includes("+dry-run") || normalized.endsWith("@owner.outpost.local"),
    "Browser handoff owner email must include +dry-run or end with @owner.outpost.local."
  );

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

function isVercelPreviewOrigin(origin) {
  return new URL(origin).hostname.endsWith(".vercel.app");
}

function assertBrowserProofSafety() {
  invariant(existsSync(CHROME_PATH), `Chrome executable was not found at ${CHROME_PATH}.`);

  if ((isVercelPreviewOrigin(APP_ORIGIN) || isVercelPreviewOrigin(DRY_RUN_APP_ORIGIN)) && !VERCEL_BYPASS_SECRET) {
    throw new Error(
      "VERCEL_AUTOMATION_BYPASS_SECRET is required for protected Vercel Preview browser handoff smoke."
    );
  }

  invariant(
    process.env.OUTPOST_BETA_DRY_RUN_KEEP_DATA !== "1",
    "Do not set OUTPOST_BETA_DRY_RUN_KEEP_DATA for browser handoff smoke; this script manages retained data and rollback."
  );
  invariant(
    process.env.OUTPOST_BETA_DRY_RUN_ROLLBACK_ONLY !== "1",
    "Do not set OUTPOST_BETA_DRY_RUN_ROLLBACK_ONLY for browser handoff smoke; this script manages rollback."
  );
}

function runCommand(args, env, label) {
  const result = spawnSync(args[0], args.slice(1), {
    cwd: process.cwd(),
    encoding: "utf8",
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"]
  });

  if (result.stdout) {
    process.stdout.write(result.stdout);
  }

  if (result.stderr) {
    process.stderr.write(result.stderr);
  }

  if (result.status !== 0) {
    const error = new Error(`${label} failed with exit code ${result.status}.`);
    error.stdout = result.stdout;
    error.stderr = result.stderr;
    throw error;
  }

  return result.stdout;
}

function extractRollbackTenantId(output) {
  return (
    output.match(/OUTPOST_BETA_DRY_RUN_TENANT_ID=(tenant_[a-z0-9-]+)/u)?.[1] ??
    output.match(/Owner bootstrap: (tenant_[a-z0-9-]+)/u)?.[1] ??
    null
  );
}

function runRetainedDryRun() {
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  let output = "";
  try {
    output = runCommand(
      ["npm", "run", "beta:dry-run:onboarding"],
      {
        OUTPOST_BETA_DRY_RUN_EVIDENCE_PATH: RETAINED_EVIDENCE_PATH,
        OUTPOST_BETA_DRY_RUN_ID: RUN_ID,
        OUTPOST_BETA_DRY_RUN_KEEP_DATA: "1",
        OUTPOST_OWNER_BETA_EMAIL: OWNER_EMAIL,
        OUTPOST_OWNER_BETA_NAME: OWNER_NAME,
        OUTPOST_OWNER_BETA_NOTE: "Beta browser handoff smoke",
        OUTPOST_OWNER_BETA_PASSWORD: OWNER_PASSWORD,
        NEXT_PUBLIC_OUTPOST_APP_URL: DRY_RUN_APP_ORIGIN
      },
      "Retained Beta dry-run setup"
    );
  } catch (error) {
    error.rollbackTenantId = extractRollbackTenantId(`${error.stdout ?? ""}\n${error.stderr ?? ""}`);
    throw error;
  }

  try {
    return JSON.parse(readFileSync(RETAINED_EVIDENCE_PATH, "utf8"));
  } catch (error) {
    error.rollbackTenantId = extractRollbackTenantId(output);
    throw error;
  }
}

function rollbackDryRun(tenantId) {
  if (!tenantId) {
    return;
  }

  runCommand(
    ["npm", "run", "beta:dry-run:onboarding"],
    {
      OUTPOST_BETA_DRY_RUN_EVIDENCE_PATH: ROLLBACK_EVIDENCE_PATH,
      OUTPOST_BETA_DRY_RUN_ID: RUN_ID,
      OUTPOST_BETA_DRY_RUN_OWNER_EMAIL: OWNER_EMAIL,
      OUTPOST_BETA_DRY_RUN_ROLLBACK_ONLY: "1",
      OUTPOST_BETA_DRY_RUN_TENANT_ID: tenantId,
      NEXT_PUBLIC_OUTPOST_APP_URL: DRY_RUN_APP_ORIGIN
    },
    "Beta dry-run rollback"
  );
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

  throw new Error("Chrome did not expose a DevToolsActivePort file.");
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
    this.nextId = 1;
    this.pending = new Map();
    this.socket = socket;
    this.socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (!message.id) {
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
}

async function connectToTarget(port) {
  const target = await fetchJson(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" });
  const socket = new WebSocket(target.webSocketDebuggerUrl);

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Timed out connecting to Chrome target.")), 10_000);
    socket.addEventListener("open", () => {
      clearTimeout(timeout);
      resolve();
    });
    socket.addEventListener("error", () => {
      clearTimeout(timeout);
      reject(new Error("Unable to connect to Chrome target."));
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

async function waitFor(cdp, description, predicateExpression, timeoutMs = 15_000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (await evaluate(cdp, predicateExpression)) {
      return;
    }

    await sleep(250);
  }

  const debugState = await evaluate(
    cdp,
    `({ location: location.href, text: document.body?.innerText?.slice(0, 1200) ?? "" })`
  );
  throw new Error(`Timed out waiting for ${description}: ${JSON.stringify(debugState)}`);
}

async function runBrowserSmoke({ tenantName }) {
  const userDataDir = mkdtempSync(join(tmpdir(), "outpost-beta-browser-"));
  const chromeArgs = [
    `--user-data-dir=${userDataDir}`,
    // CDP is exposed only on an ephemeral loopback port for this isolated throwaway profile.
    "--remote-debugging-port=0",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-background-networking",
    "--disable-extensions",
    "--window-size=1440,1100",
    "about:blank"
  ];

  if (HEADLESS) {
    chromeArgs.unshift("--headless=new", "--disable-gpu");
  }

  const chrome = spawn(CHROME_PATH, chromeArgs, {
    stdio: ["ignore", "ignore", "pipe"]
  });
  let stderr = "";
  let socket = null;
  chrome.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });

  try {
    const port = await waitForPortFile(userDataDir);
    const connected = await connectToTarget(port);
    const cdp = connected.cdp;
    socket = connected.socket;
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Network.enable");

    if (VERCEL_BYPASS_SECRET) {
      await cdp.send("Network.setExtraHTTPHeaders", {
        headers: {
          "x-vercel-protection-bypass": VERCEL_BYPASS_SECRET,
          "x-vercel-set-bypass-cookie": "true"
        }
      });
    }

    await cdp.send("Page.navigate", { url: `${APP_ORIGIN}/owner/sign-in` });
    await waitFor(
      cdp,
      "owner sign-in form",
      'document.readyState === "complete" && Boolean(document.querySelector(\'form.auth-form input[autocomplete="current-password"]\'))'
    );
    await evaluate(
      cdp,
      `
        (() => {
          const password = document.querySelector('form.auth-form input[autocomplete="current-password"]');
          const form = password.closest("form.auth-form");
          const email = form.querySelector('input[name="email"]');
          email.value = ${JSON.stringify(OWNER_EMAIL)};
          password.value = ${JSON.stringify(OWNER_PASSWORD)};
          email.dispatchEvent(new Event("input", { bubbles: true }));
          password.dispatchEvent(new Event("input", { bubbles: true }));
          form.requestSubmit();
          return true;
        })()
      `
    );
    await waitFor(
      cdp,
      "owner workspace route",
      'location.pathname === "/owner" && document.body.innerText.includes("Owner workspace")',
      20_000
    );
    await waitFor(
      cdp,
      "dry-run tenant proof text",
      `
        document.body.innerText.includes(${JSON.stringify(tenantName)}) &&
        document.body.innerText.includes("hosted Neon proof must stay current") &&
        document.body.innerText.includes("Live gates closed")
      `,
      10_000
    );

    const evidence = await evaluate(
      cdp,
      `
        ({
          location: location.href,
          title: document.title,
          hasOwnerWorkspace: document.body.innerText.includes("Owner workspace"),
          hasTenantName: document.body.innerText.includes(${JSON.stringify(tenantName)}),
          hasHostedProofCopy: document.body.innerText.includes("hosted Neon proof must stay current"),
          hasLiveProviderBoundary: document.body.innerText.includes("Live gates closed")
        })
      `
    );
    socket.close();

    return evidence;
  } finally {
    socket?.close();
    chrome.kill("SIGTERM");
    await sleep(250);

    if (chrome.exitCode === null) {
      chrome.kill("SIGKILL");
    }

    rmSync(userDataDir, { force: true, recursive: true });

    if (stderr && process.env.OUTPOST_BETA_BROWSER_DEBUG === "1") {
      console.error(stderr);
    }
  }
}

function writeBrowserEvidence(evidence, retainedEvidence) {
  const payload = {
    app_origin: APP_ORIGIN,
    browser: {
      headless: HEADLESS,
      isolated_profile: true
    },
    generated_at: new Date().toISOString(),
    live_provider_gate: "blocked",
    owner_email: OWNER_EMAIL,
    retained_setup_origin: DRY_RUN_APP_ORIGIN,
    retained_evidence_status: retainedEvidence.status,
    run_id: RUN_ID,
    smoke: evidence,
    status: "browser_handoff_smoke_passed",
    tenant: retainedEvidence.tenant
  };

  mkdirSync(dirname(BROWSER_EVIDENCE_PATH), { recursive: true });
  writeFileSync(BROWSER_EVIDENCE_PATH, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`Browser evidence: wrote non-secret handoff summary to ${BROWSER_EVIDENCE_PATH}`);
}

async function main() {
  assertBrowserProofSafety();

  let retainedEvidence = null;
  let originalError = null;
  let rollbackTenantId = null;
  try {
    retainedEvidence = runRetainedDryRun();
    rollbackTenantId = retainedEvidence.tenant.id;
    const browserEvidence = await runBrowserSmoke({ tenantName: retainedEvidence.tenant.name });
    writeBrowserEvidence(browserEvidence, retainedEvidence);
    console.log("Browser handoff smoke: owner sign-in rendered the dry-run tenant in /owner.");
  } catch (error) {
    originalError = error;
    rollbackTenantId = rollbackTenantId ?? error.rollbackTenantId ?? null;
    throw error;
  } finally {
    if (rollbackTenantId) {
      try {
        rollbackDryRun(rollbackTenantId);
      } catch (rollbackError) {
        console.error(`Browser handoff rollback also failed: ${rollbackError.message}`);

        if (!originalError) {
          throw rollbackError;
        }
      }
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
