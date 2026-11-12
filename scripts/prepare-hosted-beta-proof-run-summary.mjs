#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

const BROWSER_EVIDENCE_PATH = requireEnv("OUTPOST_BETA_REQUEST_BROWSER_EVIDENCE_PATH");
const CHAIN_EVIDENCE_PATH = requireEnv("OUTPOST_BETA_REQUEST_CHAIN_EVIDENCE_PATH");
const SUMMARY_PATH =
  process.env.OUTPOST_BETA_PROOF_RUN_SUMMARY_PATH ??
  "artifacts/admin-launch-readiness/beta-proof-run-summary.json";

function invariant(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value?.trim()) {
    throw new Error(`${name} required.`);
  }
  return value.trim();
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
    /(?:password|token|cookie|api[_-]?key|authorization|credential|private[_-]?key|secret|bypass|signature|jwt)\s*[:=]/iu.test(
      text
    );
  invariant(!secretValue, `${label} contains secret-shaped value.`);
}

function assertNoSecretShapedKeys(value, label, trail = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoSecretShapedKeys(item, label, [...trail, String(index)]));
    return;
  }
  if (!value || typeof value !== "object") {
    return;
  }
  for (const [key, nestedValue] of Object.entries(value)) {
    const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/gu, "");
    const path = [...trail, key].join(".");
    const secretKey =
      normalizedKey.includes("password") ||
      normalizedKey.includes("token") ||
      normalizedKey.includes("cookie") ||
      normalizedKey.includes("apikey") ||
      normalizedKey.includes("authorization") ||
      normalizedKey.includes("credential") ||
      normalizedKey.includes("secret") ||
      normalizedKey.includes("bypass") ||
      normalizedKey.includes("jwt") ||
      normalizedKey.includes("signature");
    invariant(!secretKey, `${label} contains secret-shaped key ${path}.`);
    assertNoSecretShapedKeys(nestedValue, label, [...trail, key]);
  }
}

function assertArtifactPath(path, label) {
  const resolved = resolve(path);
  const repoRoot = process.cwd();
  const relativePath = relative(repoRoot, resolved);
  const isInsideRepo = !relativePath.startsWith("..") && !isAbsolute(relativePath);
  const isIgnoredArtifactPath = relativePath === "artifacts" || relativePath.startsWith(`artifacts${sep}`);
  invariant(!isInsideRepo || isIgnoredArtifactPath, `${label} must live under gitignored artifacts/ when repo-local.`);
  return resolved;
}

function readJsonArtifact(path, label) {
  const resolved = assertArtifactPath(path, label);
  invariant(existsSync(resolved), `${label} does not exist: ${path}`);
  const raw = readFileSync(resolved, "utf8");
  assertNoSecretShapedValue(raw, label);
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`${label} must be valid JSON.`);
    }
    throw error;
  }
  assertNoSecretShapedKeys(parsed, label);
  return { parsed, raw, resolved };
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function validateBrowserEvidence(browser) {
  invariant(browser.app_origin, "browser proof app_origin is required.");
  invariant(browser.neon_branch_name, "browser proof neon_branch_name is required.");
  invariant(browser.browser?.success_message_seen === true, "browser proof must see the request success message.");
  invariant(browser.checks?.browser_form_submitted === true, "browser proof must submit the browser form.");
  invariant(browser.checks?.request_row_verified === true, "browser proof must verify the hosted request row.");
  invariant(browser.checks?.live_provider_gates_blocked === true, "browser proof must keep live-provider gates blocked.");
  invariant(
    browser.cleanup === "cleanup_requested" || browser.cleanup === "retained",
    "browser proof cleanup status is required."
  );
  invariant(browser.request?.status === "new", "browser proof request must remain new.");
}

function validateChainEvidence(chain) {
  invariant(chain.app_origin, "chain proof app_origin is required.");
  invariant(chain.branch, "chain proof branch is required.");
  invariant(chain.proof === "hosted_beta_request_chain", "chain proof kind mismatch.");
  invariant(chain.status === "passed", "chain proof must have passed.");
  invariant(chain.no_live_provider_gates_blocked === true, "chain proof must keep live-provider gates blocked.");
  invariant(
    chain.cleanup === "cleanup_requested" || chain.cleanup === "retained",
    "chain proof cleanup status is required."
  );
  invariant(chain.request_id, "chain proof request_id is required.");
}

function main() {
  const browserArtifact = readJsonArtifact(BROWSER_EVIDENCE_PATH, "browser proof evidence");
  const chainArtifact = readJsonArtifact(CHAIN_EVIDENCE_PATH, "request-chain proof evidence");
  const browser = browserArtifact.parsed;
  const chain = chainArtifact.parsed;
  validateBrowserEvidence(browser);
  validateChainEvidence(chain);
  invariant(browser.app_origin === chain.app_origin, "browser and chain proofs must target the same Preview origin.");
  invariant(
    browser.neon_branch_name === chain.branch,
    "browser and chain proofs must target the same hosted Neon branch."
  );

  const summary = {
    app_origin: browser.app_origin,
    blocked_gates: [
      "Public self-serve launch",
      "Browser approval buttons",
      "Invite delivery",
      "Notification sending",
      "Phone/email providers",
      "Billing",
      "POS/access control/member-ledger writes"
    ],
    cleanup: {
      browser_request: browser.cleanup,
      request_chain: chain.cleanup
    },
    neon_branch_name: browser.neon_branch_name,
    proofs: {
      browser_request: {
        artifact_path: BROWSER_EVIDENCE_PATH,
        artifact_sha256: sha256(browserArtifact.raw),
        request_status: browser.request.status,
        status: "passed"
      },
      request_chain: {
        artifact_path: CHAIN_EVIDENCE_PATH,
        artifact_sha256: sha256(chainArtifact.raw),
        request_id: chain.request_id,
        status: chain.status
      }
    },
    ready_for_next_slice: true,
    summary_kind: "hosted_beta_request_proof_run_summary",
    wrote_at: new Date().toISOString()
  };
  const payload = JSON.stringify(summary, null, 2);
  assertNoSecretShapedValue(payload, "hosted beta proof run summary");
  assertNoSecretShapedKeys(summary, "hosted beta proof run summary");
  const summaryPath = assertArtifactPath(SUMMARY_PATH, "summary path");
  mkdirSync(dirname(summaryPath), { recursive: true });
  writeFileSync(summaryPath, `${payload}\n`);
  console.log("Hosted beta proof run summary written.");
  console.log(`Summary: ${SUMMARY_PATH}`);
  console.log(`Summary sha256: ${sha256(payload)}`);
  console.log("Public self-serve and live-provider gates: blocked");
}

main();
